<?php

namespace Tests\Feature;

use App\Models\DocumentCategory;
use App\Models\DocumentTemplate;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\DocumentEngineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class DocumentEngineTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $hrUser;
    protected Employee $employee;
    protected DocumentTemplate $template;
    protected DocumentEngineService $documentEngineService;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->documentEngineService = app(DocumentEngineService::class);

        $this->org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'NTEMO Docs Org',
            'slug' => 'ntemo-docs',
            'is_active' => true,
        ]);

        $permDoc = Permission::create([
            'id' => (string) Str::uuid(),
            'name' => 'Generate Docs',
            'slug' => 'documents.generate',
            'module' => 'documents',
        ]);

        $roleHr = Role::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'HR Role',
            'slug' => 'hr_role',
        ]);
        $roleHr->permissions()->attach($permDoc->id);

        $this->hrUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'RH Document Manager',
            'email' => 'doc_manager@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $this->hrUser->roles()->attach($roleHr->id);

        $this->employee = Employee::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'matricule' => 'NTM-2026-0044',
            'first_name' => 'Sylvie',
            'last_name' => 'Makosso',
            'hire_date' => '2026-01-15',
            'status' => 'ACTIVE',
        ]);

        $category = DocumentCategory::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Attestations',
            'slug' => 'attestations',
        ]);

        $this->template = DocumentTemplate::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'document_category_id' => $category->id,
            'title' => 'Attestation de Travail',
            'code' => 'ATTEST_TRAVAIL',
            'output_format' => 'PDF',
            'is_active' => true,
        ]);

        // Création de la version v1.0 avec balises
        $this->documentEngineService->createTemplateVersion(
            $this->template,
            "ATTESTATION DE TRAVAIL\nNous certifions que Mme/M. {{employee.full_name}}, matricule {{employee.matricule}}, est employé(e) au sein de {{organization.name}} depuis le {{employee.hire_date}}.",
            'v1.0',
            $this->hrUser,
            'Version initiale officielle'
        );
    }

    public function test_can_generate_document_with_merged_variables_and_sha256_hash(): void
    {
        $response = $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', [
                'template_id' => $this->template->id,
                'employee_id' => $this->employee->id,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'COMPLETED');

        $docId = $response->json('data.id');
        $sha256 = $response->json('data.file_hash_sha256');

        $this->assertNotEmpty($sha256);
        $this->assertEquals(64, strlen($sha256));

        // Vérification de la persistance en base
        $this->assertDatabaseHas('document_generations', [
            'id' => $docId,
            'organization_id' => $this->org->id,
            'status' => 'COMPLETED',
        ]);

        // Vérification du fichier physique dans le disque privé
        $filePath = $response->json('data.file_path');
        Storage::disk('local')->assertExists($filePath);

        // Vrai fichier PDF (et non du texte renommé en .pdf)
        $savedContent = Storage::disk('local')->get($filePath);
        $this->assertStringStartsWith('%PDF-', $savedContent);
        $this->assertSame($sha256, hash('sha256', $savedContent));
        $this->assertStringEndsWith('.pdf', $filePath);

        // Le contenu fusionné contient bien les données du collaborateur
        $merged = $this->documentEngineService->renderContent(
            $this->template->currentVersion->content,
            $this->documentEngineService->buildEmployeeContext($this->employee)
        );
        $this->assertStringContainsString('Sylvie Makosso', $merged);
        $this->assertStringContainsString('NTM-2026-0044', $merged);
        $this->assertStringContainsString('NTEMO Docs Org', $merged);

        // Téléchargement
        $this->actingAs($this->hrUser, 'sanctum')
            ->get("/api/v1/documents/download/{$docId}")
            ->assertOk();
    }

    public function test_generates_a_real_docx_word_file(): void
    {
        $this->template->update(['output_format' => 'DOCX']);

        $response = $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', [
                'template_id' => $this->template->id,
                'employee_id' => $this->employee->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.output_format', 'DOCX');

        $path = Storage::disk('local')->path($response->json('data.file_path'));
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($path) === true, 'Le fichier .docx doit être une archive Office valide');
        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();

        $this->assertStringContainsString('Sylvie Makosso', $documentXml);
        $this->assertStringContainsString('NTM-2026-0044', $documentXml);
    }

    public function test_missing_variables_are_reported_and_nothing_is_generated(): void
    {
        $this->documentEngineService->createTemplateVersion(
            $this->template,
            '<p>Mission à {{mission.destination}} pour {{employee.full_name}}</p>',
            'v2.0',
            $this->hrUser
        );

        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', [
                'template_id' => $this->template->id,
                'employee_id' => $this->employee->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'MISSING_VARIABLES')
            ->assertJsonPath('missing_variables', ['mission.destination']);

        $this->assertDatabaseCount('document_generations', 0);

        $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', [
                'template_id' => $this->template->id,
                'employee_id' => $this->employee->id,
                'extra_variables' => ['mission.destination' => 'Pointe-Noire'],
            ])
            ->assertCreated();
    }

    public function test_variable_values_are_html_escaped(): void
    {
        $html = $this->documentEngineService->renderContent(
            '<p>{{ employee.full_name }}</p>',
            ['employee.full_name' => '<script>alert(1)</script>']
        );

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    public function test_unauthorized_user_cannot_generate_documents(): void
    {
        $simpleUser = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Employé Sans Droit Docs',
            'email' => 'simple@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $response = $this->actingAs($simpleUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', [
                'template_id' => $this->template->id,
                'employee_id' => $this->employee->id,
            ]);

        $response->assertStatus(403);
    }

    public function test_generates_a_real_pptx_presentation_from_html_sections(): void
    {
        $this->template->update(['output_format' => 'PPTX']);
        $this->documentEngineService->createTemplateVersion(
            $this->template,
            '<h1>Présentation {{employee.full_name}}</h1><p>Sous-titre</p><h2>Contexte</h2><p>Premier point</p>'
                . '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><h2>Suite</h2><ul><li>X</li><li>Y</li></ul>',
            'v3.0',
            $this->hrUser
        );

        $path = $this->actingAs($this->hrUser, 'sanctum')
            ->postJson('/api/v1/documents/generate', ['template_id' => $this->template->id, 'employee_id' => $this->employee->id])
            ->assertCreated()->assertJsonPath('data.output_format', 'PPTX')
            ->json('data.file_path');

        $zip = new \ZipArchive();
        $this->assertTrue($zip->open(Storage::disk('local')->path($path)) === true);
        $this->assertNotFalse($zip->getFromName('ppt/presentation.xml'));
        // Titre + « Contexte » + tableau « Contexte (suite) » + « Suite »
        $this->assertNotFalse($zip->getFromName('ppt/slides/slide4.xml'));
        $this->assertFalse($zip->getFromName('ppt/slides/slide5.xml'));
        $this->assertStringContainsString('Sylvie Makosso', $zip->getFromName('ppt/slides/slide1.xml'));
        $this->assertStringContainsString('Contexte (suite)', $zip->getFromName('ppt/slides/slide3.xml'));
        $this->assertNotFalse($zip->getFromName('ppt/media/logo.png'));
        $zip->close();
    }
}
