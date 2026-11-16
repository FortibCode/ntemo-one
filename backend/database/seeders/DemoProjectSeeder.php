<?php

namespace Database\Seeders;

use App\Models\Contract;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Projets et tâches de démonstration (module Projets & Feuilles de temps).
 * Idempotent : un projet existant (même code) n'est pas recréé.
 */
class DemoProjectSeeder extends Seeder
{
    public function run(?Organization $organization = null): void
    {
        $organization ??= Organization::where('slug', 'ntemo-consulting')->firstOrFail();

        $manager = Employee::where('organization_id', $organization->id)->where('email', 'manager@ntemo.com')->first();
        $collaborator = Employee::where('organization_id', $organization->id)->where('email', 'collaborateur@ntemo.com')->first();

        // L'équipe du responsable de projet (périmètre de validation)
        if ($manager && $collaborator && !$collaborator->manager_id) {
            $collaborator->update(['manager_id' => $manager->id]);
        }

        // Contrats de démonstration (un CDD avec fin de période d'essai proche → alerte tableau de bord)
        foreach (Employee::where('organization_id', $organization->id)->get() as $employee) {
            if (Contract::where('employee_id', $employee->id)->exists()) {
                continue;
            }
            $isCdd = $employee->email === 'collaborateur@ntemo.com';
            Contract::create([
                'id' => (string) Str::uuid(),
                'organization_id' => $organization->id,
                'employee_id' => $employee->id,
                'type' => $isCdd ? 'CDD' : 'CDI',
                'start_date' => $isCdd ? '2026-09-01' : '2026-01-01',
                'end_date' => $isCdd ? '2027-08-31' : null,
                'probation_end_date' => $isCdd ? '2026-12-01' : null,
                'currency' => 'XAF',
                'status' => 'ACTIVE',
            ]);
        }

        $projects = [
            [
                'code' => 'PRJ-NTEMO-ONE',
                'name' => 'Plateforme NTEMO ONE',
                'description' => 'Conception et déploiement de la plateforme RH intégrée.',
                'start_date' => '2026-11-02',
                'end_date' => '2026-12-04',
                'tasks' => [
                    ['title' => 'API pointage QR dynamique', 'priority' => 'HIGH', 'estimated_hours' => 24, 'due_date' => '2026-11-20'],
                    ['title' => 'Application mobile Flutter', 'priority' => 'HIGH', 'estimated_hours' => 40, 'due_date' => '2026-11-27'],
                    ['title' => 'Recette et formation utilisateurs', 'priority' => 'MEDIUM', 'estimated_hours' => 16, 'due_date' => '2026-12-03'],
                ],
            ],
            [
                'code' => 'PRJ-AUDIT-ALPHA',
                'name' => 'Audit SI — Client Alpha',
                'description' => 'Audit de sécurité et recommandations pour le client Alpha.',
                'start_date' => '2026-11-09',
                'end_date' => '2026-12-18',
                'tasks' => [
                    ['title' => 'Cartographie applicative', 'priority' => 'MEDIUM', 'estimated_hours' => 12, 'due_date' => '2026-11-25'],
                    ['title' => 'Rapport d\'audit', 'priority' => 'HIGH', 'estimated_hours' => 20, 'due_date' => '2026-12-15'],
                ],
            ],
        ];

        foreach ($projects as $data) {
            $project = Project::firstOrCreate(
                ['organization_id' => $organization->id, 'code' => $data['code']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'project_manager_id' => $manager?->id,
                    'start_date' => $data['start_date'],
                    'end_date' => $data['end_date'],
                    'status' => 'IN_PROGRESS',
                ]
            );

            if ($project->wasRecentlyCreated) {
                foreach ($data['tasks'] as $task) {
                    Task::create($task + [
                        'id' => (string) Str::uuid(),
                        'organization_id' => $organization->id,
                        'project_id' => $project->id,
                        'assigned_to' => $collaborator?->id,
                        'status' => 'IN_PROGRESS',
                    ]);
                }
            }
        }
    }
}
