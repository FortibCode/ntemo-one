<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Models\Employee;
use App\Models\Project;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gestion des projets et des tâches (cahier des charges §3.5) :
 * suivi des projets, attribution des tâches, échéanciers et alertes de retard.
 *
 * Droits :
 *  - créer un projet : `projects.manage` ;
 *  - modifier un projet / gérer ses tâches : `projects.manage` ET (responsable du projet
 *    ou accès à tout le personnel, ex. Direction) ;
 *  - faire avancer une tâche : son assigné (statut uniquement) ou un gestionnaire du projet.
 */
class ProjectController extends Controller
{
    public const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
    public const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    public const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    public function __construct(
        protected NotificationService $notifications
    ) {}

    /**
     * Projets de l'organisation avec indicateurs d'avancement.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = $this->today($user);

        $projects = Project::where('organization_id', $user->organization_id)
            ->with(['projectManager:id,first_name,last_name,matricule', 'tasks'])
            ->orderByRaw("CASE status WHEN 'IN_PROGRESS' THEN 0 WHEN 'PLANNED' THEN 1 WHEN 'ON_HOLD' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get();

        $hours = TimeEntry::whereIn('project_id', $projects->pluck('id'))
            ->where('status', 'APPROVED')
            ->selectRaw('project_id, SUM(hours) as total')
            ->groupBy('project_id')
            ->pluck('total', 'project_id');

        return response()->json([
            'success' => true,
            'data' => $projects->map(fn (Project $p) => $this->projectPayload($p, $today, (float) ($hours[$p->id] ?? 0), $user)),
        ]);
    }

    /**
     * Détail d'un projet : tâches, assignés et heures consommées par tâche.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $project = $this->findProject($user, $id)->load(['projectManager:id,first_name,last_name,matricule', 'tasks.assignee:id,first_name,last_name,matricule']);
        $today = $this->today($user);

        $taskHours = TimeEntry::where('project_id', $project->id)
            ->where('status', 'APPROVED')
            ->whereNotNull('task_id')
            ->selectRaw('task_id, SUM(hours) as total')
            ->groupBy('task_id')
            ->pluck('total', 'task_id');
        $projectHours = (float) TimeEntry::where('project_id', $project->id)->where('status', 'APPROVED')->sum('hours');

        $payload = $this->projectPayload($project, $today, $projectHours, $user);
        $payload['tasks'] = $project->tasks
            ->sortBy(fn (Task $t) => [$t->status === 'DONE' ? 1 : 0, $t->due_date?->toDateString() ?? '9999-12-31'])
            ->values()
            ->map(fn (Task $t) => $this->taskPayload($t, $today, (float) ($taskHours[$t->id] ?? 0), $user, $project));

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->hasPermission('projects.manage')) {
            return $this->forbidden('La création de projets requiert la permission « Gérer projets ».');
        }

        $data = $request->validate($this->projectRules($user->organization_id));

        // Un responsable de projet sans accès global ne peut créer que ses propres projets
        if (!$user->hasPermission('employees.view_all')) {
            $data['project_manager_id'] = $user->employee?->id;
        }

        $project = Project::create($data + [
            'id' => (string) Str::uuid(),
            'organization_id' => $user->organization_id,
            'status' => $data['status'] ?? 'PLANNED',
        ]);

        app(AuditLogger::class)->record('project.created', $project, ['name' => $project->name, 'code' => $project->code]);

        return response()->json([
            'success' => true,
            'message' => 'Projet créé.',
            'data' => $this->projectPayload($project->load('projectManager', 'tasks'), $this->today($user), 0, $user),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $project = $this->findProject($user, $id);
        if (!$this->canManage($user, $project)) {
            return $this->forbidden('Seul le responsable du projet (ou la Direction) peut le modifier.');
        }

        $rules = array_map(fn ($r) => array_merge(['sometimes'], array_diff($r, ['required'])), $this->projectRules($user->organization_id, $project->id));
        $data = $request->validate($rules);

        if (!$user->hasPermission('employees.view_all')) {
            unset($data['project_manager_id']);
        }

        [$old, $new] = app(AuditLogger::class)->diff($project->only(array_keys($data)), $data);
        $project->update($data);
        if ($new) {
            app(AuditLogger::class)->record('project.updated', $project, $new, $old);
        }

        return response()->json([
            'success' => true,
            'message' => 'Projet mis à jour.',
            'data' => $this->projectPayload($project->fresh(['projectManager', 'tasks']), $this->today($user), 0, $user),
        ]);
    }

    public function storeTask(Request $request, string $projectId): JsonResponse
    {
        $user = $request->user();
        $project = $this->findProject($user, $projectId);
        if (!$this->canManage($user, $project)) {
            return $this->forbidden('Seul le responsable du projet (ou la Direction) peut attribuer des tâches.');
        }

        $data = $request->validate($this->taskRules($user->organization_id));
        $task = Task::create($data + [
            'id' => (string) Str::uuid(),
            'organization_id' => $user->organization_id,
            'project_id' => $project->id,
            'status' => $data['status'] ?? 'TODO',
            'priority' => $data['priority'] ?? 'MEDIUM',
        ]);

        $this->notifyAssignee($task, $project, $user);

        return response()->json([
            'success' => true,
            'message' => 'Tâche créée.',
            'data' => $this->taskPayload($task->load('assignee'), $this->today($user), 0, $user, $project),
        ], Response::HTTP_CREATED);
    }

    public function updateTask(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $task = Task::where('organization_id', $user->organization_id)->with('project')->findOrFail($id);
        $project = $task->project;
        $isManager = $this->canManage($user, $project);
        $isAssignee = $user->employee && $task->assigned_to === $user->employee->id;

        if (!$isManager && !$isAssignee) {
            return $this->forbidden('Vous ne pouvez modifier que les tâches qui vous sont attribuées.');
        }

        if ($isManager) {
            $rules = array_map(fn ($r) => array_merge(['sometimes'], array_diff($r, ['required'])), $this->taskRules($user->organization_id));
            $data = $request->validate($rules);
        } else {
            // L'assigné fait avancer sa tâche, sans modifier son périmètre
            $data = $request->validate(['status' => ['required', Rule::in(self::TASK_STATUSES)]]);
        }

        $previousAssignee = $task->assigned_to;
        $task->update($data);

        if ($task->assigned_to && $task->assigned_to !== $previousAssignee) {
            $this->notifyAssignee($task, $project, $user);
        }

        return response()->json([
            'success' => true,
            'message' => 'Tâche mise à jour.',
            'data' => $this->taskPayload($task->fresh('assignee'), $this->today($user), 0, $user, $project),
        ]);
    }

    public function destroyTask(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $task = Task::where('organization_id', $user->organization_id)->with('project')->findOrFail($id);
        if (!$this->canManage($user, $task->project)) {
            return $this->forbidden('Seul le responsable du projet (ou la Direction) peut supprimer une tâche.');
        }

        if ($task->timeEntries()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Des heures ont été déclarées sur cette tâche : passez-la plutôt au statut « Terminée ».',
            ], Response::HTTP_CONFLICT);
        }

        $task->delete();
        app(AuditLogger::class)->record('task.deleted', $task, [], ['title' => $task->title]);

        return response()->json(['success' => true, 'message' => 'Tâche supprimée.']);
    }

    /**
     * Mes tâches (toutes les tâches attribuées à l'utilisateur connecté).
     */
    public function myTasks(Request $request): JsonResponse
    {
        $user = $request->user();
        $employee = $user->employee;
        if (!$employee) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $today = $this->today($user);
        $tasks = Task::where('organization_id', $user->organization_id)
            ->where('assigned_to', $employee->id)
            ->with('project:id,name,code,status,project_manager_id')
            ->get()
            ->sortBy(fn (Task $t) => [$t->status === 'DONE' ? 1 : 0, $t->due_date?->toDateString() ?? '9999-12-31'])
            ->values();

        return response()->json([
            'success' => true,
            'data' => $tasks->map(fn (Task $t) => $this->taskPayload($t, $today, 0, $user, $t->project) + [
                'project' => ['id' => $t->project?->id, 'name' => $t->project?->name, 'code' => $t->project?->code],
            ]),
        ]);
    }

