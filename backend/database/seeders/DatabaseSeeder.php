<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
use App\Models\Employee;
use App\Models\AttendanceDevice;
use App\Models\LeaveType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Création ou récupération de l'Organisation Principale
        $organization = Organization::firstOrCreate(
            ['slug' => 'ntemo-consulting'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'NTEMO Consulting',
                'registration_number' => 'CG-BZV-01-2026-B12-0042',
                'tax_number' => 'M2026001234F',
                'email' => 'contact@ntemoconsulting.com',
                'phone' => '+242 06 000 0000',
                'country' => 'Congo',
                'city' => 'Brazzaville',
                'timezone' => 'Africa/Brazzaville',
                'currency' => 'XAF',
                'is_active' => true,
            ]
        );

        // 2. Création des Permissions Fondamentales
        $permissionsList = [
            // Employés & Organisation
            ['name' => 'Voir tous les employés', 'slug' => 'employees.view_all', 'module' => 'employees'],
            ['name' => 'Voir son équipe directe', 'slug' => 'employees.view_team', 'module' => 'employees'],
            ['name' => 'Voir son propre profil', 'slug' => 'employees.view_self', 'module' => 'employees'],
            ['name' => 'Créer et modifier des employés', 'slug' => 'employees.create_edit', 'module' => 'employees'],
            ['name' => 'Archiver / Supprimer des employés', 'slug' => 'employees.delete', 'module' => 'employees'],

            // Structure (Départements / Postes)
            ['name' => 'Gérer les départements', 'slug' => 'departments.manage', 'module' => 'structure'],
            ['name' => 'Gérer les postes', 'slug' => 'positions.manage', 'module' => 'structure'],

            // Contrats & Documents
            ['name' => 'Gérer les contrats de travail', 'slug' => 'contracts.manage', 'module' => 'contracts'],
            ['name' => 'Voir les documents confidentiels', 'slug' => 'documents.read_confidential', 'module' => 'documents'],
            ['name' => 'Téléverser des documents RH', 'slug' => 'documents.upload', 'module' => 'documents'],
            ['name' => 'Générer des documents', 'slug' => 'documents.generate', 'module' => 'documents'],

            // Présences & Pointage
            ['name' => 'Pointage personnel QR', 'slug' => 'attendance.point_self', 'module' => 'attendance'],
            ['name' => 'Scanner terminal de pointage', 'slug' => 'attendance.scan_device', 'module' => 'attendance'],
            ['name' => 'Voir les présences de l\'équipe', 'slug' => 'attendance.view_team', 'module' => 'attendance'],
            ['name' => 'Gérer toutes les présences', 'slug' => 'attendance.manage_all', 'module' => 'attendance'],
            ['name' => 'Demander régularisation présence', 'slug' => 'attendance.request_correction', 'module' => 'attendance'],
            ['name' => 'Approuver régularisation présence', 'slug' => 'attendance.approve_correction', 'module' => 'attendance'],

            // Badges
            ['name' => 'Gérer et révoquer les badges', 'slug' => 'badges.generate_revoke', 'module' => 'badges'],
            ['name' => 'Voir badge personnel', 'slug' => 'badges.view_self', 'module' => 'badges'],

            // Congés
            ['name' => 'Demander un congé', 'slug' => 'leaves.request_self', 'module' => 'leaves'],
            ['name' => 'Approbation N+1 congés', 'slug' => 'leaves.approve_n1', 'module' => 'leaves'],
            ['name' => 'Validation finale RH congés', 'slug' => 'leaves.approve_final_rh', 'module' => 'leaves'],

            // Projets & Feuilles de temps
            ['name' => 'Déclarer temps', 'slug' => 'timesheets.log_self', 'module' => 'timesheets'],
            ['name' => 'Valider feuilles de temps', 'slug' => 'timesheets.approve', 'module' => 'timesheets'],
            ['name' => 'Gérer projets', 'slug' => 'projects.manage', 'module' => 'projects'],

            // Audit & IA
            ['name' => 'Consulter les journaux d\'audit', 'slug' => 'audit.view', 'module' => 'audit'],
            ['name' => 'Utiliser assistant IA', 'slug' => 'ai.use', 'module' => 'ai'],

            // Administration
            ['name' => 'Modifier les paramètres de l\'organisation', 'slug' => 'settings.manage', 'module' => 'administration'],
            ['name' => 'Gérer les rôles et leur attribution', 'slug' => 'roles.manage', 'module' => 'administration'],
            ['name' => 'Consulter le tableau de bord de pilotage', 'slug' => 'dashboard.view', 'module' => 'dashboard'],
        ];

        $permissionModels = [];
        foreach ($permissionsList as $permData) {
            $permissionModels[$permData['slug']] = Permission::firstOrCreate(
                ['slug' => $permData['slug']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $permData['name'],
                    'module' => $permData['module'],
                ]
            );
        }

        // 3. Rôles Définis par le Cahier des Charges (Section 4)
        $roleSuperAdmin = Role::firstOrCreate(
            ['slug' => 'super_admin'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Super Administrateur',
                'description' => 'Administration système globale, sécurité et audit',
                'is_system' => true,
            ]
        );

        $roleDirection = Role::firstOrCreate(
            ['slug' => 'direction_generale', 'organization_id' => $organization->id],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Direction Générale',
                'description' => 'Supervision globale, validation contrats et rapports stratégiques',
                'is_system' => false,
            ]
        );

        $roleRH = Role::firstOrCreate(
            ['slug' => 'rh_administration', 'organization_id' => $organization->id],
            [
                'id' => (string) Str::uuid(),
                'name' => 'RH / Administration',
                'description' => 'Gestion des fiches employés, contrats, badges, congés et documents',
                'is_system' => false,
            ]
        );

        $roleManager = Role::firstOrCreate(
            ['slug' => 'project_manager', 'organization_id' => $organization->id],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Responsable de Projet',
                'description' => 'Suivi de présence de l\'équipe, validation feuilles de temps et congés N+1',
                'is_system' => false,
            ]
        );

        $roleEmployee = Role::firstOrCreate(
            ['slug' => 'employee', 'organization_id' => $organization->id],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Collaborateur',
                'description' => 'Badge virtuel, pointage QR, demandes de congé et temps de travail',
                'is_system' => false,
            ]
        );

        // 4. Attribution des Permissions aux Rôles
        $allPermissions = Permission::all();
        $roleSuperAdmin->permissions()->sync($allPermissions->pluck('id'));
        $roleDirection->permissions()->sync($allPermissions->pluck('id'));

        $rhPerms = $allPermissions->filter(fn($p) => in_array($p->module, ['employees', 'structure', 'contracts', 'documents', 'attendance', 'badges', 'leaves', 'ai', 'dashboard']));
        $roleRH->permissions()->sync($rhPerms->pluck('id'));

        $managerPerms = $allPermissions->filter(fn($p) => in_array($p->slug, [
            'employees.view_self', 'employees.view_team',
            'attendance.point_self', 'attendance.view_team', 'attendance.approve_correction',
            'leaves.request_self', 'leaves.approve_n1',
            'timesheets.log_self', 'timesheets.approve', 'projects.manage',
            'badges.view_self', 'ai.use',
        ]));
        $roleManager->permissions()->sync($managerPerms->pluck('id'));

        $empPerms = $allPermissions->filter(fn($p) => in_array($p->slug, [
            'employees.view_self',
            'attendance.point_self', 'attendance.request_correction',
            'leaves.request_self',
            'timesheets.log_self',
            'badges.view_self',
        ]));
        $roleEmployee->permissions()->sync($empPerms->pluck('id'));

        // 5. Départements & Postes NTEMO Consulting
        $depDir = Department::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'DIR'],
            ['id' => (string) Str::uuid(), 'name' => 'Direction Générale']
        );
        $depRH = Department::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'RH'],
            ['id' => (string) Str::uuid(), 'name' => 'Ressources Humaines & Administration']
        );
        $depTech = Department::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'TECH'],
            ['id' => (string) Str::uuid(), 'name' => 'Ingénierie & Projets Numériques']
        );

        $posDG = Position::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'POS-DG'],
            ['id' => (string) Str::uuid(), 'title' => 'Directeur Général']
        );
        $posRH = Position::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'POS-RH'],
            ['id' => (string) Str::uuid(), 'title' => 'Responsable Ressources Humaines']
        );
        $posLeadTech = Position::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'POS-TECH'],
            ['id' => (string) Str::uuid(), 'title' => 'Lead Tech & Suivi de Projets']
        );
        $posDev = Position::firstOrCreate(
            ['organization_id' => $organization->id, 'code' => 'POS-DEV'],
            ['id' => (string) Str::uuid(), 'title' => 'Ingénieur Logiciel Full-Stack']
        );

        // 6. Utilisateurs Clés pour les 5 Rôles du Cahier des Charges
        $usersConfig = [
            [
                'email' => 'admin@ntemo.com',
                'name' => 'Super Administrateur',
                'role' => $roleSuperAdmin,
                'matricule' => 'NTM-2026-000',
                'dep' => $depDir,
                'pos' => $posDG,
                'first' => 'Admin',
                'last' => 'NTEMO',
            ],
            [
                'email' => 'direction@ntemo.com',
                'name' => 'Glade NTOLANY (Direction / Lead Tech)',
                'role' => $roleDirection,
                'matricule' => 'NTM-2026-001',
                'dep' => $depDir,
                'pos' => $posLeadTech,
                'first' => 'Glade',
                'last' => 'NTOLANY',
            ],
            [
                'email' => 'rh@ntemo.com',
                'name' => 'Awa NDIAYE (Responsable RH)',
                'role' => $roleRH,
                'matricule' => 'NTM-2026-002',
                'dep' => $depRH,
                'pos' => $posRH,
                'first' => 'Awa',
                'last' => 'NDIAYE',
            ],
            [
                'email' => 'manager@ntemo.com',
                'name' => 'Jean MAVOUNGOU (Chef de Projet)',
                'role' => $roleManager,
                'matricule' => 'NTM-2026-003',
                'dep' => $depTech,
                'pos' => $posLeadTech,
                'first' => 'Jean',
                'last' => 'MAVOUNGOU',
            ],
            [
                'email' => 'collaborateur@ntemo.com',
                'name' => 'Koffi AMEGAN (Collaborateur)',
                'role' => $roleEmployee,
                'matricule' => 'NTM-2026-004',
                'dep' => $depTech,
                'pos' => $posDev,
                'first' => 'Koffi',
                'last' => 'AMEGAN',
            ],
        ];

        foreach ($usersConfig as $cfg) {
            $user = User::firstOrCreate(
                ['email' => $cfg['email']],
                [
                    'id' => (string) Str::uuid(),
                    'organization_id' => $organization->id,
                    'name' => $cfg['name'],
                    'password' => Hash::make('password'),
                    'is_active' => true,
                ]
            );

            $user->roles()->sync([$cfg['role']->id]);

            Employee::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'id' => (string) Str::uuid(),
                    'organization_id' => $organization->id,
                    'department_id' => $cfg['dep']->id,
                    'position_id' => $cfg['pos']->id,
                    'matricule' => $cfg['matricule'],
                    'first_name' => $cfg['first'],
                    'last_name' => $cfg['last'],
                    'email' => $cfg['email'],
                    'hire_date' => '2026-01-01',
                    'status' => 'ACTIVE',
                ]
            );
        }

        // 7. Borne de pointage d'accueil (QR dynamique 15 s)
        AttendanceDevice::firstOrCreate(
            ['device_identifier' => 'KIOSK-ENTREE-01'],
            [
                'id' => (string) Str::uuid(),
                'organization_id' => $organization->id,
                'name' => 'Borne Accueil — Entrée principale',
                'secret_key' => Str::random(64),
                'type' => 'WALL_KIOSK',
                'is_active' => true,
            ]
        );

        // 8. Types de congé (quotas surchargés par Paramètres → Congés)
        foreach ([
            ['code' => 'ANNUAL', 'name' => 'Congé annuel payé', 'days' => 30, 'paid' => true, 'n1' => true],
            ['code' => 'SICK', 'name' => 'Congé maladie', 'days' => 15, 'paid' => true, 'n1' => false, 'attachment' => true],
            ['code' => 'MATERNITY', 'name' => 'Congé maternité', 'days' => 90, 'paid' => true, 'n1' => false, 'attachment' => true],
            ['code' => 'PATERNITY', 'name' => 'Congé paternité', 'days' => 10, 'paid' => true, 'n1' => true],
            ['code' => 'EXCEPTIONAL', 'name' => 'Permission exceptionnelle (événement familial)', 'days' => 5, 'paid' => true, 'n1' => true],
            ['code' => 'UNPAID', 'name' => 'Congé sans solde', 'days' => 0, 'paid' => false, 'n1' => true],
        ] as $type) {
            LeaveType::firstOrCreate(
                ['organization_id' => $organization->id, 'code' => $type['code']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $type['name'],
                    'default_days_per_year' => $type['days'],
                    'is_paid' => $type['paid'],
                    'requires_attachment' => $type['attachment'] ?? false,
                    'requires_manager_approval' => $type['n1'],
                    'requires_hr_approval' => true,
                    'is_active' => true,
                ]
            );
        }

        // 9. Modèles documentaires officiels
        $this->callWith(DocumentTemplateSeeder::class, ['organization' => $organization]);

        // 10. Projets et tâches de démonstration
        $this->callWith(DemoProjectSeeder::class, ['organization' => $organization]);
    }
}
