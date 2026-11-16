<?php

namespace App\Services;

use App\Models\DocumentGeneration;
use App\Models\DocumentTemplate;
use App\Models\DocumentTemplateVersion;
use App\Models\Employee;
use App\Models\User;
use App\Services\Documents\DocumentRenderer;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

class DocumentEngineService
{
    public function __construct(
        protected DocumentRenderer $renderer
    ) {}

    /**
     * Crée une nouvelle version pour un modèle documentaire.
     */
    public function createTemplateVersion(
        DocumentTemplate $template,
        string $content,
        string $versionNumber,
        ?User $creator = null,
        ?string $changelog = null
    ): DocumentTemplateVersion {
        return DB::transaction(function () use ($template, $content, $versionNumber, $creator, $changelog) {
            // Désactiver l'ancien indicateur is_current
            DocumentTemplateVersion::where('document_template_id', $template->id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            return DocumentTemplateVersion::create([
                'id' => (string) Str::uuid(),
                'document_template_id' => $template->id,
                'version_number' => $versionNumber,
                'content' => $content,
                'changelog' => $changelog,
                'created_by' => $creator?->id,
                'is_current' => true,
            ]);
        });
    }

    /**
     * Compile et fusionne le modèle avec les variables réelles (valeurs échappées).
     *
     * @throws \App\Services\Documents\MissingVariablesException
     */
    public function renderContent(string $templateContent, array $variables): string
    {
        return $this->renderer->merge($templateContent, $variables);
    }

    /**
     * Construit les variables disponibles pour un employé et son organisation.
     */
    public function buildEmployeeContext(Employee $employee): array
    {
        $employee->loadMissing(['organization', 'department', 'position', 'manager']);

        return [
            'organization.name' => $employee->organization->name,
            'organization.registration_number' => $employee->organization->registration_number ?? '',
            'organization.tax_number' => $employee->organization->tax_number ?? '',
            'organization.address' => $employee->organization->address ?? '',
            'organization.city' => $employee->organization->city ?? '',
            'organization.country' => $employee->organization->country ?? 'Congo',
            'employee.matricule' => $employee->matricule,
            'employee.first_name' => $employee->first_name,
            'employee.last_name' => $employee->last_name,
            'employee.full_name' => $employee->full_name,
            'employee.email' => $employee->email ?? '',
            'employee.phone' => $employee->phone ?? '',
            'employee.nationality' => $employee->nationality ?? '',
            'employee.national_id' => $employee->national_id_number ?? '',
            'employee.department' => $employee->department?->name ?? 'Direction Générale',
            'employee.position' => $employee->position?->title ?? 'Collaborateur',
            'employee.hire_date' => $employee->hire_date?->format('d/m/Y') ?? '',
            'current.date' => Carbon::now()->format('d/m/Y'),
            'current.year' => Carbon::now()->format('Y'),
        ];
    }

    /**
     * Génère et archive un document de manière sécurisée et vérifiable.
     */
    public function generateDocument(
        DocumentTemplateVersion $version,
        User $requester,
        ?Employee $employee = null,
        array $extraVariables = []
    ): DocumentGeneration {
        $template = $version->template;
        $organization = $requester->organization;

        // Préparer les variables contextuelles
        $variables = $employee ? $this->buildEmployeeContext($employee) : [];
        $variables = array_merge($variables, $extraVariables);

        $format = strtoupper($template->output_format);
        if (!in_array($format, DocumentRenderer::SUPPORTED_FORMATS, true)) {
            throw new InvalidArgumentException("Format « {$format} » non pris en charge pour les modèles (PDF, DOCX ou PPTX).");
        }

        // Fusion avant toute écriture : une variable manquante refuse la génération
        $compiledHtml = $this->renderContent($version->content, $variables);

        // Titre documentaire
        $docTitle = "{$template->title} - " . ($employee ? $employee->matricule : 'Global') . " - " . Carbon::now()->format('YmdHis');

        // Création de l'enregistrement de traçabilité
        $generation = DocumentGeneration::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $organization->id,
            'document_template_version_id' => $version->id,
            'employee_id' => $employee?->id,
            'requested_by' => $requester->id,
            'title' => $docTitle,
            'output_format' => $format,
            'status' => 'PROCESSING',
            'input_payload' => $variables,
        ]);

        try {
            // Rendu du fichier réel (PDF / DOCX) avec en-tête et référence de traçabilité
            $compiledContent = $this->renderer->render($format, $compiledHtml, [
                'title' => $template->title,
                'reference' => strtoupper(substr($generation->id, 0, 8)),
                'organization' => $organization->name,
            ]);

            // Stockage privé sécurisé
            $extension = strtolower($format);
            $fileName = "documents/{$organization->id}/{$generation->id}.{$extension}";
            
            Storage::disk('local')->put($fileName, $compiledContent);

            $fileSize = strlen($compiledContent);
            $sha256 = hash('sha256', $compiledContent);

            $generation->update([
                'status' => 'COMPLETED',
                'file_path' => $fileName,
                'file_size_bytes' => $fileSize,
                'file_hash_sha256' => $sha256,
                'generated_at' => Carbon::now(),
            ]);

            return $generation->fresh();
        } catch (\Throwable $e) {
            $generation->update([
                'status' => 'FAILED',
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}

