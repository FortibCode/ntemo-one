<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class GedAndAuditTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $hr;
    protected User $staff;
    protected Employee $staffEmployee;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->org = Organization::create(['id' => (string) Str::uuid(), 'name' => 'NTEMO GED', 'slug' => 'ntemo-ged', 'is_active' => true]);

        $role = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'RH', 'slug' => 'rh']);
        foreach (['documents.upload', 'documents.read_confidential', 'audit.view'] as $slug) {
            $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => $slug, 'slug' => $slug, 'module' => 'documents']);
            $role->permissions()->attach($perm->id);
        }

        $this->hr = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'RH', 'email' => 'rh@ged.local', 'password' => bcrypt('password'), 'is_active' => true]);
        $this->hr->roles()->attach($role->id);

        $this->staff = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Staff', 'email' => 'staff@ged.local', 'password' => bcrypt('password'), 'is_active' => true]);
        $this->staffEmployee = Employee::create([
            'id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'user_id' => $this->staff->id,
            'matricule' => 'NTM-GED-1', 'first_name' => 'Ama', 'last_name' => 'Staff', 'hire_date' => '2026-01-01', 'status' => 'ACTIVE',
        ]);
    }

    public function test_hr_uploads_and_access_rules_apply(): void
    {
        $base = "/api/v1/employees/{$this->staffEmployee->id}/documents";

        // Le collaborateur ne téléverse pas
        $this->actingAs($this->staff, 'sanctum')
            ->post($base, ['file' => UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf'), 'title' => 'CV', 'category' => 'RESUME'])
            ->assertStatus(403);

        // Type de fichier refusé
        $this->actingAs($this->hr, 'sanctum')
            ->postJson($base, ['file' => UploadedFile::fake()->create('script.php', 1, 'application/x-php'), 'title' => 'X', 'category' => 'OTHER'])
            ->assertStatus(422)->assertJsonValidationErrors(['file']);

        $cniId = $this->actingAs($this->hr, 'sanctum')
            ->post($base, [
                'file' => UploadedFile::fake()->create('cni.pdf', 200, 'application/pdf'),
                'title' => 'Carte nationale d\'identité',
                'category' => 'CNI',
                'expiration_date' => '2027-01-31',
            ], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');

        $cvId = $this->actingAs($this->hr, 'sanctum')
            ->post($base, [
                'file' => UploadedFile::fake()->create('cv.pdf', 50, 'application/pdf'),
                'title' => 'CV',
                'category' => 'RESUME',
                'is_confidential' => '0',
            ], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');

        // RH : voit tout
        $this->actingAs($this->hr, 'sanctum')->getJson($base)->assertOk()->assertJsonCount(2, 'data');

        // Collaborateur : uniquement ses pièces non confidentielles
        $this->actingAs($this->staff, 'sanctum')->getJson($base)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'CV');
        $this->actingAs($this->staff, 'sanctum')->get("/api/v1/employee-documents/{$cvId}/download")->assertOk();
        $this->actingAs($this->staff, 'sanctum')->getJson("/api/v1/employee-documents/{$cniId}/download")->assertStatus(403);

        // Suppression logique, réservée à la RH
        $this->actingAs($this->staff, 'sanctum')->deleteJson("/api/v1/employee-documents/{$cvId}")->assertStatus(403);
        $this->actingAs($this->hr, 'sanctum')->deleteJson("/api/v1/employee-documents/{$cvId}")->assertOk();
        $this->assertSoftDeleted('employee_documents', ['id' => $cvId]);

        // Chaque action est tracée
        $actions = AuditLog::where('organization_id', $this->org->id)->pluck('action')->all();
        $this->assertContains('ged.uploaded', $actions);
        $this->assertContains('ged.downloaded', $actions);
        $this->assertContains('ged.deleted', $actions);
    }

    public function test_audit_log_records_login_and_is_restricted(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => 'staff@ged.local', 'password' => 'mauvais'])->assertStatus(422);
        $this->postJson('/api/v1/auth/login', ['email' => 'staff@ged.local', 'password' => 'password'])->assertOk();

        $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/audit-logs')->assertStatus(403);

        $logs = $this->actingAs($this->hr, 'sanctum')->getJson('/api/v1/audit-logs?module=auth')->assertOk()->json('data');
        $this->assertEqualsCanonicalizing(['auth.login', 'auth.login_failed'], array_column($logs, 'action'));

        // Aucun secret n'est recopié dans le journal
        $this->assertStringNotContainsString('mauvais', json_encode($logs));
    }
}
