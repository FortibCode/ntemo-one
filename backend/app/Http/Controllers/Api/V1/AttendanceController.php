<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceDevice;
use App\Models\AttendanceEvent;
use App\Models\AttendanceDay;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class AttendanceController extends Controller
{
    public function __construct(
        protected AttendanceService $attendanceService
    ) {}

    /**
     * Génération d'une session QR Code dynamique pour une borne ou un terminal agréé.
     */
    public function generateQrSession(Request $request): JsonResponse
    {
        $request->validate([
            'device_identifier' => ['required', 'string'],
        ]);

        $device = AttendanceDevice::where('device_identifier', $request->device_identifier)
            ->where('organization_id', $request->user()->organization_id)
            ->firstOrFail();

        try {
            $qrData = $this->attendanceService->generateDynamicQr($device);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Signal de vie de la borne (supervision)
        $device->forceFill(['last_heartbeat_at' => Carbon::now()])->save();

        return response()->json([
            'success' => true,
            'data' => $qrData + ['device' => ['name' => $device->name, 'identifier' => $device->device_identifier]],
        ]);
    }

    /**
     * Bornes de pointage actives de l'organisation (sélection sur l'écran borne).
     */
    public function devices(Request $request): JsonResponse
    {
        $devices = AttendanceDevice::where('organization_id', $request->user()->organization_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'device_identifier', 'type', 'last_heartbeat_at']);

        return response()->json([
            'success' => true,
            'data' => $devices,
        ]);
    }

    /**
     * Scan et validation de pointage par un collaborateur (Mobile / Web).
     */
    public function punch(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'type' => ['sometimes', 'in:IN,OUT,BREAK_IN,BREAK_OUT'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'device_meta' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun dossier collaborateur associé à ce compte.',
            ], Response::HTTP_FORBIDDEN);
        }

        try {
            $event = $this->attendanceService->recordPunch(
                $employee,
                $request->token,
                $request->input('type', 'IN'),
                $request->latitude ? (float) $request->latitude : null,
                $request->longitude ? (float) $request->longitude : null,
                $request->device_meta
            );

            return response()->json([
                'success' => true,
                'message' => 'Pointage enregistré avec succès.',
                'data' => [
                    'id' => $event->id,
                    'type' => $event->type,
                    'recorded_at' => $event->recorded_at->toISOString(),
                ],
            ], Response::HTTP_CREATED);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    /**
     * Historique des présences de l'employé connecté.
     */
    public function myAttendances(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['data' => []]);
        }

        $records = AttendanceDay::where('employee_id', $employee->id)
            ->orderBy('date', 'desc')
            ->limit(30)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $records,
        ]);
    }

    /**
     * Liste des demandes de régularisation (Admin / RH / Managers).
     */
    public function corrections(Request $request): JsonResponse
    {
        $query = AttendanceCorrection::where('organization_id', $request->user()->organization_id)
            ->with(['employee.department', 'reviewer'])
            ->latest('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $page = $query->paginate(25);
        $page->getCollection()->transform(fn (AttendanceCorrection $c) => [
            'id' => $c->id,
            'date' => $c->date?->toDateString(),
            'requested_event_type' => $c->requested_event_type,
            'requested_time' => substr((string) $c->requested_time, 0, 5),
            'reason' => $c->reason,
            'status' => $c->status,
            'rejection_reason' => $c->rejection_reason,
            'reviewed_at' => $c->reviewed_at?->toISOString(),
            'reviewer_name' => $c->reviewer?->name,
            'created_at' => $c->created_at?->toISOString(),
            'employee' => [
                'id' => $c->employee?->id,
                'full_name' => $c->employee?->full_name,
                'matricule' => $c->employee?->matricule,
                'department' => $c->employee?->department?->name,
            ],
        ]);

        return response()->json($page);
    }

    /**
     * Demande de régularisation de présence par un collaborateur.
     */
    public function requestCorrection(Request $request): JsonResponse
    {
        $request->validate([
            'date' => ['required', 'date', 'before_or_equal:today'],
            'requested_event_type' => ['required', 'in:IN,OUT'],
            'requested_time' => ['required', 'date_format:H:i'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun dossier collaborateur associé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $correction = AttendanceCorrection::create([
            'organization_id' => $request->user()->organization_id,
            'employee_id' => $employee->id,
            'date' => $request->date,
            'requested_event_type' => $request->requested_event_type,
            'requested_time' => $request->requested_time,
            'reason' => $request->reason,
            'status' => 'PENDING',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Demande de régularisation enregistrée avec succès.',
            'data' => $correction,
        ], Response::HTTP_CREATED);
    }

    /**
     * Examen d'une demande de régularisation (Approbation / Rejet).
     */
    public function reviewCorrection(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'action' => ['required', 'in:APPROVE,REJECT'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $correction = AttendanceCorrection::where('id', $id)
            ->where('organization_id', $request->user()->organization_id)
            ->with('employee.organization')
            ->firstOrFail();

        if ($correction->status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'message' => 'Cette demande a déjà été traitée.',
                'error_code' => 'ALREADY_REVIEWED',
            ], Response::HTTP_CONFLICT);
        }

        // Séparation des tâches : on ne valide jamais sa propre demande
        if ($correction->employee?->user_id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas traiter votre propre demande de régularisation.',
                'error_code' => 'SELF_REVIEW_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($request->action === 'APPROVE') {
            DB::transaction(function () use ($correction, $request) {
                $correction->update([
                    'status' => 'APPROVED_RH',
                    'reviewed_by' => $request->user()->id,
                    'reviewed_at' => Carbon::now(),
                ]);
                $this->attendanceService->applyApprovedCorrection($correction, $correction->employee);
            });

            $message = 'Demande approuvée : le pointage a été régularisé.';
            app(AuditLogger::class)->record('attendance.correction_approved', $correction, ['date' => $correction->date?->toDateString(), 'type' => $correction->requested_event_type, 'time' => $correction->requested_time]);
        } else {
            $request->validate(['reason' => ['required', 'string']]);
            $correction->update([
                'status' => 'REJECTED',
                'reviewed_by' => $request->user()->id,
                'rejection_reason' => $request->reason,
                'reviewed_at' => Carbon::now(),
            ]);

            $message = 'Demande de régularisation rejetée.';
            app(AuditLogger::class)->record('attendance.correction_rejected', $correction, ['reason' => $request->reason]);
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $correction,
        ]);
    }
}