    // ---------------------------------------------------------------------

    private function projectRules(string $orgId, ?string $ignoreId = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50',
                Rule::unique('projects', 'code')->where('organization_id', $orgId)->ignore($ignoreId)],
            'description' => ['nullable', 'string', 'max:2000'],
            'project_manager_id' => ['nullable', 'uuid', Rule::exists('employees', 'id')->where('organization_id', $orgId)],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'status' => ['nullable', Rule::in(self::PROJECT_STATUSES)],
            'budget' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    private function taskRules(string $orgId): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'assigned_to' => ['nullable', 'uuid', Rule::exists('employees', 'id')->where('organization_id', $orgId)],
            'priority' => ['nullable', Rule::in(self::PRIORITIES)],
            'status' => ['nullable', Rule::in(self::TASK_STATUSES)],
            'estimated_hours' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'due_date' => ['nullable', 'date'],
        ];
    }

    private function findProject(User $user, string $id): Project
    {
        return Project::where('organization_id', $user->organization_id)->findOrFail($id);
    }

    private function canManage(User $user, ?Project $project): bool
    {
        if (!$project || !$user->hasPermission('projects.manage')) {
            return false;
        }

        return $user->hasPermission('employees.view_all')
            || ($user->employee && $project->project_manager_id === $user->employee->id);
    }

    private function today(User $user): string
    {
        return CarbonImmutable::now($user->organization?->timezone ?: 'Africa/Brazzaville')->toDateString();
    }

    private function isOverdue(Task $task, string $today): bool
    {
        return $task->status !== 'DONE' && $task->due_date && $task->due_date->toDateString() < $today;
    }

    private function projectPayload(Project $p, string $today, float $approvedHours, User $user): array
    {
        $tasks = $p->tasks;
        $done = $tasks->where('status', 'DONE')->count();

        return [
            'id' => $p->id,
            'name' => $p->name,
            'code' => $p->code,
            'description' => $p->description,
            'status' => $p->status,
            'start_date' => $p->start_date?->toDateString(),
            'end_date' => $p->end_date?->toDateString(),
            'budget' => $p->budget !== null ? (float) $p->budget : null,
            'currency' => $p->currency,
            'project_manager' => $p->projectManager ? [
                'id' => $p->projectManager->id,
                'full_name' => $p->projectManager->full_name,
                'matricule' => $p->projectManager->matricule,
            ] : null,
            'is_late' => $p->end_date && $p->end_date->toDateString() < $today && !in_array($p->status, ['COMPLETED', 'CANCELLED'], true),
            'can_manage' => $this->canManage($user, $p),
            'stats' => [
                'tasks_total' => $tasks->count(),
                'tasks_done' => $done,
                'tasks_overdue' => $tasks->filter(fn (Task $t) => $this->isOverdue($t, $today))->count(),
                'progress_percentage' => $tasks->count() ? (int) round($done / $tasks->count() * 100) : 0,
                'estimated_hours' => (float) $tasks->sum('estimated_hours'),
                'approved_hours' => $approvedHours,
            ],
            // Compatibilité (déclaration d'heures) : liste légère des tâches
            'tasks' => $tasks->map(fn (Task $t) => [
                'id' => $t->id,
                'title' => $t->title,
                'status' => $t->status,
                'assigned_to' => $t->assigned_to,
            ])->values(),
        ];
    }

    private function taskPayload(Task $t, string $today, float $approvedHours, User $user, ?Project $project): array
    {
        return [
            'id' => $t->id,
            'project_id' => $t->project_id,
            'title' => $t->title,
            'description' => $t->description,
            'priority' => $t->priority,
            'status' => $t->status,
            'estimated_hours' => $t->estimated_hours !== null ? (float) $t->estimated_hours : null,
            'approved_hours' => $approvedHours,
            'due_date' => $t->due_date?->toDateString(),
            'is_overdue' => $this->isOverdue($t, $today),
            'assignee' => $t->assignee ? [
                'id' => $t->assignee->id,
                'full_name' => $t->assignee->full_name,
                'matricule' => $t->assignee->matricule,
            ] : null,
            'can_manage' => $this->canManage($user, $project),
            'can_update_status' => $this->canManage($user, $project)
                || ($user->employee && $t->assigned_to === $user->employee->id),
        ];
    }

    private function notifyAssignee(Task $task, Project $project, User $actor): void
    {
        $assignee = $task->assigned_to ? Employee::with('user')->find($task->assigned_to) : null;
        if (!$assignee?->user || $assignee->user->id === $actor->id) {
            return;
        }

        $due = $task->due_date ? ' — échéance le ' . $task->due_date->format('d/m/Y') : '';
        $this->notifications->send(
            $assignee->user,
            'TASK_ASSIGNED',
            'Nouvelle tâche attribuée',
            "« {$task->title} » sur le projet {$project->name}{$due}.",
            ['task_id' => $task->id, 'project_id' => $project->id]
        );
    }

    private function forbidden(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'error_code' => 'FORBIDDEN_PERMISSION',
        ], Response::HTTP_FORBIDDEN);
    }
}
