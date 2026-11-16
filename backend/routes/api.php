<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\BadgeController;
use App\Http\Controllers\Api\V1\LeaveController;
use App\Http\Controllers\Api\V1\DocumentEngineController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProjectTimesheetController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\AiAssistantController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Middleware\EnsureBelongsToOrganization;
use App\Http\Middleware\EnsureUserHasPermission;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - NTEMO ONE (v1)
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Authentification publique
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Routes protégées par Sanctum
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Routes restreintes par organisation active
        Route::middleware(EnsureBelongsToOrganization::class)->group(function () {
            // Module Tableau de Bord & Indicateurs
            Route::get('/dashboard/kpis', [DashboardController::class, 'kpis']);

            // Module Employés
            Route::apiResource('employees', EmployeeController::class);

            // Module Présences & Pointage QR Dynamique
            Route::post('/attendance/qr-session', [AttendanceController::class, 'generateQrSession']);
            Route::post('/attendance/punch', [AttendanceController::class, 'punch']);
            Route::get('/attendance/my-records', [AttendanceController::class, 'myAttendances']);
            Route::get('/attendance/corrections', [AttendanceController::class, 'corrections']);
            Route::post('/attendance/corrections', [AttendanceController::class, 'requestCorrection']);
            Route::post('/attendance/corrections/{id}/review', [AttendanceController::class, 'reviewCorrection']);

            // Module Badges Virtuels & Contrôle
            Route::get('/badges', [BadgeController::class, 'index']);
            Route::get('/badges/my-badge', [BadgeController::class, 'myVirtualBadge']);
            Route::post('/badges/issue', [BadgeController::class, 'issue']);
            Route::post('/badges/{badge}/revoke', [BadgeController::class, 'revoke']);
            Route::post('/badges/verify', [BadgeController::class, 'verify']);

            // Module Congés & Approbations
            Route::get('/leaves/types', [LeaveController::class, 'types']);
            Route::get('/leaves/my-requests', [LeaveController::class, 'index']);
            Route::post('/leaves/requests', [LeaveController::class, 'store']);
            Route::post('/leaves/requests/{id}/review-n1', [LeaveController::class, 'reviewByManager']);
            Route::post('/leaves/requests/{id}/review-hr', [LeaveController::class, 'reviewByHr']);

            // Module Moteur Documentaire Versionné
            Route::get('/documents/templates', [DocumentEngineController::class, 'templates']);
            Route::post('/documents/generate', [DocumentEngineController::class, 'generate']);
            Route::get('/documents/download/{id}', [DocumentEngineController::class, 'download']);

            // Module Notifications & Alertes
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
            Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

            // Module Projets, Tâches et Feuilles de temps
            Route::get('/projects', [ProjectTimesheetController::class, 'projects']);
            Route::get('/timesheets', [ProjectTimesheetController::class, 'index']);
            Route::get('/timesheets/my-entries', [ProjectTimesheetController::class, 'myTimeEntries']);
            Route::post('/timesheets/log', [ProjectTimesheetController::class, 'storeTimeEntry']);
            Route::post('/timesheets/{id}/review', [ProjectTimesheetController::class, 'reviewTimeEntry']);

            // Module Assistant IA pour les Tâches Documentaires Autorêmes
            Route::get('/ai/conversations', [AiAssistantController::class, 'conversations']);
            Route::post('/ai/conversations', [AiAssistantController::class, 'createConversation']);
            Route::post('/ai/conversations/{id}/messages', [AiAssistantController::class, 'sendMessage']);
            Route::post('/ai/tasks/draft', [AiAssistantController::class, 'generateDraft']);

            // Module Paramètres Organisation (lecture ouverte, écriture restreinte)
            Route::get('/settings', [SettingsController::class, 'index']);
            Route::get('/settings/attendance', [SettingsController::class, 'getAttendanceConfig']);
            Route::middleware(EnsureUserHasPermission::class . ':settings.manage')->group(function () {
                Route::put('/settings', [SettingsController::class, 'update']);
                Route::put('/settings/attendance', [SettingsController::class, 'updateAttendanceConfig']);
            });

            // Module Rôles & Permissions (réservé aux administrateurs)
            Route::middleware(EnsureUserHasPermission::class . ':roles.manage')->group(function () {
                Route::get('/permissions', [RoleController::class, 'permissions']);
                Route::get('/roles', [RoleController::class, 'index']);
                Route::post('/roles/assign', [RoleController::class, 'assignRole']);
                Route::post('/roles/revoke', [RoleController::class, 'revokeRole']);
                Route::get('/roles/{id}', [RoleController::class, 'show']);
                Route::get('/roles/{id}/permissions', [RoleController::class, 'getRolePermissions']);
            });
        });
    });
});
