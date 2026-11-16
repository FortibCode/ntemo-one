<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Connexion sécurisée multi-client (Web et Mobile).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            app(AuditLogger::class)->record('auth.login_failed', $user, ['email' => $request->email], [], null, $user?->organization_id);
            throw ValidationException::withMessages([
                'email' => ['Identifiants de connexion invalides.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Ce compte utilisateur a été désactivé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $deviceName = $request->input('device_name', 'Web Application');
        $token = $user->createToken($deviceName)->plainTextToken;
        app(AuditLogger::class)->record('auth.login', $user, ['device' => $deviceName], [], $user);

        $user->load(['organization', 'employee.department', 'employee.position', 'roles']);

        return response()->json([
            'success' => true,
            'message' => 'Connexion réussie.',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'employee' => $user->employee ? [
                        'id' => $user->employee->id,
                        'matricule' => $user->employee->matricule,
                        'first_name' => $user->employee->first_name,
                        'last_name' => $user->employee->last_name,
                        'department' => $user->employee->department?->name,
                        'position' => $user->employee->position?->title,
                    ] : null,
                    'organization' => $user->organization ? [
                        'id' => $user->organization->id,
                        'name' => $user->organization->name,
                        'slug' => $user->organization->slug,
                    ] : null,
                    'roles' => $user->roles->pluck('slug'),
                    'role_name' => $user->roles->first()?->name,
                    'permissions' => $this->permissionSlugs($user),
                ],
            ],
        ]);
    }

    /**
     * Liste des permissions effectives ('*' pour le super administrateur).
     */
    private function permissionSlugs(User $user): array
    {
        if ($user->hasRole('super_admin')) {
            return ['*'];
        }

        $user->loadMissing('roles.permissions');

        return $user->roles->flatMap->permissions->pluck('slug')->unique()->values()->all();
    }

    /**
     * Profil de l'utilisateur connecté.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['organization', 'roles.permissions', 'employee.department', 'employee.position']);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'organization' => $user->organization,
                'employee' => $user->employee,
                'roles' => $user->roles->pluck('slug'),
                'permissions' => $this->permissionSlugs($user),
            ],
        ]);
    }

    /**
     * Déconnexion et révocation du token.
     */
    public function logout(Request $request): JsonResponse
    {
        app(AuditLogger::class)->record('auth.logout', $request->user());
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Déconnexion effectuée avec succès.',
        ]);
    }
}

