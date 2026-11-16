<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class HrAdminTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $admin;
    protected User $staff;
    protected Employee $newHire;
    protected Role $employeeRole;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org = Organization::create(['id' => (string) Str::uuid(), 'name' => 'NTEMO HR', 'slug' => 'ntemo-hr', 'is_active' => true]);

        $adminRole = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Direction', 'slug' => 'direction_generale']);
        foreach (['contracts.manage', 'departments.manage', 'positions.manage', 'roles.manage', 'employees.create_edit', 'employees.view_all'] as $slug) {
            $p = Permission::create(['id' => (string) Str::uuid(), 'name' => $slug, 'slug' => $slug, 'module' => 'hr']);
            $adminRole->permissions()->attach($p->id);
        }
        $this->employeeRole = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Collaborateur', 'slug' => 'employee']);

        $this->admin = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Admin', 'email' => 'admin@hr.local', 'password' => bcrypt('password'), 'is_active' => true]);
        $this->admin->roles()->attach($adminRole->id);
        $this->staff = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Staff', 'email' => 'staff@hr.local', 'password' => bcrypt('password'), 'is_active' => true]);

        $this->newHire = Employee::create([
            'id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'matricule' => 'NTM-HR-1',
            'first_name' => 'Nadia', 'last_name' => 'Ngoma', 'email' => 'nadia@hr.local', 'hire_date' => '2026-11-02', 'status' => 'ACTIVE',
        ]);
    }

    public function test_structure_and_cross_organization_references(): void
    {
        $deptId = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/departments', ['name' => 'Finance', 'code' => 'FIN'])->assertCreated()->json('data.id');
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/positions', ['title' => 'Comptable', 'department_id' => $deptId])->assertCreated();
        $this->actingAs($this->staff, 'sanctum')->postJson('/api/v1/departments', ['name' => 'X'])->assertStatus(403);

        $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/structure')
            ->assertOk()->assertJsonPath('data.departments.0.name', 'Finance')->assertJsonPath('data.positions.0.title', 'Comptable');

        // Un service d'une autre organisation est refusé
        $other = Organization::create(['id' => (string) Str::uuid(), 'name' => 'Autre', 'slug' => 'autre-hr', 'is_active' => true]);
        $foreign = Department::create(['id' => (string) Str::uuid(), 'organization_id' => $other->id, 'name' => 'Étranger', 'is_active' => true]);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/employees', ['first_name' => 'A', 'last_name' => 'B', 'hire_date' => '2026-11-16', 'department_id' => $foreign->id])
            ->assertStatus(422)->assertJsonValidationErrors(['department_id']);
    }

    public function test_contracts_replace_active_one_and_cdd_requires_end_date(): void
    {
        $base = "/api/v1/employees/{$this->newHire->id}/contracts";

        $this->actingAs($this->admin, 'sanctum')
            ->postJson($base, ['type' => 'CDD', 'start_date' => '2026-11-02'])
            ->assertStatus(422)->assertJsonValidationErrors(['end_date']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson($base, ['type' => 'CDD', 'start_date' => '2026-11-02', 'end_date' => '2027-05-01', 'probation_end_date' => '2026-12-02', 'gross_salary' => 450000])
            ->assertCreated()->assertJsonPath('data.status', 'ACTIVE');
        $this->assertSame('2026-12-02', $this->newHire->fresh()->probation_end_date->toDateString());

        $this->actingAs($this->admin, 'sanctum')
            ->postJson($base, ['type' => 'CDI', 'start_date' => '2027-05-02'])->assertCreated();

        $contracts = $this->actingAs($this->admin, 'sanctum')->getJson($base)->assertOk()->json('data');
        $this->assertSame(['CDI' => 'ACTIVE', 'CDD' => 'EXPIRED'], array_column($contracts, 'status', 'type'));

        $this->actingAs($this->staff, 'sanctum')->getJson($base)->assertStatus(403);
    }

    public function test_account_creation_returns_a_working_temporary_password_once(): void
    {
        $url = "/api/v1/employees/{$this->newHire->id}/account";

        $this->actingAs($this->staff, 'sanctum')->postJson($url, ['role_id' => $this->employeeRole->id])->assertStatus(403);

        $password = $this->actingAs($this->admin, 'sanctum')
            ->postJson($url, ['role_id' => $this->employeeRole->id])
            ->assertCreated()->assertJsonPath('data.email', 'nadia@hr.local')
            ->json('data.temporary_password');
        $this->assertSame(12, strlen($password));

        // Le collaborateur peut se connecter avec ce mot de passe et a le bon rôle
        $this->postJson('/api/v1/auth/login', ['email' => 'nadia@hr.local', 'password' => $password])
            ->assertOk()->assertJsonPath('data.user.roles.0', 'employee');

        // Pas de second compte
        $this->actingAs($this->admin, 'sanctum')->postJson($url, ['role_id' => $this->employeeRole->id])->assertStatus(409);

        // Le mot de passe n'est jamais journalisé
        $this->assertDatabaseHas('audit_logs', ['action' => 'account.created']);
        $this->assertStringNotContainsString($password, \App\Models\AuditLog::pluck('new_values')->toJson());
    }
}
