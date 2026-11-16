<?php

namespace Tests\Feature;

use App\Models\AttendanceDay;
use App\Models\Contract;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'NTEMO Analytics Org',
            'slug' => 'ntemo-analytics',
            'is_active' => true,
        ]);

        $this->adminUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Admin Analytics',
            'email' => 'admin_analytics@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => 'Dashboard', 'slug' => 'dashboard.view', 'module' => 'dashboard']);
        $role = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Direction', 'slug' => 'direction_generale']);
        $role->permissions()->attach($perm->id);
        $this->adminUser->roles()->attach($role->id);

        // Lundi 16/11/2026 à 10h00 (Brazzaville) : jour ouvré
        Carbon::setTestNow(Carbon::parse('2026-11-16 10:00:00', 'Africa/Brazzaville'));
    }

    public function test_can_retrieve_accurate_executive_kpis(): void
    {
        $today = '2026-11-16';

        // 1. Créer 2 employés actifs
        $emp1 = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'matricule' => 'NTM-2026-0001',
            'first_name' => 'Emp',
            'last_name' => 'Un',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);

        $emp2 = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'matricule' => 'NTM-2026-0002',
            'first_name' => 'Emp',
            'last_name' => 'Deux',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);

        // 2. Pointage du jour pour l'employé 1 (Présent)
        AttendanceDay::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'employee_id' => $emp1->id,
            'date' => $today,
            'status' => 'LATE',
            'first_check_in' => '2026-11-16 07:40:00', // 08h40 locale
            'late_minutes' => 40,
            'worked_minutes' => 480,
        ]);

        // Fin de période d'essai dans 10 jours → alerte contrat
        Contract::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'employee_id' => $emp2->id,
            'type' => 'CDD',
            'start_date' => '2026-10-01',
            'end_date' => '2027-03-31',
            'probation_end_date' => '2026-11-26',
            'status' => 'ACTIVE',
        ]);

        // 3. Projet avec heures
        $project = Project::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Projet Test',
            'start_date' => '2026-01-01',
            'status' => 'IN_PROGRESS',
        ]);

        TimeEntry::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'employee_id' => $emp1->id,
            'project_id' => $project->id,
            'date' => $today,
            'hours' => 8.0,
            'description' => 'Développement',
            'status' => 'APPROVED',
        ]);

        // Appel de l'endpoint
        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->getJson('/api/v1/dashboard/kpis');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.workforce.total_employees', 2)
            ->assertJsonPath('data.workforce.active_employees', 2)
            ->assertJsonPath('data.attendance.present_today', 1)
            ->assertJsonPath('data.attendance.attendance_rate_percentage', 50)
            ->assertJsonPath('data.projects.active_projects_count', 1)
            ->assertJsonPath('data.projects.approved_hours_this_month', 8)
            ->assertJsonPath('data.attendance.late_today', 1)
            ->assertJsonPath('data.attendance.absent_today', 1)
            ->assertJsonCount(7, 'data.attendance.trend')
            ->assertJsonPath('data.attendance.trend.6', ['date' => '2026-11-16', 'present' => 1, 'late' => 1])
            ->assertJsonPath('data.contract_alerts.0.kind', 'PROBATION_END')
            ->assertJsonPath('data.contract_alerts.0.days_left', 10)
            ->assertJsonPath('data.contract_alerts.0.employee.matricule', 'NTM-2026-0002');
    }

    public function test_dashboard_requires_permission(): void
    {
        $employee = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Collaborateur',
            'email' => 'collab@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $this->actingAs($employee, 'sanctum')->getJson('/api/v1/dashboard/kpis')->assertStatus(403);
    }
}

