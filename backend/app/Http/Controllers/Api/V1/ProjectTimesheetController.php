<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Services\Audit\AuditLogger;
use App\Models\Project;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Services\ProjectTimesheetService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ProjectTimesheetController extends Controller
{
    public function __construct(
        protected ProjectTimesheetService $timesheetService
    ) {}

    /**
     * Liste des saisies de temps de l'organisation (Admin / Managers).
     */
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->denyUnlessApprover($request)) {
            return $denied;
        }

        $query = $this->scopedEntries($request)
            ->with(['employee.department', 'project', 'task', 'approver'])
            ->latest('date');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        return response()->json($query->paginate(25));
    }

    /**
     * Mes saisies de temps (Collaborateur connecté).
     */
    public function myTimeEntries(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['data' => []]);
        }

        $entries = TimeEntry::where('employee_id', $employee->id)
            ->with(['project', 'task', 'approver'])
            ->orderBy('date', 'desc')
            ->paginate(30);

        return response()->json($entries);
    }

    /**
     * Déclaration d'heures sur un projet/tâche.
     */
    public function storeTimeEntry(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => ['required', 'uuid', 'exists:projects,id'],
            'task_id' => ['nullable', 'uuid', 'exists:tasks,id'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'hours' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'description' => ['required', 'string', 'max:500'],
        ]);

        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun profil employé associé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $project = Project::where('id', $request->project_id)
            ->where('organization_id', $request->user()->organization_id)
            ->firstOrFail();

        $task = null;
        if ($request->task_id) {
            $task = Task::where('id', $request->task_id)
                ->where('project_id', $project->id)
                ->firstOrFail();
        }

        // Pas plus de 24 h déclarées sur une même journée (saisies non rejetées)
        $alreadyLogged = (float) TimeEntry::where('employee_id', $employee->id)
            ->whereDate('date', Carbon::parse($request->date)->toDateString())
            ->where('status', '!=', 'REJECTED')
            ->sum('hours');
        if ($alreadyLogged + (float) $request->hours > 24) {
            return response()->json([
                'success' => false,
                'message' => "Total journalier dépassé : {$alreadyLogged} h déjà déclarées ce jour-là (maximum 24 h).",
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $entry = $this->timesheetService->logTime(
            $employee,
            $project,
            Carbon::parse($request->date),
            (float) $request->hours,
            $request->description,
            $task
        );

        return response()->json([
            'success' => true,
            'message' => 'Heures déclarées avec succès.',
            'data' => $entry,
        ], Response::HTTP_CREATED);
    }

    /**
     * Approbation / Rejet d'une saisie de temps par le responsable.
     */
    public function reviewTimeEntry(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'action' => ['required', 'in:APPROVE,REJECT'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($denied = $this->denyUnlessApprover($request)) {
            return $denied;
        }

        // Hors de son périmètre (projet / équipe), la saisie n'existe pas pour le valideur
        $entry = $this->scopedEntries($request)->where('id', $id)->with('employee')->firstOrFail();

        if ($entry->employee?->user_id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas valider vos propres heures.',
                'error_code' => 'SELF_REVIEW_FORBIDDEN',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($entry->status !== 'SUBMITTED') {
            return response()->json([
                'success' => false,
                'message' => 'Cette saisie a déjà été traitée.',
                'error_code' => 'ALREADY_REVIEWED',
            ], Response::HTTP_CONFLICT);
        }

        if ($request->action === 'APPROVE') {
            $updated = $this->timesheetService->approveTimeEntry($entry, $request->user());
            $msg = 'Feuille de temps approuvée.';
            app(NotificationService::class)->notifyEmployee($entry->employee, 'TIMESHEET_DECISION', 'Heures validées',
                "{$entry->hours} h du " . \Carbon\Carbon::parse($entry->date)->format('d/m/Y') . ' ont été validées.', ['time_entry_id' => $entry->id], $request->user());
            app(AuditLogger::class)->record('timesheet.approved', $entry, ['hours' => $entry->hours, 'date' => (string) $entry->date]);
        } else {
            $request->validate(['reason' => ['required', 'string']]);
            $updated = $this->timesheetService->rejectTimeEntry($entry, $request->user(), $request->reason);
            $msg = 'Feuille de temps rejetée.';
            app(NotificationService::class)->notifyEmployee($entry->employee, 'TIMESHEET_DECISION', 'Heures rejetées',
                "{$entry->hours} h du " . \Carbon\Carbon::parse($entry->date)->format('d/m/Y') . " ont été rejetées. Motif : {$request->reason}", ['time_entry_id' => $entry->id], $request->user());
            app(AuditLogger::class)->record('timesheet.rejected', $entry, ['reason' => $request->reason]);
        }

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => $updated,
        ]);
    }

    /**
     * Périmètre de validation : toute l'organisation pour la RH / Direction,
     * sinon les saisies sur ses projets ou celles de ses collaborateurs directs.
     */
    private function scopedEntries(Request $request): Builder
    {
        $user = $request->user();
        $query = TimeEntry::where('time_entries.organization_id', $user->organization_id);

        if (!$user->hasPermission('employees.view_all')) {
            $me = $user->employee?->id;
            $query->where(function (Builder $q) use ($me) {
                $q->whereHas('project', fn ($p) => $p->where('project_manager_id', $me))
                    ->orWhereHas('employee', fn ($e) => $e->where('manager_id', $me));
            });
        }

        return $query;
    }

    private function denyUnlessApprover(Request $request): ?JsonResponse
    {
        if ($request->user()->hasPermission('timesheets.approve')) {
            return null;
        }

        return response()->json([
            'success' => false,
            'message' => 'La validation des feuilles de temps est réservée aux responsables.',
            'error_code' => 'FORBIDDEN_PERMISSION',
        ], Response::HTTP_FORBIDDEN);
    }
}
