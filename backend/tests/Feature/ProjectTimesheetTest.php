<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProjectTimesheetTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $managerUser;
    protected User $employeeUser;
    protected Employee $employee;
    protected Project $project;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'NTEMO Projects Org',
            'slug' => 'ntemo-projects',
            'is_active' => true,
        ]);

        $this->managerUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Chef de Projet',
            'email' => 'pm@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $this->employeeUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Ingénieur Dev',
            'email' => 'dev@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $this->employee = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'user_id' => $this->employeeUser->id,
            'matricule' => 'NTM-2026-0055',
            'first_name' => 'Ingénieur',
            'last_name' => 'Dev',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);

        // Le chef de projet a un dossier collaborateur et la permission de validation
        $managerEmployee = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'user_id' => $this->managerUser->id,
            'matricule' => 'NTM-2026-0050',
            'first_name' => 'Chef',
            'last_name' => 'Projet',
            'hire_date' => '2026-01-01',
            'status' => 'ACTIVE',
        ]);
        $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => 'Valider', 'slug' => 'timesheets.approve', 'module' => 'timesheets']);
        $role = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'PM', 'slug' => 'project_manager']);
        $role->permissions()->attach($perm->id);
        $this->managerUser->roles()->attach($role->id);

        $this->project = Project::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'project_manager_id' => $managerEmployee->id,
            'name' => 'Refonte SI NTEMO ONE',
            'code' => 'PRJ-N1-2026',
            'start_date' => '2026-01-01',
            'status' => 'IN_PROGRESS',
        ]);

        $this->task = Task::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'project_id' => $this->project->id,
            'assigned_to' => $this->employee->id,
            'title' => 'Développement API REST',
            'status' => 'IN_PROGRESS',
        ]);
    }

    public function test_can_log_time_and_manager_can_approve(): void
    {
        // 1. Saisie de temps par le collaborateur
        $response = $this->actingAs($this->employeeUser, 'sanctum')
            ->postJson('/api/v1/timesheets/log', [
                'project_id' => $this->project->id,
                'task_id' => $this->task->id,
                'date' => Carbon::now()->toDateString(),
                'hours' => 7.5,
                'description' => 'Conception et tests automatisés des endpoints API.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'SUBMITTED')
            ->assertJsonPath('data.hours', '7.50');

        $entryId = $response->json('data.id');

        // 2. Approbation par le chef de projet
        $reviewResponse = $this->actingAs($this->managerUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entryId}/review", [
                'action' => 'APPROVE',
            ]);

        $reviewResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertDatabaseHas('time_entries', [
            'id' => $entryId,
            'status' => 'APPROVED',
            'approved_by' => $this->managerUser->id,
        ]);
    }

    public function test_can_reject_timesheet_with_reason(): void
    {
        $entry = TimeEntry::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'employee_id' => $this->employee->id,
            'project_id' => $this->project->id,
            'date' => Carbon::now()->toDateString(),
            'hours' => 8.0,
            'description' => 'Travail non documenté.',
            'status' => 'SUBMITTED',
        ]);

        $rejectResponse = $this->actingAs($this->managerUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entry->id}/review", [
                'action' => 'REJECT',
                'reason' => 'Veuillez préciser la tâche associée.',
            ]);

        $rejectResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'REJECTED')
            ->assertJsonPath('data.rejection_reason', 'Veuillez préciser la tâche associée.');
    }

    public function test_can_list_timesheets_for_organization(): void
    {
        TimeEntry::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'employee_id' => $this->employee->id,
            'project_id' => $this->project->id,
            'date' => Carbon::now()->toDateString(),
            'hours' => 7.0,
            'description' => 'Développement NTEMO ONE',
            'status' => 'SUBMITTED',
        ]);

        $response = $this->actingAs($this->managerUser, 'sanctum')
            ->getJson('/api/v1/timesheets');

        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page', 'total']);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_review_rules_scope_and_self_approval(): void
    {
        $entryId = $this->actingAs($this->employeeUser, 'sanctum')
            ->postJson('/api/v1/timesheets/log', [
                'project_id' => $this->project->id,
                'date' => Carbon::now()->toDateString(),
                'hours' => 4,
                'description' => 'Revue de code.',
            ])->assertCreated()->json('data.id');

        // Le collaborateur ne liste ni ne valide
        $this->actingAs($this->employeeUser, 'sanctum')->getJson('/api/v1/timesheets')->assertStatus(403);
        $this->actingAs($this->employeeUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entryId}/review", ['action' => 'APPROVE'])->assertStatus(403);

        // Un autre responsable, hors périmètre (ni projet, ni équipe), ne voit pas la saisie
        $other = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Autre PM', 'email' => 'other@ntemo.local', 'password' => bcrypt('p'), 'is_active' => true]);
        Employee::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'user_id' => $other->id, 'matricule' => 'NTM-2026-0060', 'first_name' => 'Autre', 'last_name' => 'PM', 'hire_date' => '2026-01-01', 'status' => 'ACTIVE']);
        $other->roles()->attach(Role::where('slug', 'project_manager')->first()->id);
        $this->actingAs($other, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entryId}/review", ['action' => 'APPROVE'])->assertStatus(404);
        $this->assertCount(0, $this->actingAs($other, 'sanctum')->getJson('/api/v1/timesheets')->json('data'));

        // Le chef du projet valide, une seule fois
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entryId}/review", ['action' => 'APPROVE'])->assertOk();
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$entryId}/review", ['action' => 'APPROVE'])->assertStatus(409);

        // Le chef de projet ne valide pas ses propres heures
        $ownId = $this->actingAs($this->managerUser, 'sanctum')
            ->postJson('/api/v1/timesheets/log', [
                'project_id' => $this->project->id,
                'date' => Carbon::now()->toDateString(),
                'hours' => 2,
                'description' => 'Pilotage.',
            ])->assertCreated()->json('data.id');
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson("/api/v1/timesheets/{$ownId}/review", ['action' => 'APPROVE'])
            ->assertStatus(403)->assertJsonPath('error_code', 'SELF_REVIEW_FORBIDDEN');
    }

    public function test_time_logging_rejects_future_dates_and_over_24h_days(): void
    {
        $this->actingAs($this->employeeUser, 'sanctum')
            ->postJson('/api/v1/timesheets/log', [
                'project_id' => $this->project->id,
                'date' => Carbon::now()->addDays(2)->toDateString(),
                'hours' => 8,
                'description' => 'Anticipation.',
            ])->assertStatus(422);

        $payload = ['project_id' => $this->project->id, 'date' => Carbon::now()->toDateString(), 'description' => 'Travail.'];
        $this->actingAs($this->employeeUser, 'sanctum')->postJson('/api/v1/timesheets/log', $payload + ['hours' => 20])->assertCreated();
        $this->actingAs($this->employeeUser, 'sanctum')->postJson('/api/v1/timesheets/log', $payload + ['hours' => 5])->assertStatus(422);
    }
}
