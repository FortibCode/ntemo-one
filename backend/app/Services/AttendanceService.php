<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceDevice;
use App\Models\AttendanceEvent;
use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\QrSession;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class AttendanceService
{
    public const QR_TTL_SECONDS = 15; // Exigence stricte de 15s

    /**
     * Génère un QR token dynamique à validité éphémère de 15 secondes pour un terminal.
     */
    public function generateDynamicQr(AttendanceDevice $device): array
    {
        if (!$device->is_active) {
            throw new InvalidArgumentException("Le terminal de pointage est inactif ou révoqué.");
        }

        $now = Carbon::now();
        $expiresAt = $now->copy()->addSeconds(self::QR_TTL_SECONDS);
        $nonce = Str::random(32);

        // Payload cryptographique : device_id|nonce|timestamp_expiration
        $payload = "{$device->id}|{$nonce}|{$expiresAt->timestamp}";
        $signature = hash_hmac('sha256', $payload, $device->secret_key);

        $qrSession = QrSession::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $device->organization_id,
            'device_id' => $device->id,
            'nonce' => $nonce,
            'token_signature' => $signature,
            'issued_at' => $now,
            'expires_at' => $expiresAt,
            'is_consumed' => false,
        ]);

        return [
            'token' => base64_encode("{$payload}|{$signature}"),
            'expires_at' => $expiresAt->toISOString(),
            'validity_seconds' => self::QR_TTL_SECONDS,
            'qr_session_id' => $qrSession->id,
        ];
    }

    /**
     * Valide le scan du QR code dynamique et enregistre le pointage brut immutable.
     */
    public function recordPunch(
        Employee $employee,
        string $rawToken,
        string $type = 'IN',
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $deviceMeta = null
    ): AttendanceEvent {
        $decoded = base64_decode($rawToken, true);
        if (!$decoded) {
            throw new InvalidArgumentException("Format du jeton de pointage invalide.");
        }

        $parts = explode('|', $decoded);
        if (count($parts) !== 4) {
            throw new InvalidArgumentException("Structure du jeton altérée.");
        }

        [$deviceId, $nonce, $expiresTimestamp, $signature] = $parts;

        return DB::transaction(function () use (
            $employee,
            $deviceId,
            $nonce,
            $expiresTimestamp,
            $signature,
            $type,
            $latitude,
            $longitude,
            $deviceMeta
        ) {
            $device = AttendanceDevice::where('id', $deviceId)
                ->where('organization_id', $employee->organization_id)
                ->first();

            if (!$device || !$device->is_active) {
                throw new InvalidArgumentException("Terminal de pointage inconnu ou inactif.");
            }

            // Vérification de la signature HMAC
            $payload = "{$deviceId}|{$nonce}|{$expiresTimestamp}";
            $expectedSignature = hash_hmac('sha256', $payload, $device->secret_key);

            if (!hash_equals($expectedSignature, $signature)) {
                throw new InvalidArgumentException("Signature de sécurité du QR code falsifiée.");
            }

            // Vérification de l'expiration stricte de 15s
            $now = Carbon::now();
            if ($now->timestamp > (int) $expiresTimestamp) {
                throw new InvalidArgumentException("Le QR code a expiré. Veuillez rescanner le code dynamique en cours.");
            }

            // Vérification anti-rejeu et consommation atomique
            $qrSession = QrSession::where('nonce', $nonce)
                ->where('device_id', $device->id)
                ->lockForUpdate()
                ->first();

            if (!$qrSession || $qrSession->is_consumed) {
                throw new InvalidArgumentException("Ce QR code a déjà été utilisé pour un pointage (anti-rejeu).");
            }

            $qrSession->update(['is_consumed' => true]);

            // Enregistrement de l'événement brut immutable
            $event = AttendanceEvent::create([
                'id' => (string) Str::uuid(),
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'device_id' => $device->id,
                'work_site_id' => $device->work_site_id,
                'qr_session_id' => $qrSession->id,
                'recorded_at' => $now,
                'type' => $type,
                'source' => 'DYNAMIC_QR',
                'latitude' => $latitude,
                'longitude' => $longitude,
                'device_meta' => $deviceMeta,
                'is_verified' => true,
            ]);

            // Mise à jour de la synthèse du jour
            $this->updateDailyAttendance($employee, $event);

            return $event;
        });
    }

    /**
     * Applique une régularisation approuvée : crée l'événement manquant (source MANUAL_OVERRIDE)
     * et recalcule la journée. L'heure demandée est exprimée dans le fuseau de l'organisation.
     */
    public function applyApprovedCorrection(AttendanceCorrection $correction, Employee $employee): AttendanceEvent
    {
        $timezone = $employee->organization?->timezone ?: 'Africa/Brazzaville';
        $date = $correction->date->toDateString();
        $time = substr((string) $correction->requested_time, 0, 5);

        $recordedAt = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$time}", $timezone)
            ->setTimezone(config('app.timezone'));

        $event = AttendanceEvent::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'recorded_at' => $recordedAt,
            'type' => $correction->requested_event_type,
            'source' => 'MANUAL_OVERRIDE',
            'device_meta' => "Régularisation {$correction->id}",
            'is_verified' => true,
        ]);

        $this->updateDailyAttendance($employee, $event, $date);

        return $event;
    }

    /**
     * Calcule et met à jour la synthèse de la journée sans jamais altérer les événements bruts.
     */
    protected function updateDailyAttendance(Employee $employee, AttendanceEvent $event, ?string $date = null): void
    {
        $employee->loadMissing('organization');
        $timezone = $this->timezoneFor($employee);

        // La journée est celle de l'organisation (et non UTC) : un pointage à 00h30 à Brazzaville compte pour le jour même
        $today = $date ?? $event->recorded_at->copy()->setTimezone($timezone)->toDateString();

        $dayRecord = AttendanceDay::firstOrCreate(
            [
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'date' => $today,
            ],
            [
                'id' => (string) Str::uuid(),
                'status' => 'PRESENT',
            ]
        );

        if ($event->type === 'IN' && (!$dayRecord->first_check_in || $event->recorded_at->isBefore($dayRecord->first_check_in))) {
            $dayRecord->first_check_in = $event->recorded_at;
        }

        if ($event->type === 'OUT' && (!$dayRecord->last_check_out || $event->recorded_at->isAfter($dayRecord->last_check_out))) {
            $dayRecord->last_check_out = $event->recorded_at;
        }

        // Une régularisation peut combler un oubli : la journée n'est plus en anomalie
        if ($event->source === 'MANUAL_OVERRIDE' && $dayRecord->first_check_in && $dayRecord->last_check_out) {
            $dayRecord->has_anomaly = false;
            $dayRecord->anomaly_reason = null;
        }

        $this->computeDayMetrics($dayRecord, $this->scheduleFor($employee, $today, $timezone));

        $dayRecord->save();
    }

    /**
     * Horaires du jour selon les paramètres de l'organisation (Paramètres → Pointage).
     *
     * @return array{start: Carbon, end: Carbon, lunch_start: Carbon, lunch_end: Carbon, grace: int}
     */
    public function scheduleFor(Employee $employee, string $date, ?string $timezone = null): array
    {
        $timezone ??= $this->timezoneFor($employee);
        $config = ($employee->organization?->settings['attendance'] ?? []) + [
            'working_hours_start' => '08:00',
            'working_hours_end' => '17:00',
            'lunch_break_start' => '12:00',
            'lunch_break_end' => '13:00',
            'grace_period_minutes' => 15,
        ];

        $at = fn (string $time) => Carbon::createFromFormat('Y-m-d H:i', "{$date} {$time}", $timezone)
            ->setTimezone(config('app.timezone'));

        return [
            'start' => $at($config['working_hours_start']),
            'end' => $at($config['working_hours_end']),
            'lunch_start' => $at($config['lunch_break_start']),
            'lunch_end' => $at($config['lunch_break_end']),
            'grace' => (int) $config['grace_period_minutes'],
        ];
    }

    /**
     * Retard, durée prévue, pause et temps de travail effectif de la journée.
     * Un retard est constaté au-delà de la tolérance ; il est alors compté depuis l'heure de début.
     */
    public function computeDayMetrics(AttendanceDay $day, array $schedule): void
    {
        $lunchMinutes = (int) $schedule['lunch_start']->diffInMinutes($schedule['lunch_end']);
        $day->scheduled_minutes = max(0, (int) $schedule['start']->diffInMinutes($schedule['end']) - $lunchMinutes);

        if ($day->first_check_in) {
            $lateBy = (int) $schedule['start']->diffInMinutes($day->first_check_in, false);
            $day->late_minutes = $lateBy > $schedule['grace'] ? $lateBy : 0;
            if ($day->status === 'PRESENT' || $day->status === 'LATE') {
                $day->status = $day->late_minutes > 0 ? 'LATE' : 'PRESENT';
            }
        }

        if ($day->first_check_in && $day->last_check_out && $day->last_check_out->gt($day->first_check_in)) {
            $span = (int) $day->first_check_in->diffInMinutes($day->last_check_out);

            // Chevauchement avec la pause déjeuner, déduit du temps effectif
            $overlapStart = $day->first_check_in->max($schedule['lunch_start']);
            $overlapEnd = $day->last_check_out->min($schedule['lunch_end']);
            $break = $overlapEnd->gt($overlapStart) ? (int) $overlapStart->diffInMinutes($overlapEnd) : 0;

            $day->break_minutes = $break;
            $day->worked_minutes = max(0, $span - $break);
            $day->early_departure_minutes = max(0, (int) $day->last_check_out->diffInMinutes($schedule['end'], false));
            $day->overtime_minutes = max(0, (int) $schedule['end']->diffInMinutes($day->last_check_out, false));
        }
    }

    private function timezoneFor(Employee $employee): string
    {
        return $employee->organization?->timezone ?: 'Africa/Brazzaville';
    }
}
