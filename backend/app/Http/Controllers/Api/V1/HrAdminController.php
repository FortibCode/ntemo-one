<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Administration RH du dossier collaborateur (cahier des charges §3.4 et §4) :
 * structure (services, postes), contrats de travail et comptes de connexion.
 */
class HrAdminController extends Controller
{
    public const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'PRESTATION', 'APPRENTISSAGE'];

    public function __construct(
        protected AuditLogger $audit
    ) {}

    // ── Structure ────────────────────────────────────────────────────────

    public function structure(Request $request): JsonResponse
    {
        $org = $request->user()->organization_id;

        return response()->json([
            'success' => true,
            'data' => [
                'departments' => Department::where('organization_id', $org)->where('is_active', true)
                    ->orderBy('name')->get(['id', 'name', 'code']),
                'positions' => Position::where('organization_id', $org)->where('is_active', true)
                    ->orderBy('title')->get(['id', 'title', 'code', 'department_id']),
            ],
        ]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        if ($denied = $this->deny($request, 'departments.manage')) {
            return $denied;
        }
        $org = $request->user()->organization_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:30', Rule::unique('departments', 'code')->where('organization_id', $org)],
        ]);
        $department = Department::create($data + ['id' => (string) Str::uuid(), 'organization_id' => $org, 'is_active' => true]);
        $this->audit->record('structure.department_created', $department, $data);

        return response()->json(['success' => true, 'data' => $department->only(['id', 'name', 'code'])], Response::HTTP_CREATED);
    }

    public function storePosition(Request $request): JsonResponse
    {
        if ($denied = $this->deny($request, 'positions.manage')) {
            return $denied;
        }
        $org = $request->user()->organization_id;
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:30', Rule::unique('positions', 'code')->where('organization_id', $org)],
            'department_id' => ['nullable', 'uuid', Rule::exists('departments', 'id')->where('organization_id', $org)],
        ]);
        $position = Position::create($data + ['id' => (string) Str::uuid(), 'organization_id' => $org, 'is_active' => true]);
        $this->audit->record('structure.position_created', $position, $data);

        return response()->json(['success' => true, 'data' => $position->only(['id', 'title', 'code', 'department_id'])], Response::HTTP_CREATED);
    }

    // ── Contrats ─────────────────────────────────────────────────────────

    public function contracts(Request $request, string $employeeId): JsonResponse
    {
        if ($denied = $this->deny($request, 'contracts.manage')) {
            return $denied;
        }
        $employee = $this->employee($request, $employeeId);

        return response()->json([
            'success' => true,
            'data' => Contract::where('employee_id', $employee->id)->orderByDesc('start_date')->get()
                ->map(fn (Contract $c) => $this->contractPayload($c)),
        ]);
    }

    public function storeContract(Request $request, string $employeeId): JsonResponse
    {
        if ($denied = $this->deny($request, 'contracts.manage')) {
            return $denied;
        }
        $employee = $this->employee($request, $employeeId);
        $org = $employee->organization_id;

        $data = $request->validate([
            'type' => ['required', Rule::in(self::CONTRACT_TYPES)],
            'reference' => ['nullable', 'string', 'max:50', Rule::unique('contracts', 'reference')->where('organization_id', $org)],
            'start_date' => ['required', 'date'],
            // Un contrat à durée déterminée doit avoir une échéance
            'end_date' => ['nullable', 'required_if:type,CDD,STAGE,PRESTATION,APPRENTISSAGE', 'date', 'after_or_equal:start_date'],
            'probation_end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'gross_salary' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $contract = DB::transaction(function () use ($employee, $data) {
            // Le nouveau contrat remplace le contrat actif (renouvellement, passage en CDI…)
            Contract::where('employee_id', $employee->id)->where('status', 'ACTIVE')->update(['status' => 'EXPIRED']);

            $contract = Contract::create($data + [
                'id' => (string) Str::uuid(),
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'currency' => $employee->organization?->currency ?: 'XAF',
                'status' => 'ACTIVE',
            ]);

            if (!empty($data['probation_end_date'])) {
                $employee->update(['probation_end_date' => $data['probation_end_date']]);
            }

            return $contract;
        });

        $this->audit->record('contract.created', $contract, [
            'employee' => $employee->matricule,
            'type' => $contract->type,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'] ?? null,
        ]);

        return response()->json(['success' => true, 'message' => 'Contrat enregistré.', 'data' => $this->contractPayload($contract)], Response::HTTP_CREATED);
    }

    // ── Compte de connexion ──────────────────────────────────────────────

    /**
     * Crée le compte de connexion d'un collaborateur et lui attribue un rôle.
     * Le mot de passe provisoire n'est renvoyé qu'une seule fois.
     */
    public function createAccount(Request $request, string $employeeId): JsonResponse
    {
        if ($denied = $this->deny($request, 'roles.manage')) {
            return $denied;
        }
        $actor = $request->user();
        $employee = $this->employee($request, $employeeId);

        if ($employee->user_id) {
            return response()->json(['success' => false, 'message' => 'Ce collaborateur possède déjà un compte.'], Response::HTTP_CONFLICT);
        }

        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:150', Rule::unique('users', 'email')],
            'role_id' => ['required', 'uuid', Rule::exists('roles', 'id')->where('organization_id', $actor->organization_id)],
        ]);

        $email = $data['email'] ?? $employee->email;
        if (!$email) {
            return response()->json([
                'success' => false,
                'message' => 'Renseignez une adresse e-mail pour ce collaborateur.',
                'errors' => ['email' => ['L\'adresse e-mail est obligatoire pour créer un compte.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if (User::where('email', $email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette adresse e-mail est déjà utilisée par un autre compte.',
                'errors' => ['email' => ['Adresse déjà utilisée.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $role = Role::findOrFail($data['role_id']);
        $temporaryPassword = $this->temporaryPassword();

        $user = DB::transaction(function () use ($employee, $email, $role, $temporaryPassword) {
            $user = User::create([
                'id' => (string) Str::uuid(),
                'organization_id' => $employee->organization_id,
                'name' => $employee->full_name,
                'email' => $email,
                'password' => Hash::make($temporaryPassword),
                'is_active' => true,
            ]);
            $user->roles()->attach($role->id);
            $employee->update(['user_id' => $user->id, 'email' => $employee->email ?: $email]);

            return $user;
        });

        $this->audit->record('account.created', $user, ['employee' => $employee->matricule, 'email' => $email, 'role' => $role->slug]);

        return response()->json([
            'success' => true,
            'message' => 'Compte créé. Transmettez le mot de passe provisoire au collaborateur : il ne sera plus affiché.',
            'data' => [
                'user_id' => $user->id,
                'email' => $email,
                'role' => $role->name,
                'temporary_password' => $temporaryPassword,
            ],
        ], Response::HTTP_CREATED);
    }

    // ─────────────────────────────────────────────────────────────────────

    private function contractPayload(Contract $c): array
    {
        return [
            'id' => $c->id,
            'type' => $c->type,
            'reference' => $c->reference,
            'status' => $c->status,
            'start_date' => $c->start_date?->toDateString(),
            'end_date' => $c->end_date?->toDateString(),
            'probation_end_date' => $c->probation_end_date?->toDateString(),
            'gross_salary' => $c->gross_salary !== null ? (float) $c->gross_salary : null,
            'currency' => $c->currency,
            'notes' => $c->notes,
        ];
    }

    /** Mot de passe provisoire lisible (sans caractères ambigus), 12 caractères. */
    private function temporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        $password = '';
        for ($i = 0; $i < 12; $i++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $password;
    }

    private function employee(Request $request, string $id): Employee
    {
        return Employee::where('organization_id', $request->user()->organization_id)->findOrFail($id);
    }

    private function deny(Request $request, string $permission): ?JsonResponse
    {
        if ($request->user()->hasPermission($permission)) {
            return null;
        }

        return response()->json([
            'success' => false,
            'message' => 'Action non autorisée. Permission insuffisante.',
            'error_code' => 'FORBIDDEN_PERMISSION',
        ], Response::HTTP_FORBIDDEN);
    }
}
