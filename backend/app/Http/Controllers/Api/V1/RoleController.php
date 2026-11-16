<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleController extends Controller
{
    /**
     * Lister tous les rôles avec le nombre d'utilisateurs.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Role::withCount('users')->with('permissions:id,slug');

        // Filtrer par organisation (sauf super_admin qui voit tout)
        if (!$user->hasRole('super_admin') && $user->organization_id) {
            $query->where('organization_id', $user->organization_id);
        }

        $roles = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $roles->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'is_system' => $role->is_system,
                'users_count' => $role->users_count,
                'permissions' => $role->permissions->pluck('slug')->values(),
            ]),
        ]);
    }

    /**
     * Catalogue complet des permissions, groupées par module.
     */
    public function permissions(): JsonResponse
    {
        $permissions = Permission::orderBy('module')->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $permissions->map(fn (Permission $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'module' => $p->module,
                'description' => $p->description,
            ]),
        ]);
    }

    /**
     * Afficher un rôle avec ses permissions.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $role = Role::with('permissions')->find($id);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rôle non trouvé.',
                'error_code' => 'ROLE_NOT_FOUND',
            ], Response::HTTP_NOT_FOUND);
        }

        // Vérifier l'accès à l'organisation
        if (!$user->hasRole('super_admin') && $role->organization_id !== $user->organization_id) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé à ce rôle.',
                'error_code' => 'FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'is_system' => $role->is_system,
                'permissions' => $role->permissions->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'slug' => $p->slug,
                    'module' => $p->module,
                    'description' => $p->description,
                ]),
            ],
        ]);
    }

    /**
     * Assigner un rôle à un utilisateur.
     */
    public function assignRole(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'role_id' => ['required', 'uuid', 'exists:roles,id'],
        ]);

        $currentUser = $request->user();
        $targetUser = User::findOrFail($validated['user_id']);
        $role = Role::findOrFail($validated['role_id']);

        // Vérifier que l'utilisateur cible appartient à la même organisation
        if (!$currentUser->hasRole('super_admin') && $targetUser->organization_id !== $currentUser->organization_id) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible d\'assigner un rôle à un utilisateur d\'une autre organisation.',
                'error_code' => 'CROSS_ORG_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        // Vérifier que le rôle appartient à la même organisation
        if (!$currentUser->hasRole('super_admin') && $role->organization_id !== $currentUser->organization_id) {
            return response()->json([
                'success' => false,
                'message' => 'Ce rôle n\'appartient pas à votre organisation.',
                'error_code' => 'ROLE_ORG_MISMATCH',
            ], Response::HTTP_FORBIDDEN);
        }

        // Empêcher l'assignation du rôle super_admin par un non super_admin
        if ($role->slug === 'super_admin' && !$currentUser->hasRole('super_admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Seul un super administrateur peut assigner ce rôle.',
                'error_code' => 'SUPER_ADMIN_ONLY',
            ], Response::HTTP_FORBIDDEN);
        }

        // Attacher le rôle (syncWithoutDetaching évite les doublons)
        $targetUser->roles()->syncWithoutDetaching([$role->id]);

        return response()->json([
            'success' => true,
            'message' => 'Rôle assigné avec succès.',
            'data' => [
                'user_id' => $targetUser->id,
                'user_name' => $targetUser->name,
                'roles' => $targetUser->fresh()->roles->pluck('slug'),
            ],
        ]);
    }

    /**
     * Retirer un rôle à un utilisateur.
     */
    public function revokeRole(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'role_id' => ['required', 'uuid', 'exists:roles,id'],
        ]);

        $currentUser = $request->user();
        $targetUser = User::findOrFail($validated['user_id']);
        $role = Role::findOrFail($validated['role_id']);
        $isSuperAdmin = $currentUser->hasRole('super_admin');

        if (!$isSuperAdmin && $targetUser->organization_id !== $currentUser->organization_id) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de modifier les rôles d\'un utilisateur d\'une autre organisation.',
                'error_code' => 'CROSS_ORG_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($role->slug === 'super_admin' && !$isSuperAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Seul un super administrateur peut retirer ce rôle.',
                'error_code' => 'SUPER_ADMIN_ONLY',
            ], Response::HTTP_FORBIDDEN);
        }

        // Empêcher un administrateur de se retirer lui-même un rôle (risque de verrouillage)
        if ($targetUser->id === $currentUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas retirer vos propres rôles.',
                'error_code' => 'SELF_REVOKE_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        $targetUser->roles()->detach($role->id);

        return response()->json([
            'success' => true,
            'message' => 'Rôle retiré avec succès.',
            'data' => [
                'user_id' => $targetUser->id,
                'user_name' => $targetUser->name,
                'roles' => $targetUser->fresh()->roles->pluck('slug'),
            ],
        ]);
    }

    /**
     * Récupérer les permissions d'un rôle.
     */
    public function getRolePermissions(Request $request, string $roleId): JsonResponse
    {
        $user = $request->user();

        $role = Role::with('permissions')->find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rôle non trouvé.',
                'error_code' => 'ROLE_NOT_FOUND',
            ], Response::HTTP_NOT_FOUND);
        }

        // Vérifier l'accès à l'organisation
        if (!$user->hasRole('super_admin') && $role->organization_id !== $user->organization_id) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé à ce rôle.',
                'error_code' => 'FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'role' => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ],
                'permissions' => $role->permissions->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'slug' => $p->slug,
                    'module' => $p->module,
                    'description' => $p->description,
                ]),
            ],
        ]);
    }
}
