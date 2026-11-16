<?php

namespace Database\Seeders;

use App\Models\DocumentCategory;
use App\Models\DocumentTemplate;
use App\Models\DocumentTemplateVersion;
use App\Models\Organization;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Modèles documentaires officiels NTEMO (cahier des charges §3.3).
 *
 * Contenu : HTML balisé {{variable}}. Les variables « employee.* », « organization.* »
 * et « current.* » sont remplies automatiquement ; `available_variables` décrit les
 * champs complémentaires à saisir lors de la génération.
 *
 * Idempotent : un modèle existant (même code) n'est pas modifié.
 */
class DocumentTemplateSeeder extends Seeder
{
    public function run(?Organization $organization = null): void
    {
        $organization ??= Organization::where('slug', 'ntemo-consulting')->firstOrFail();

        $categories = [];
        foreach ([
            'attestations' => 'Attestations & certificats',
            'missions' => 'Ordres de mission',
            'contrats' => 'Contrats RH',
            'courriers' => 'Courriers administratifs',
            'presentations' => 'Présentations',
        ] as $slug => $name) {
            $categories[$slug] = DocumentCategory::firstOrCreate(
                ['organization_id' => $organization->id, 'slug' => $slug],
                ['id' => (string) Str::uuid(), 'name' => $name]
            );
        }

        foreach ($this->templates() as $tpl) {
            $template = DocumentTemplate::firstOrCreate(
                ['organization_id' => $organization->id, 'code' => $tpl['code']],
                [
                    'id' => (string) Str::uuid(),
                    'document_category_id' => $categories[$tpl['category']]->id,
                    'title' => $tpl['title'],
                    'output_format' => $tpl['format'],
                    'description' => $tpl['description'],
                    'available_variables' => $tpl['fields'],
                    'is_active' => true,
                ]
            );

            if (!$template->versions()->exists()) {
                DocumentTemplateVersion::create([
                    'id' => (string) Str::uuid(),
                    'document_template_id' => $template->id,
                    'version_number' => 'v1.0',
                    'content' => $tpl['content'],
                    'changelog' => 'Version initiale',
                    'is_current' => true,
                ]);
            }
        }
    }

