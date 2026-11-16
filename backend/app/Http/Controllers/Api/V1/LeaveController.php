<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Services\LeaveService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class LeaveController extends Controller
{
    public function __construct(
        protected LeaveService $leaveService
    ) {}

    /**
     * Liste des types de congés paramétrés pour l'organisation.
     */
    public function types(Request $request): JsonResponse
    {
        $types = LeaveType::where('organization_id', $request->user()->organization_id)
            ->where('is_active', true)
            ->get();

        return response()->json(['success' => true, 'data' => $types]);
    }

    /**
     * Mes demandes de congés (Collaborateur connecté).
     */
    public function index(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['data' => []]);
        }

        $requests = LeaveRequest::where('employee_id', $employee->id)
            ->with(['leaveType', 'approvals.approver'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($requests);
    }

    /**
     * Soumission d'une nouvelle demande de congé.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'leave_type_id' => ['required', 'uuid', 'exists:leave_types,id'],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun profil employé rattaché à ce compte.',
            ], Response::HTTP_FORBIDDEN);
        }

        $leaveType = LeaveType::where('id', $request->leave_type_id)
            ->where('organization_id', $request->user()->organization_id)
            ->firstOrFail();

        try {
            $leaveRequest = $this->leaveService->submitLeaveRequest(
                $employee,
                $leaveType,
                Carbon::parse($request->start_date),
                Carbon::parse($request->end_date),
                $request->reason
            );

            return response()->json([
                'success' => true,
                'message' => 'Demande de congé déposée avec succès.',
                'data' => $leaveRequest,
            ], Response::HTTP_CREATED);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    /**
     * Décision N+1 (Manager d'équipe).
     */
    public function reviewByManager(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'approved' => ['required', 'boolean'],
            'comments' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        if (!$user->hasPermission('leaves.approve_n1')) {
            return response()->json([
                'success' => false,
                'message' => 'Permission insuffisante pour valider au niveau hiérarchique N+1.',
            ], Response::HTTP_FORBIDDEN);
        }

        $leaveRequest = LeaveRequest::where('id', $id)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();

        $leaveRequest->loadMissing('employee');
        if ($denied = $this->guardReview($leaveRequest, $user, true)) {
            return $denied;
        }

        try {
            $updated = $this->leaveService->reviewByManager(
                $leaveRequest,
                $user,
                $request->boolean('approved'),
                $request->comments
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], Response::HTTP_CONFLICT);
        }
        app(NotificationService::class)->notifyEmployee($updated->employee, 'LEAVE_DECISION',
            $request->boolean('approved') ? 'Congé validé par votre responsable' : 'Congé refusé par votre responsable',
            $request->boolean('approved')
                ? 'Votre demande du ' . $updated->start_date?->format('d/m/Y') . ' au ' . $updated->end_date?->format('d/m/Y') . ' passe en validation RH.'
                : 'Votre demande du ' . $updated->start_date?->format('d/m/Y') . ' a été refusée.' . ($request->comments ? " Motif : {$request->comments}" : ''),
            ['leave_request_id' => $updated->id], $user);
        app(AuditLogger::class)->record('leave.reviewed_n1', $updated, ['approved' => $request->boolean('approved'), 'status' => $updated->status, 'comments' => $request->comments]);

        return response()->json([
            'success' => true,
            'message' => 'Décision N+1 enregistrée avec succès.',
            'data' => $updated,
        ]);
    }

    /**
     * Décision finale RH.
     */
    public function reviewByHr(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'approved' => ['required', 'boolean'],
            'comments' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        if (!$user->hasPermission('leaves.approve_final_rh')) {
            return response()->json([
                'success' => false,
                'message' => 'Permission insuffisante pour la validation finale RH.',
            ], Response::HTTP_FORBIDDEN);
        }

        $leaveRequest = LeaveRequest::where('id', $id)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();

        $leaveRequest->loadMissing('employee');
        if ($denied = $this->guardReview($leaveRequest, $user, false)) {
            return $denied;
        }

        try {
            $updated = $this->leaveService->reviewByHr(
                $leaveRequest,
                $user,
                $request->boolean('approved'),
                $request->comments
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], Response::HTTP_CONFLICT);
        }
        app(NotificationService::class)->notifyEmployee($updated->employee, 'LEAVE_DECISION',
            $request->boolean('approved') ? 'Congé approuvé' : 'Congé refusé par les RH',
            'Votre demande du ' . $updated->start_date?->format('d/m/Y') . ' au ' . $updated->end_date?->format('d/m/Y')
                . ($request->boolean('approved') ? ' est définitivement approuvée.' : ' a été refusée.' . ($request->comments ? " Motif : {$request->comments}" : '')),
            ['leave_request_id' => $updated->id], $user);
        app(AuditLogger::class)->record('leave.reviewed_hr', $updated, ['approved' => $request->boolean('approved'), 'status' => $updated->status, 'comments' => $request->comments]);

        return response()->json([
            'success' => true,
            'message' => 'Décision finale RH enregistrée avec succès.',
            'data' => $updated,
        ]);
    }

    /**
     * Mes soldes de l'année (ouverts à la volée pour les types plafonnés).
     */
    public function balances(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $year = (int) Carbon::now($request->user()->organization?->timezone ?: 'Africa/Brazzaville')->year;
        $types = LeaveType::where('organization_id', $employee->organization_id)->where('is_active', true)->orderBy('name')->get();

        $data = [];
        foreach ($types as $type) {
            $balance = $this->leaveService->openBalance($employee, $type, $year);
            if ($balance) {
                $data[] = [
                    'leave_type' => ['id' => $type->id, 'name' => $type->name, 'code' => $type->code],
                    'year' => $year,
                    'allocated_days' => (float) $balance->allocated_days,
                    'used_days' => (float) $balance->used_days,
                    'pending_days' => (float) $balance->pending_days,
                    'remaining_days' => (float) $balance->remaining_days,
                ];
            }
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * Demandes en attente de MA décision : N+1 pour mes collaborateurs directs
     * (ou toute l'organisation avec accès global), validation finale pour la RH.
     */
    public function pending(Request $request): JsonResponse
    {
        $user = $request->user();
        $canN1 = $user->hasPermission('leaves.approve_n1');
        $canHr = $user->hasPermission('leaves.approve_final_rh');

        if (!$canN1 && !$canHr) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $me = $user->employee?->id;
        $query = LeaveRequest::where('organization_id', $user->organization_id)
            ->with(['employee:id,first_name,last_name,matricule,manager_id,department_id', 'employee.department:id,name', 'leaveType:id,name'])
            ->whereHas('employee', fn ($e) => $e->where('user_id', '!=', $user->id))
            ->where(function ($q) use ($canN1, $canHr, $user, $me) {
                if ($canN1) {
                    $q->orWhere(function ($n1) use ($user, $me) {
                        $n1->where('status', 'PENDING_N1');
                        if (!$user->hasPermission('employees.view_all')) {
                            $n1->whereHas('employee', fn ($e) => $e->where('manager_id', $me));
                        }
                    });
                }
                if ($canHr) {
                    $q->orWhere('status', 'PENDING_HR');
                }
            })
            ->orderBy('start_date');

        return response()->json([
            'success' => true,
            'data' => $query->get()->map(fn (LeaveRequest $r) => [
                'id' => $r->id,
                'status' => $r->status,
                'start_date' => $r->start_date?->toDateString(),
                'end_date' => $r->end_date?->toDateString(),
                'total_days' => (float) $r->total_days,
                'reason' => $r->reason,
                'leave_type' => $r->leaveType?->name,
                'created_at' => $r->created_at?->toISOString(),
                'employee' => [
                    'full_name' => $r->employee?->full_name,
                    'matricule' => $r->employee?->matricule,
                    'department' => $r->employee?->department?->name,
                ],
                'review_level' => $r->status === 'PENDING_N1' ? 'N1' : 'HR',
            ]),
        ]);
    }

    /**
     * Calendrier partagé des absences du mois (AAAA-MM). Le motif n'est jamais exposé.
     * Périmètre : toute l'organisation (accès global), sinon son service et son équipe.
     */
    public function calendar(Request $request): JsonResponse
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $user = $request->user();
        $tz = $user->organization?->timezone ?: 'Africa/Brazzaville';
        $month = $request->filled('month')
            ? Carbon::createFromFormat('Y-m-d', $request->input('month') . '-01', $tz)
            : Carbon::now($tz);
        $start = $month->copy()->startOfMonth()->toDateString();
        $end = $month->copy()->endOfMonth()->toDateString();

        $query = LeaveRequest::where('organization_id', $user->organization_id)
            ->whereIn('status', ['APPROVED', 'PENDING_N1', 'PENDING_HR'])
            ->whereDate('start_date', '<=', $end)
            ->whereDate('end_date', '>=', $start)
            ->with(['employee:id,first_name,last_name,matricule,department_id,manager_id', 'employee.department:id,name', 'leaveType:id,name']);

        if (!$user->hasPermission('employees.view_all')) {
            $me = $user->employee;
            $query->whereHas('employee', function ($e) use ($me) {
                $e->where('id', $me?->id)
                    ->orWhere('manager_id', $me?->id)
                    ->when($me?->department_id, fn ($q) => $q->orWhere('department_id', $me->department_id));
            });
        }

        return response()->json([
            'success' => true,
            'month' => $month->format('Y-m'),
            'data' => $query->orderBy('start_date')->get()->map(fn (LeaveRequest $r) => [
                'id' => $r->id,
                'status' => $r->status,
                'start_date' => $r->start_date?->toDateString(),
                'end_date' => $r->end_date?->toDateString(),
                'leave_type' => $r->leaveType?->name,
                'employee' => [
                    'id' => $r->employee?->id,
                    'full_name' => $r->employee?->full_name,
                    'department' => $r->employee?->department?->name,
                ],
            ]),
        ]);
    }

    /**
     * Séparation des tâches : jamais sa propre demande ; en N+1, uniquement ses collaborateurs
     * directs (sauf accès à tout le personnel).
     */
    private function guardReview(LeaveRequest $leaveRequest, User $user, bool $managerLevel): ?JsonResponse
    {
        if ($leaveRequest->employee?->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas valider votre propre demande de congé.',
                'error_code' => 'SELF_REVIEW_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($managerLevel && !$user->hasPermission('employees.view_all')
            && $leaveRequest->employee?->manager_id !== $user->employee?->id) {
            return response()->json([
                'success' => false,
                'message' => 'Seul le responsable direct du collaborateur peut rendre la décision N+1.',
                'error_code' => 'NOT_DIRECT_MANAGER',
            ], Response::HTTP_FORBIDDEN);
        }

        return null;
    }
}
