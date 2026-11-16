<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GED administrative (cahier des charges §3.4) : pièces du dossier collaborateur
 * (CNI, CV, diplômes, contrats signés…), stockées sur le disque privé.
 *
 * Accès :
 *  - téléverser / supprimer : `documents.upload` ;
 *  - consulter toutes les pièces : `documents.read_confidential` ;
 *  - le collaborateur consulte ses propres pièces non confidentielles.
 */
class EmployeeDocumentController extends Controller
{
    public const CATEGORIES = ['CNI', 'PASSPORT', 'DIPLOMA', 'RESUME', 'MEDICAL', 'CONTRACT', 'OTHER'];
    public const MAX_KB = 10240; // 10 Mo

    public function __construct(
        protected AuditLogger $audit
    ) {}

    public function index(Request $request, string $employeeId): JsonResponse
    {
        $user = $request->user();
        $employee = $this->findEmployee($user, $employeeId);
        $canReadAll = $user->hasPermission('documents.read_confidential');
        $isSelf = $user->employee?->id === $employee->id;

        if (!$canReadAll && !$isSelf) {
            return $this->forbidden('Accès refusé au dossier de ce collaborateur.');
        }

        $docs = EmployeeDocument::where('employee_id', $employee->id)
            ->when(!$canReadAll, fn ($q) => $q->where('is_confidential', false))
            ->with('uploader:id,name')
            ->latest()
            ->get();

        $today = now()->toDateString();

        return response()->json([
            'success' => true,
            'data' => $docs->map(fn (EmployeeDocument $d) => [
                'id' => $d->id,
                'title' => $d->title,
                'category' => $d->category,
                'file_name' => $d->file_name,
                'mime_type' => $d->mime_type,
                'file_size' => $d->file_size,
                'expiration_date' => $d->expiration_date?->toDateString(),
                'is_expired' => $d->expiration_date && $d->expiration_date->toDateString() < $today,
                'is_confidential' => $d->is_confidential,
                'uploaded_by' => $d->uploader?->name,
                'created_at' => $d->created_at?->toISOString(),
            ]),
        ]);
    }

    public function store(Request $request, string $employeeId): JsonResponse
    {
        $user = $request->user();
        if (!$user->hasPermission('documents.upload')) {
            return $this->forbidden('Le téléversement de pièces RH requiert la permission « Téléverser des documents RH ».');
        }
        $employee = $this->findEmployee($user, $employeeId);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:' . self::MAX_KB, 'mimes:pdf,jpg,jpeg,png,webp,doc,docx'],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'expiration_date' => ['nullable', 'date'],
            'is_confidential' => ['nullable', 'boolean'],
        ]);

        $file = $request->file('file');
        $id = (string) Str::uuid();
        // Nom de stockage non devinable ; le nom d'origine n'est conservé qu'en métadonnée
        $extension = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension());
        $path = $file->storeAs("ged/{$employee->organization_id}/{$employee->id}", "{$id}.{$extension}", 'local');

        $document = EmployeeDocument::create([
            'id' => $id,
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'title' => $data['title'],
            'category' => $data['category'],
            'file_path' => $path,
            'file_name' => mb_substr(basename($file->getClientOriginalName()), 0, 255),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'file_size' => $file->getSize(),
            'expiration_date' => $data['expiration_date'] ?? null,
            'is_confidential' => $data['is_confidential'] ?? true,
            'uploaded_by' => $user->id,
        ]);

        $this->audit->record('ged.uploaded', $document, [
            'employee' => $employee->matricule,
            'title' => $document->title,
            'category' => $document->category,
            'sha256' => hash_file('sha256', Storage::disk('local')->path($path)),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pièce ajoutée au dossier.',
            'data' => ['id' => $document->id],
        ], Response::HTTP_CREATED);
    }

    public function download(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        $document = EmployeeDocument::where('organization_id', $user->organization_id)->findOrFail($id);

        $canReadAll = $user->hasPermission('documents.read_confidential');
        $isOwnPublic = $user->employee?->id === $document->employee_id && !$document->is_confidential;
        if (!$canReadAll && !$isOwnPublic) {
            return $this->forbidden('Accès confidentiel interdit à cette pièce.');
        }

        if (!Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['success' => false, 'message' => 'Fichier introuvable sur le stockage.'], Response::HTTP_NOT_FOUND);
        }

        $this->audit->record('ged.downloaded', $document, ['title' => $document->title]);

        return Storage::disk('local')->download($document->file_path, $document->file_name, [
            'Content-Type' => $document->mime_type,
            'Cache-Control' => 'no-store',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->hasPermission('documents.upload')) {
            return $this->forbidden('Suppression réservée aux gestionnaires RH.');
        }

        $document = EmployeeDocument::where('organization_id', $user->organization_id)->findOrFail($id);
        // Suppression logique : le fichier est conservé pour la traçabilité
        $document->delete();
        $this->audit->record('ged.deleted', $document, [], ['title' => $document->title, 'category' => $document->category]);

        return response()->json(['success' => true, 'message' => 'Pièce retirée du dossier.']);
    }

    private function findEmployee(User $user, string $id): Employee
    {
        return Employee::where('organization_id', $user->organization_id)->findOrFail($id);
    }

    private function forbidden(string $message): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'error_code' => 'FORBIDDEN_PERMISSION'], Response::HTTP_FORBIDDEN);
    }
}
