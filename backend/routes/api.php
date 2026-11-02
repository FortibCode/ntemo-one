<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\BadgeController;
use App\Http\Controllers\Api\V1\LeaveController;
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
            // Module Employés
            Route::apiResource('employees', EmployeeController::class);

            // Module Présences & Pointage QR Dynamique
            Route::post('/attendance/qr-session', [AttendanceController::class, 'generateQrSession']);
            Route::post('/attendance/punch', [AttendanceController::class, 'punch']);
            Route::get('/attendance/my-records', [AttendanceController::class, 'myAttendances']);

            // Module Badges Virtuels & Contrôle
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
        });
    });
});
