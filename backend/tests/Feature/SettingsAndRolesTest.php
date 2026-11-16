<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettingsAndRolesTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected Organization $otherOrg;
    protected User $admin;
    protected User $employee;
    protected Role $adminRole;
    protected Role $employeeRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->org = $this->makeOrg('NTEMO Settings', 'ntemo-settings');
        $this->otherOrg = $this->makeOrg('Autre Org', 'autre-org');

        $permSettings = $this->makePermission('settings.manage', 'administration');
        $permRoles = $this->makePermission('roles.manage', 'administration');
        $permSelf = $this->makePermission('employees.view_self', 'employees');

        $this->adminRole = $this->makeRole($this->org, 'direction_generale', 'Direction Générale');
        $this->adminRole->permissions()->attach([$permSettings->id, $permRoles->id, $permSelf->id]);

        $this->employeeRole = $this->makeRole($this->org, 'employee', 'Collaborateur');
        $this->employeeRole->permissions()->attach([$permSelf->id]);

        $this->admin = $this->makeUser($this->org, 'admin@ntemo.local');
        $this->admin->roles()->attach($this->adminRole->id);

        $this->employee = $this->makeUser($this->org, 'emp@ntemo.local');
        $this->employee->roles()->attach($this->employeeRole->id);
    }

    public function test_employee_cannot_escalate_privileges_by_assigning_roles(): void
    {
        $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/v1/roles/assign', [
                'user_id' => $this->employee->id,
                'role_id' => $this->adminRole->id,
            ])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN_PERMISSION');

        $this->assertFalse($this->employee->fresh()->hasRole('direction_generale'));
    }

    public function test_employee_cannot_list_roles_or_update_settings(): void
    {
        $this->actingAs($this->employee, 'sanctum')->getJson('/api/v1/roles')->assertStatus(403);
        $this->actingAs($this->employee, 'sanctum')
            ->putJson('/api/v1/settings', ['organization' => ['name' => 'Piraté']])
            ->assertStatus(403);
        $this->actingAs($this->employee, 'sanctum')
            ->putJson('/api/v1/settings/attendance', ['grace_period_minutes' => 60])
            ->assertStatus(403);

        $this->assertSame('NTEMO Settings', $this->org->fresh()->name);
    }

    public function test_employee_can_read_settings_with_defaults(): void
    {
        $this->actingAs($this->employee, 'sanctum')
            ->getJson('/api/v1/settings')
            ->assertOk()
            ->assertJsonPath('data.organization.name', 'NTEMO Settings')
            ->assertJsonPath('data.settings.attendance.qr_expiry_seconds', 15)
            ->assertJsonPath('data.settings.leave_quotas.annual', 30);
    }

    public function test_admin_lists_roles_with_permissions_scoped_to_organization(): void
    {
        $this->makeRole($this->otherOrg, 'employee', 'Rôle étranger');

        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/roles')->assertOk();

        $slugs = collect($response->json('data'))->pluck('slug');
        $this->assertEqualsCanonicalizing(['direction_generale', 'employee'], $slugs->all());

        $adminRow = collect($response->json('data'))->firstWhere('slug', 'direction_generale');
        $this->assertContains('roles.manage', $adminRow['permissions']);
        $this->assertSame(1, $adminRow['users_count']);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/permissions')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_assigns_and_revokes_role(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles/assign', [
                'user_id' => $this->employee->id,
                'role_id' => $this->adminRole->id,
            ])
            ->assertOk();
        $this->assertTrue($this->employee->fresh()->hasRole('direction_generale'));

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles/revoke', [
                'user_id' => $this->employee->id,
                'role_id' => $this->adminRole->id,
            ])
            ->assertOk();
        $this->assertFalse($this->employee->fresh()->hasRole('direction_generale'));
    }

    public function test_admin_cannot_revoke_own_role_or_touch_other_organization(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles/revoke', [
                'user_id' => $this->admin->id,
                'role_id' => $this->adminRole->id,
            ])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'SELF_REVOKE_FORBIDDEN');

        $outsider = $this->makeUser($this->otherOrg, 'outsider@autre.local');
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles/assign', [
                'user_id' => $outsider->id,
                'role_id' => $this->employeeRole->id,
            ])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'CROSS_ORG_FORBIDDEN');
    }

    public function test_admin_updates_settings_with_deep_merge(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/v1/settings', [
                'organization' => ['name' => 'NTEMO Consulting', 'timezone' => 'Africa/Brazzaville'],
                'leave_quotas' => ['annual' => 26],
                'notification_preferences' => ['sms_enabled' => true],
                'working_days' => ['monday', 'tuesday'],
            ])
            ->assertOk()
            ->assertJsonPath('data.organization.name', 'NTEMO Consulting')
            ->assertJsonPath('data.settings.leave_quotas.annual', 26)
            // Les autres clés du sous-tableau sont conservées
            ->assertJsonPath('data.settings.leave_quotas.sick', 15)
            ->assertJsonPath('data.settings.notification_preferences.sms_enabled', true)
            ->assertJsonPath('data.settings.notification_preferences.email_enabled', true)
            ->assertJsonPath('data.settings.working_days', ['monday', 'tuesday']);

        $this->assertSame('Africa/Brazzaville', $this->org->fresh()->timezone);
    }

    public function test_attendance_config_rejects_incoherent_hours_and_keeps_qr_ttl_fixed(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/v1/settings/attendance', [
                'working_hours_start' => '18:00',
                'working_hours_end' => '08:00',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['working_hours_end']);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/v1/settings/attendance', [
                'grace_period_minutes' => 5,
                'qr_expiry_seconds' => 600,
            ])
            ->assertOk()
            ->assertJsonPath('data.attendance.grace_period_minutes', 5)
            ->assertJsonPath('data.attendance.qr_expiry_seconds', 15);
    }

    public function test_login_returns_permissions_and_employee_position(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ntemo.local',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('data.user.role_name', 'Direction Générale')
            ->assertJsonFragment(['roles.manage']);
    }

    private function makeOrg(string $name, string $slug): Organization
    {
        return Organization::create([
            'id' => (string) Str::uuid(),
            'name' => $name,
            'slug' => $slug,
            'is_active' => true,
        ]);
    }

    private function makePermission(string $slug, string $module): Permission
    {
        return Permission::create([
            'id' => (string) Str::uuid(),
            'name' => $slug,
            'slug' => $slug,
            'module' => $module,
        ]);
    }

    private function makeRole(Organization $org, string $slug, string $name): Role
    {
        return Role::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $org->id,
            'name' => $name,
            'slug' => $slug,
        ]);
    }

    private function makeUser(Organization $org, string $email): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $org->id,
            'name' => $email,
            'email' => $email,
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
    }
}
