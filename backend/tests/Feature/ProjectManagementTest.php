<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProjectManagementTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $pm;
    protected Employee $pmEmployee;
    protected User $otherPm;
    protected User $dev;
    protected Employee $devEmployee;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-16 10:00:00', 'Africa/Brazzaville'));

        $this->org = Organization::create(['id' => (string) Str::uuid(), 'name' => 'NTEMO PM', 'slug' => 'ntemo-pm', 'is_active' => true]);

        $manage = Permission::create(['id' => (string) Str::uuid(), 'name' => 'Gérer projets', 'slug' => 'projects.manage', 'module' => 'projects']);
        $pmRole = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'PM', 'slug' => 'project_manager']);
        $pmRole->permissions()->attach($manage->id);

        [$this->pm, $this->pmEmployee] = $this->person('pm@pm.local', 'NTM-PM-1');
        $this->pm->roles()->attach($pmRole->id);
        [$this->otherPm] = $this->person('pm2@pm.local', 'NTM-PM-2');
        $this->otherPm->roles()->attach($pmRole->id);
        [$this->dev, $this->devEmployee] = $this->person('dev@pm.local', 'NTM-DEV-1');
    }

    public function test_project_manager_creates_project_and_assigns_task_with_notification(): void
    {
        $this->actingAs($this->dev, 'sanctum')
            ->postJson('/api/v1/projects', ['name' => 'X', 'start_date' => '2026-11-16'])
            ->assertStatus(403);

        $projectId = $this->actingAs($this->pm, 'sanctum')
            ->postJson('/api/v1/projects', [
                'name' => 'Portail client',
                'code' => 'PRJ-PORTAIL',
                'start_date' => '2026-11-16',
                'end_date' => '2026-12-31',
                'status' => 'IN_PROGRESS',
            ])
            ->assertCreated()
            // Sans accès global, le créateur devient automatiquement responsable
            ->assertJsonPath('data.project_manager.id', $this->pmEmployee->id)
            ->json('data.id');

        $this->actingAs($this->pm, 'sanctum')
            ->postJson("/api/v1/projects/{$projectId}/tasks", [
                'title' => 'Maquettes',
                'assigned_to' => $this->devEmployee->id,
                'priority' => 'HIGH',
                'estimated_hours' => 12,
                'due_date' => '2026-11-10',
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_overdue', true);

        $this->assertDatabaseHas('notifications', ['user_id' => $this->dev->id, 'type' => 'TASK_ASSIGNED']);

        $this->actingAs($this->dev, 'sanctum')
            ->getJson("/api/v1/projects/{$projectId}")
            ->assertOk()
            ->assertJsonPath('data.stats.tasks_total', 1)
            ->assertJsonPath('data.stats.tasks_overdue', 1)
            ->assertJsonPath('data.can_manage', false)
            ->assertJsonPath('data.tasks.0.can_update_status', true);

        // Un autre responsable ne gère pas ce projet
        $this->actingAs($this->otherPm, 'sanctum')
            ->postJson("/api/v1/projects/{$projectId}/tasks", ['title' => 'Intrusion'])
            ->assertStatus(403);
    }

    public function test_assignee_can_only_change_task_status(): void
    {
        $project = $this->project();
        $taskId = $this->actingAs($this->pm, 'sanctum')
            ->postJson("/api/v1/projects/{$project->id}/tasks", ['title' => 'API', 'assigned_to' => $this->devEmployee->id])
            ->json('data.id');

        $this->actingAs($this->dev, 'sanctum')
            ->putJson("/api/v1/tasks/{$taskId}", ['status' => 'DONE', 'title' => 'Renommée'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DONE')
            ->assertJsonPath('data.title', 'API');

        $this->actingAs($this->dev, 'sanctum')
            ->getJson('/api/v1/tasks/mine')
            ->assertOk()
            ->assertJsonPath('data.0.project.name', 'Projet test');

        // Un collaborateur non assigné ne touche pas à la tâche
        [$stranger] = $this->person('x@pm.local', 'NTM-X');
        $this->actingAs($stranger, 'sanctum')->putJson("/api/v1/tasks/{$taskId}", ['status' => 'TODO'])->assertStatus(403);
    }

    public function test_task_with_logged_hours_cannot_be_deleted(): void
    {
        $project = $this->project();
        $taskId = $this->actingAs($this->pm, 'sanctum')
            ->postJson("/api/v1/projects/{$project->id}/tasks", ['title' => 'Audit'])
            ->json('data.id');

        TimeEntry::create([
            'id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'employee_id' => $this->devEmployee->id,
            'project_id' => $project->id, 'task_id' => $taskId, 'date' => '2026-11-16', 'hours' => 3,
            'description' => 'x', 'status' => 'APPROVED',
        ]);

        $this->actingAs($this->pm, 'sanctum')->deleteJson("/api/v1/tasks/{$taskId}")->assertStatus(409);

        $this->actingAs($this->pm, 'sanctum')
            ->getJson("/api/v1/projects/{$project->id}")
            ->assertJsonPath('data.stats.approved_hours', 3)
            ->assertJsonPath('data.tasks.0.approved_hours', 3);
    }

    public function test_project_report_is_a_powerpoint_for_the_manager_only(): void
    {
        $project = $this->project();
        $this->actingAs($this->pm, 'sanctum')
            ->postJson("/api/v1/projects/{$project->id}/tasks", ['title' => 'Recette', 'assigned_to' => $this->devEmployee->id, 'due_date' => '2026-11-01']);

        $this->actingAs($this->dev, 'sanctum')->getJson("/api/v1/projects/{$project->id}/report")->assertStatus(403);

        $response = $this->actingAs($this->pm, 'sanctum')->get("/api/v1/projects/{$project->id}/report");
        $response->assertOk();
        $this->assertStringContainsString('presentationml', $response->headers->get('Content-Type'));

        $tmp = tempnam(sys_get_temp_dir(), 'pptx');
        file_put_contents($tmp, $response->getContent());
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tmp) === true);
        $this->assertStringContainsString('Projet test', $zip->getFromName('ppt/slides/slide1.xml'));
        $this->assertStringContainsString('Recette', $zip->getFromName('ppt/slides/slide3.xml'));
        $this->assertStringContainsString('1 tâche(s) en retard', $zip->getFromName('ppt/slides/slide5.xml'));
        $zip->close();
        unlink($tmp);
    }

    private function project(): Project
    {
        return Project::create([
            'id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Projet test',
            'project_manager_id' => $this->pmEmployee->id, 'start_date' => '2026-11-01', 'status' => 'IN_PROGRESS',
        ]);
    }

    /** @return array{0: User, 1: Employee} */
    private function person(string $email, string $matricule): array
    {
        $user = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => $email, 'email' => $email, 'password' => bcrypt('p'), 'is_active' => true]);
        $employee = Employee::create([
            'id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'user_id' => $user->id,
            'matricule' => $matricule, 'first_name' => 'P', 'last_name' => $matricule, 'hire_date' => '2026-01-01', 'status' => 'ACTIVE',
        ]);

        return [$user, $employee];
    }
}
