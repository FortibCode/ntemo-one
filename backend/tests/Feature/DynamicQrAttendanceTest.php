<?php

namespace Tests\Feature;

use App\Models\AttendanceDevice;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DynamicQrAttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected AttendanceDevice $device;
    protected User $userEmployee;
    protected Employee $employee;
    protected AttendanceService $attendanceService;
    protected User $hrUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->attendanceService = app(AttendanceService::class);

        $this->org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'NTEMO Test Org',
            'slug' => 'ntemo-test',
            'is_active' => true,
        ]);

        $this->device = AttendanceDevice::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Borne Entrée Principale',
            'device_identifier' => 'KIOSK-ENTREE-01',
            'secret_key' => 'secret_hmac_key_test_12345',
            'type' => 'WALL_KIOSK',
            'is_active' => true,
        ]);

        $this->userEmployee = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Jean Collaborateur',
            'email' => 'jean@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $this->employee = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'user_id' => $this->userEmployee->id,
            'matricule' => 'NTM-2026-0001',
            'first_name' => 'Jean',
            'last_name' => 'Collaborateur',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);

        // Compte RH / borne : génère les QR et traite les régularisations
        $role = Role::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'RH',
            'slug' => 'rh_administration',
        ]);
        foreach (['attendance.scan_device', 'attendance.approve_correction'] as $slug) {
            $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => $slug, 'slug' => $slug, 'module' => 'attendance']);
            $role->permissions()->attach($perm->id);
        }
        $this->hrUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Awa RH',
            'email' => 'rh@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $this->hrUser->roles()->attach($role->id);
    }

    public function test_can_generate_15s_dynamic_qr_and_punch_successfully(): void
    {
        // 1. Générer le QR code pour la borne
        $qrData = $this->attendanceService->generateDynamicQr($this->device);

        $this->assertEquals(15, $qrData['validity_seconds']);
        $this->assertNotEmpty($qrData['token']);

        // 2. Scan et pointage par l'employé
        $response = $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', [
                'token' => $qrData['token'],
                'type' => 'IN',
                'latitude' => -4.2634,
                'longitude' => 15.2429,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.type', 'IN');

        // Vérification de la création de l'événement brut
        $this->assertDatabaseHas('attendance_events', [
            'organization_id' => $this->org->id,
            'employee_id' => $this->employee->id,
            'type' => 'IN',
            'source' => 'DYNAMIC_QR',
        ]);

        // Vérification de la synthèse du jour
        $this->assertDatabaseHas('attendance_days', [
            'organization_id' => $this->org->id,
            'employee_id' => $this->employee->id,
            'status' => 'PRESENT',
        ]);
    }

    public function test_anti_replay_protection_rejects_reusing_the_same_qr_token(): void
    {
        $qrData = $this->attendanceService->generateDynamicQr($this->device);

        // Premier pointage réussi
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', [
                'token' => $qrData['token'],
                'type' => 'IN',
            ])->assertStatus(201);

        // Deuxième tentative avec le même token (doit échouer)
        $replayResponse = $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', [
                'token' => $qrData['token'],
                'type' => 'IN',
            ]);

        $replayResponse->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_expired_qr_code_after_15_seconds_is_rejected(): void
    {
        $qrData = $this->attendanceService->generateDynamicQr($this->device);

        // Avancer le temps au-delà des 15 secondes
        Carbon::setTestNow(Carbon::now()->addSeconds(16));

        $response = $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', [
                'token' => $qrData['token'],
                'type' => 'IN',
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'success' => false,
                'message' => 'Le QR code a expiré. Veuillez rescanner le code dynamique en cours.',
            ]);

        Carbon::setTestNow(); // Reset
    }

    public function test_attendance_correction_workflow(): void
    {
        // 1. Demande de régularisation par l'employé
        $response = $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/corrections', [
                'date' => Carbon::now()->toDateString(),
                'requested_event_type' => 'IN',
                'requested_time' => '08:30',
                'reason' => 'Incident technique sur la borne d\'accueil.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'PENDING');

        $correctionId = $response->json('data.id');

        // 2. Le collaborateur ne peut ni lister ni valider les régularisations
        $this->actingAs($this->userEmployee, 'sanctum')
            ->getJson('/api/v1/attendance/corrections')
            ->assertStatus(403);
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson("/api/v1/attendance/corrections/{$correctionId}/review", ['action' => 'APPROVE'])
            ->assertStatus(403);

        // 3. Listing côté RH
        $this->actingAs($this->hrUser, 'sanctum')
            ->getJson('/api/v1/attendance/corrections')
            ->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'total'])
            ->assertJsonPath('data.0.employee.full_name', 'Jean Collaborateur')
            ->assertJsonPath('data.0.requested_time', '08:30');

        // 4. Approbation par la RH : le pointage est réellement régularisé
        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson("/api/v1/attendance/corrections/{$correctionId}/review", ['action' => 'APPROVE'])
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED_RH');

        $this->assertDatabaseHas('attendance_events', [
            'employee_id' => $this->employee->id,
            'type' => 'IN',
            'source' => 'MANUAL_OVERRIDE',
        ]);
        $day = \App\Models\AttendanceDay::where('employee_id', $this->employee->id)->first();
        $this->assertNotNull($day);
        // 08:30 heure de Brazzaville (UTC+1) = 07:30 UTC
        $this->assertSame('07:30', $day->first_check_in->copy()->setTimezone('UTC')->format('H:i'));

        // 5. Une demande déjà traitée ne peut pas l'être une seconde fois
        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson("/api/v1/attendance/corrections/{$correctionId}/review", ['action' => 'REJECT', 'reason' => 'x'])
            ->assertStatus(409);
    }

    public function test_reviewer_cannot_approve_own_correction(): void
    {
        $hrEmployee = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'user_id' => $this->hrUser->id,
            'matricule' => 'NTM-2026-0002',
            'first_name' => 'Awa',
            'last_name' => 'RH',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);

        $id = $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/attendance/corrections', [
                'date' => Carbon::now()->toDateString(),
                'requested_event_type' => 'OUT',
                'requested_time' => '17:00',
                'reason' => 'Oubli de pointage.',
            ])->json('data.id');

        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson("/api/v1/attendance/corrections/{$id}/review", ['action' => 'APPROVE'])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'SELF_REVIEW_FORBIDDEN');

        $this->assertDatabaseMissing('attendance_events', ['employee_id' => $hrEmployee->id]);
    }

    public function test_only_kiosk_accounts_can_generate_qr_sessions(): void
    {
        // Un collaborateur ne peut pas générer de QR pour pointer à distance
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/qr-session', ['device_identifier' => 'KIOSK-ENTREE-01'])
            ->assertStatus(403);

        $qr = $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/attendance/qr-session', ['device_identifier' => 'KIOSK-ENTREE-01'])
            ->assertOk()
            ->assertJsonPath('data.validity_seconds', 15)
            ->assertJsonPath('data.device.name', 'Borne Entrée Principale')
            ->json('data');

        $this->assertNotNull($this->device->fresh()->last_heartbeat_at);

        // Le collaborateur scanne le QR affiché par la borne
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', ['token' => $qr['token'], 'type' => 'IN'])
            ->assertCreated();

        $this->actingAs($this->hrUser, 'sanctum')
            ->getJson('/api/v1/attendance/devices')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonMissingPath('data.0.secret_key');

        // Borne désactivée → erreur métier explicite (pas d'erreur 500)
        $this->device->update(['is_active' => false]);
        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/attendance/qr-session', ['device_identifier' => 'KIOSK-ENTREE-01'])
            ->assertStatus(422);
    }

    public function test_lateness_break_and_local_day_are_computed(): void
    {
        $this->org->update(['settings' => ['attendance' => [
            'working_hours_start' => '08:00', 'working_hours_end' => '17:00',
            'lunch_break_start' => '12:00', 'lunch_break_end' => '13:00',
            'grace_period_minutes' => 15,
        ]]]);

        // Arrivée 08h40 heure de Brazzaville (07h40 UTC) : 40 min de retard (> 15 min de tolérance)
        Carbon::setTestNow(Carbon::parse('2026-11-16 08:40:00', 'Africa/Brazzaville'));
        $qr = $this->attendanceService->generateDynamicQr($this->device);
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', ['token' => $qr['token'], 'type' => 'IN'])->assertCreated();

        // Départ 17h30 : 8h50 de présence - 1h de pause = 7h50 effectives
        Carbon::setTestNow(Carbon::parse('2026-11-16 17:30:00', 'Africa/Brazzaville'));
        $qr = $this->attendanceService->generateDynamicQr($this->device);
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', ['token' => $qr['token'], 'type' => 'OUT'])->assertCreated();

        $day = \App\Models\AttendanceDay::where('employee_id', $this->employee->id)->firstOrFail();
        $this->assertSame('2026-11-16', $day->date->toDateString());
        $this->assertSame('LATE', $day->status);
        $this->assertSame(40, $day->late_minutes);
        $this->assertSame(60, $day->break_minutes);
        $this->assertSame(470, $day->worked_minutes);
        $this->assertSame(30, $day->overtime_minutes);
        $this->assertSame(480, $day->scheduled_minutes);

        // Pointage à 00h30 heure locale (23h30 UTC la veille) : compté pour le jour local
        Carbon::setTestNow(Carbon::parse('2026-11-18 00:30:00', 'Africa/Brazzaville'));
        $qr = $this->attendanceService->generateDynamicQr($this->device);
        $this->actingAs($this->userEmployee, 'sanctum')
            ->postJson('/api/v1/attendance/punch', ['token' => $qr['token'], 'type' => 'IN'])->assertCreated();
        $this->assertDatabaseHas('attendance_days', ['employee_id' => $this->employee->id, 'date' => '2026-11-18']);
    }
}
