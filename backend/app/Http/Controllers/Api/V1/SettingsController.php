<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Models\Organization;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SettingsController extends Controller
{
    /**
     * Clés de type liste : elles sont remplacées entièrement lors d'une mise à jour
     * (et non fusionnées index par index).
     */
    private const LIST_KEYS = ['working_days'];

    /**
     * Récupérer les paramètres de l'organisation.
     */
    public function index(Request $request): JsonResponse
    {
        $organization = $this->getOrganization($request);

        if (!$organization) {
            return $this->organizationNotFound();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'organization' => $this->organizationPayload($organization),
                'settings' => $this->resolvedSettings($organization),
            ],
        ]);
    }

    /**
     * Mettre à jour l'organisation et ses paramètres métier.
     */
    public function update(Request $request): JsonResponse
    {
        $organization = $this->getOrganization($request);

        if (!$organization) {
            return $this->organizationNotFound();
        }

        $validated = $request->validate([
            // Identité de l'organisation (colonnes dédiées)
            'organization' => ['nullable', 'array'],
            'organization.name' => ['sometimes', 'string', 'max:255'],
            'organization.email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'organization.phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'organization.address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'organization.city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'organization.country' => ['sometimes', 'nullable', 'string', 'max:120'],
            'organization.timezone' => ['sometimes', 'string', 'timezone'],
            'organization.currency' => ['sometimes', 'string', 'max:10'],

            // Paramètres métier (colonne JSON settings)
            'leave_quotas' => ['nullable', 'array'],
            'leave_quotas.*' => ['integer', 'min:0', 'max:365'],
            'leave_policy' => ['nullable', 'array'],
            'leave_policy.carry_over_enabled' => ['sometimes', 'boolean'],
            'leave_policy.carry_over_max_days' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'notification_preferences' => ['nullable', 'array'],
            'notification_preferences.email_enabled' => ['sometimes', 'boolean'],
            'notification_preferences.sms_enabled' => ['sometimes', 'boolean'],
            'notification_preferences.push_enabled' => ['sometimes', 'boolean'],
            'notification_preferences.digest_frequency' => ['sometimes', 'string', 'in:realtime,daily,weekly,off'],
            'working_days' => ['nullable', 'array', 'min:1'],
            'working_days.*' => ['string', 'distinct', 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday'],
        ]);

        $before = ['organization' => $this->organizationPayload($organization), 'settings' => $organization->settings ?? []];

        if (!empty($validated['organization'])) {
            $organization->fill($validated['organization']);
        }

        $settingsInput = array_intersect_key(
            $validated,
            array_flip(['leave_quotas', 'leave_policy', 'notification_preferences', 'working_days'])
        );
        $organization->settings = $this->mergeSettings($organization->settings ?? [], $settingsInput);
        $organization->save();
        [$old, $new] = app(AuditLogger::class)->diff($before, ['organization' => $this->organizationPayload($organization), 'settings' => $organization->settings]);
        if ($new) {
            app(AuditLogger::class)->record('settings.updated', $organization, $new, $old);
        }

        return response()->json([
            'success' => true,
            'message' => 'Paramètres mis à jour avec succès.',
            'data' => [
                'organization' => $this->organizationPayload($organization),
                'settings' => $this->resolvedSettings($organization),
            ],
        ]);
    }

    /**
     * Récupérer la configuration de présence (pointage).
     */
    public function getAttendanceConfig(Request $request): JsonResponse
    {
        $organization = $this->getOrganization($request);

        if (!$organization) {
            return $this->organizationNotFound();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'attendance' => $this->resolvedSettings($organization)['attendance'],
            ],
        ]);
    }

    /**
     * Mettre à jour la configuration de présence.
     *
     * La durée de validité du QR dynamique n'est volontairement pas modifiable :
     * elle est imposée par le moteur de pointage (exigence stricte de 15 secondes).
     */
    public function updateAttendanceConfig(Request $request): JsonResponse
    {
        $organization = $this->getOrganization($request);

        if (!$organization) {
            return $this->organizationNotFound();
        }

        $validated = $request->validate([
            'grace_period_minutes' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'working_hours_start' => ['sometimes', 'date_format:H:i'],
            'working_hours_end' => ['sometimes', 'date_format:H:i'],
            'lunch_break_start' => ['sometimes', 'date_format:H:i'],
            'lunch_break_end' => ['sometimes', 'date_format:H:i'],
            'auto_checkout_enabled' => ['sometimes', 'boolean'],
            'auto_checkout_time' => ['sometimes', 'date_format:H:i'],
            'geofencing_enabled' => ['sometimes', 'boolean'],
            'geofencing_radius_meters' => ['sometimes', 'integer', 'min:50', 'max:5000'],
        ]);

        $current = $this->resolvedSettings($organization)['attendance'];
        $merged = array_merge($current, $validated);

        // Cohérence des plages horaires (comparaison lexicographique valide en HH:MM)
        $errors = [];
        if ($merged['working_hours_end'] <= $merged['working_hours_start']) {
            $errors['working_hours_end'] = ['L\'heure de fin doit être postérieure à l\'heure de début.'];
        }
        if ($merged['lunch_break_end'] <= $merged['lunch_break_start']) {
            $errors['lunch_break_end'] = ['La fin de pause doit être postérieure à son début.'];
        }
        if ($merged['lunch_break_start'] < $merged['working_hours_start'] || $merged['lunch_break_end'] > $merged['working_hours_end']) {
            $errors['lunch_break_start'] = ['La pause déjeuner doit être comprise dans la journée de travail.'];
        }
        if ($errors) {
            return response()->json([
                'success' => false,
                'message' => 'Configuration horaire incohérente.',
                'errors' => $errors,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        unset($merged['qr_expiry_seconds']);
        [$old, $new] = app(AuditLogger::class)->diff($current, $merged);
        $organization->settings = $this->mergeSettings($organization->settings ?? [], ['attendance' => $merged]);
        $organization->save();
        if ($new) {
            app(AuditLogger::class)->record('settings.attendance_updated', $organization, $new, $old);
        }

        return response()->json([
            'success' => true,
            'message' => 'Configuration de présence mise à jour avec succès.',
            'data' => [
                'attendance' => $this->resolvedSettings($organization)['attendance'],
            ],
        ]);
    }

    /**
     * Récupérer l'organisation de l'utilisateur connecté.
     */
    private function getOrganization(Request $request): ?Organization
    {
        $user = $request->user();

        if (!$user || !$user->organization_id) {
            return null;
        }

        return $user->organization;
    }

    private function organizationNotFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Organisation non trouvée.',
            'error_code' => 'ORGANIZATION_NOT_FOUND',
        ], Response::HTTP_NOT_FOUND);
    }

    private function organizationPayload(Organization $organization): array
    {
        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'email' => $organization->email,
            'phone' => $organization->phone,
            'address' => $organization->address,
            'city' => $organization->city,
            'country' => $organization->country,
            'timezone' => $organization->timezone,
            'currency' => $organization->currency,
        ];
    }

    /**
     * Paramètres stockés complétés par les valeurs par défaut, avec les valeurs
     * imposées par le système (non surchargeables).
     */
    private function resolvedSettings(Organization $organization): array
    {
        $settings = $this->mergeSettings($this->defaultSettings(), $organization->settings ?? []);
        $settings['attendance']['qr_expiry_seconds'] = AttendanceService::QR_TTL_SECONDS;
        $settings['leave_policy']['approval_workflow'] = '2-tier';

        return $settings;
    }

    /**
     * Fusion profonde : les sous-tableaux associatifs sont fusionnés,
     * les listes (jours ouvrés…) sont remplacées.
     */
    private function mergeSettings(array $base, array $overrides): array
    {
        $merged = array_replace_recursive($base, $overrides);

        foreach (self::LIST_KEYS as $key) {
            if (array_key_exists($key, $overrides)) {
                $merged[$key] = array_values($overrides[$key]);
            }
        }

        return $merged;
    }

    private function defaultSettings(): array
    {
        return [
            'leave_quotas' => [
                'annual' => 30,
                'sick' => 15,
                'maternity' => 90,
                'paternity' => 10,
            ],
            'leave_policy' => [
                'carry_over_enabled' => true,
                'carry_over_max_days' => 5,
            ],
            'notification_preferences' => [
                'email_enabled' => true,
                'sms_enabled' => false,
                'push_enabled' => true,
                'digest_frequency' => 'daily',
            ],
            'working_days' => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            'attendance' => [
                'grace_period_minutes' => 15,
                'working_hours_start' => '08:00',
                'working_hours_end' => '17:00',
                'lunch_break_start' => '12:00',
                'lunch_break_end' => '13:00',
                'auto_checkout_enabled' => false,
                'auto_checkout_time' => '20:00',
                'geofencing_enabled' => false,
                'geofencing_radius_meters' => 200,
            ],
        ];
    }
}