    private function templates(): array
    {
        $attestation = <<<'HTML'
<h1>ATTESTATION DE TRAVAIL</h1>
<p>Je soussigné(e), représentant légal de <strong>{{organization.name}}</strong>, société immatriculée sous le numéro {{organization.registration_number}}, dont le siège est situé à {{organization.city}} ({{organization.country}}),</p>
<p>atteste par la présente que <strong>{{employee.full_name}}</strong>, matricule <strong>{{employee.matricule}}</strong>, est employé(e) au sein de notre société depuis le <strong>{{employee.hire_date}}</strong> en qualité de <strong>{{employee.position}}</strong>, rattaché(e) au service {{employee.department}}.</p>
<p>La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>
<p class="signature">Fait à {{organization.city}}, le {{current.date}}<br>La Direction</p>
HTML;

        return [
            [
                'code' => 'ATTESTATION_TRAVAIL',
                'category' => 'attestations',
                'title' => 'Attestation de travail',
                'format' => 'PDF',
                'description' => 'Attestation d\'emploi officielle au format PDF.',
                'fields' => [],
                'content' => $attestation,
            ],
            [
                'code' => 'ATTESTATION_TRAVAIL_DOCX',
                'category' => 'attestations',
                'title' => 'Attestation de travail (Word modifiable)',
                'format' => 'DOCX',
                'description' => 'Même attestation, éditable dans Word avant signature.',
                'fields' => [],
                'content' => $attestation,
            ],
            [
                'code' => 'ORDRE_MISSION',
                'category' => 'missions',
                'title' => 'Ordre de mission',
                'format' => 'DOCX',
                'description' => 'Ordre de mission pour un déplacement professionnel.',
                'fields' => [
                    ['key' => 'mission.objet', 'label' => 'Objet de la mission', 'type' => 'text'],
                    ['key' => 'mission.destination', 'label' => 'Destination', 'type' => 'text'],
                    ['key' => 'mission.date_debut', 'label' => 'Date de départ', 'type' => 'date'],
                    ['key' => 'mission.date_fin', 'label' => 'Date de retour', 'type' => 'date'],
                    ['key' => 'mission.transport', 'label' => 'Moyen de transport', 'type' => 'text'],
                ],
                'content' => <<<'HTML'
<h1>ORDRE DE MISSION</h1>
<table>
<tr><th>Collaborateur</th><td>{{employee.full_name}} ({{employee.matricule}})</td></tr>
<tr><th>Fonction</th><td>{{employee.position}} — {{employee.department}}</td></tr>
<tr><th>Objet</th><td>{{mission.objet}}</td></tr>
<tr><th>Destination</th><td>{{mission.destination}}</td></tr>
<tr><th>Période</th><td>Du {{mission.date_debut}} au {{mission.date_fin}}</td></tr>
<tr><th>Transport</th><td>{{mission.transport}}</td></tr>
</table>
<p>Il est demandé aux autorités civiles et militaires de bien vouloir faciliter l'accomplissement de cette mission.</p>
<p class="signature">Fait à {{organization.city}}, le {{current.date}}<br>La Direction de {{organization.name}}</p>
HTML,
            ],
            [
                'code' => 'CONTRAT_CDD',
                'category' => 'contrats',
                'title' => 'Contrat de travail à durée déterminée (CDD)',
                'format' => 'PDF',
                'description' => 'Contrat CDD à partir du modèle juridique validé.',
                'fields' => [
                    ['key' => 'contrat.date_debut', 'label' => 'Date de début', 'type' => 'date'],
                    ['key' => 'contrat.date_fin', 'label' => 'Date de fin', 'type' => 'date'],
                    ['key' => 'contrat.periode_essai', 'label' => 'Période d\'essai (ex. 1 mois)', 'type' => 'text'],
                    ['key' => 'contrat.salaire_brut', 'label' => 'Salaire brut mensuel (FCFA)', 'type' => 'number'],
                    ['key' => 'contrat.lieu_travail', 'label' => 'Lieu de travail', 'type' => 'text'],
                ],
                'content' => <<<'HTML'
<h1>CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE</h1>
<p><strong>Entre les soussignés :</strong></p>
<p><strong>{{organization.name}}</strong>, immatriculée sous le numéro {{organization.registration_number}}, NIU {{organization.tax_number}}, ci-après « l'Employeur »,</p>
<p><strong>et</strong> {{employee.full_name}}, ci-après « le Salarié »,</p>
<p>il a été convenu ce qui suit :</p>
<h2>Article 1 — Engagement</h2>
<p>Le Salarié est engagé en qualité de {{employee.position}} au sein du service {{employee.department}}, pour une durée déterminée allant du {{contrat.date_debut}} au {{contrat.date_fin}}.</p>
<h2>Article 2 — Période d'essai</h2>
<p>Le présent contrat ne deviendra définitif qu'à l'issue d'une période d'essai de {{contrat.periode_essai}}.</p>
<h2>Article 3 — Lieu de travail</h2>
<p>Le Salarié exercera ses fonctions à {{contrat.lieu_travail}}.</p>
<h2>Article 4 — Rémunération</h2>
<p>En contrepartie de son travail, le Salarié percevra une rémunération brute mensuelle de {{contrat.salaire_brut}} FCFA.</p>
<h2>Article 5 — Dispositions générales</h2>
<p>Le présent contrat est régi par le Code du travail en vigueur et la convention collective applicable.</p>
<table>
<tr><th>Pour l'Employeur</th><th>Le Salarié (lu et approuvé)</th></tr>
<tr><td style="height:25mm"></td><td></td></tr>
</table>
<p>Fait en deux exemplaires à {{organization.city}}, le {{current.date}}.</p>
HTML,
            ],
            [
                'code' => 'PRESENTATION_COMMERCIALE',
                'category' => 'presentations',
                'title' => 'Trame de présentation commerciale',
                'format' => 'PPTX',
                'description' => 'Présentation client à la charte NTEMO (PowerPoint modifiable).',
                'fields' => [
                    ['key' => 'client.nom', 'label' => 'Client', 'type' => 'text'],
                    ['key' => 'presentation.objet', 'label' => 'Objet de la présentation', 'type' => 'text'],
                    ['key' => 'presentation.contexte', 'label' => 'Contexte et enjeux du client', 'type' => 'textarea'],
                    ['key' => 'presentation.proposition', 'label' => 'Notre proposition', 'type' => 'textarea'],
                    ['key' => 'presentation.delai', 'label' => 'Délai de réalisation', 'type' => 'text'],
                    ['key' => 'presentation.budget', 'label' => 'Budget indicatif (FCFA)', 'type' => 'number'],
                ],
                'content' => <<<'HTML'
<h1>{{presentation.objet}}</h1>
<p>Proposition à l'attention de {{client.nom}} — {{current.date}}</p>
<h2>Contexte et enjeux</h2>
<p>{{presentation.contexte}}</p>
<h2>Notre proposition</h2>
<p>{{presentation.proposition}}</p>
<table>
<tr><th>Élément</th><th>Engagement</th></tr>
<tr><td>Délai de réalisation</td><td>{{presentation.delai}}</td></tr>
<tr><td>Budget indicatif</td><td>{{presentation.budget}} FCFA</td></tr>
<tr><td>Interlocuteur</td><td>{{employee.full_name}} — {{employee.position}}</td></tr>
</table>
<h2>Pourquoi {{organization.name}}</h2>
<ul>
<li>Une équipe pluridisciplinaire basée à {{organization.city}}</li>
<li>Une méthode de suivi de projet transparente et outillée</li>
<li>Un engagement sur les délais et la qualité de service</li>
</ul>
<h2>Prochaines étapes</h2>
<ul>
<li>Validation de la proposition par {{client.nom}}</li>
<li>Réunion de lancement et planning détaillé</li>
<li>Démarrage de la mission</li>
</ul>
HTML,
            ],
            [
                'code' => 'LETTRE_ADMINISTRATIVE',
                'category' => 'courriers',
                'title' => 'Lettre administrative',
                'format' => 'DOCX',
                'description' => 'Courrier officiel à en-tête NTEMO.',
                'fields' => [
                    ['key' => 'lettre.destinataire', 'label' => 'Destinataire', 'type' => 'text'],
                    ['key' => 'lettre.objet', 'label' => 'Objet', 'type' => 'text'],
                    ['key' => 'lettre.corps', 'label' => 'Corps du courrier', 'type' => 'textarea'],
                ],
                'content' => <<<'HTML'
<p><strong>À l'attention de :</strong> {{lettre.destinataire}}</p>
<p><strong>Objet :</strong> {{lettre.objet}}</p>
<p>{{organization.city}}, le {{current.date}}</p>
<p>Madame, Monsieur,</p>
<p>{{lettre.corps}}</p>
<p>Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
<p class="signature">La Direction de {{organization.name}}</p>
HTML,
            ],
        ];
    }
}
