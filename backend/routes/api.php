<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\AttendanceController;
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
        });
    });
});
