<?php

namespace App\Services;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use App\Models\AiConversation;
use App\Models\AiDocumentTask;
use App\Models\AiMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Assistant IA NTEMO (cahier des charges §3.5 « NTEMO AI ») : aide à la rédaction de
 * courriers, fiches de poste, clauses et synthèses, propulsé par Claude (Anthropic).
 *
 * Sans clé API configurée, l'assistant reste utilisable en mode démonstration :
 * il renvoie des trames types et l'indique explicitement.
 */
class AiAssistantService
{
    /** Nombre de messages précédents renvoyés au modèle (contexte de la conversation). */
    private const HISTORY_LIMIT = 20;

    public const TASK_TYPES = [
        'DRAFT_LETTER' => 'Courrier administratif',
        'DRAFT_JOB_DESCRIPTION' => 'Fiche de poste',
        'DRAFT_CONTRACT_CLAUSE' => 'Clause contractuelle',
        'SUMMARIZE_REPORT' => 'Synthèse / compte rendu',
        'DRAFT_PRESENTATION_OUTLINE' => 'Plan de présentation',
    ];

    private const TASK_INSTRUCTIONS = [
        'DRAFT_LETTER' => 'Rédige un courrier administratif complet et prêt à signer : lieu et date, objet, formule d\'appel, corps structuré en paragraphes, formule de politesse, signature « La Direction ». Laisse entre crochets les informations que tu ne connais pas (ex. [Nom du destinataire]).',
        'DRAFT_JOB_DESCRIPTION' => 'Rédige une fiche de poste structurée : intitulé, rattachement hiérarchique, finalité du poste, missions principales (puces), compétences requises (savoir, savoir-faire, savoir-être), profil (formation, expérience), conditions de travail.',
        'DRAFT_CONTRACT_CLAUSE' => 'Rédige la ou les clauses contractuelles demandées dans un style juridique clair, numérotées, conformes aux usages du droit du travail en Afrique centrale. Termine par une ligne rappelant que la clause doit être validée par un juriste avant signature.',
        'SUMMARIZE_REPORT' => 'Produis une synthèse fidèle du texte fourni : contexte en une phrase, points clés (puces), décisions prises, actions à mener avec responsables et échéances si elles figurent dans le texte. N\'invente aucune information absente du texte.',
        'DRAFT_PRESENTATION_OUTLINE' => 'Propose le plan d\'une présentation : un titre, puis 5 à 8 diapositives, chacune avec un titre et 3 à 5 puces concises. Ce plan doit pouvoir être repris dans le modèle « Trame de présentation commerciale ».',
    ];

    public function isConfigured(): bool
    {
        return filled(config('services.anthropic.key'));
    }

    /**
     * Rédaction assistée d'un document (brouillon à relire et valider par l'utilisateur).
     */
    public function generateDocumentDraft(User $user, string $taskType, string $prompt, array $context = []): AiDocumentTask
    {
        if ($this->isConfigured()) {
            $instruction = self::TASK_INSTRUCTIONS[$taskType] ?? self::TASK_INSTRUCTIONS['DRAFT_LETTER'];
            $result = $this->complete($user, [
                ['role' => 'user', 'content' => "Type de document : " . (self::TASK_TYPES[$taskType] ?? $taskType) . "\n\nConsigne : {$instruction}\n\nDemande de l'utilisateur :\n{$prompt}"],
            ]);
            $draft = $result['text'];
            $source = 'claude';
        } else {
            $draft = $this->demoDraft($taskType, $prompt, $context['organization_name'] ?? $user->organization?->name ?? 'NTEMO');
            $source = 'demo';
        }

        return AiDocumentTask::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $user->organization_id,
            'user_id' => $user->id,
            'task_type' => $taskType,
            'status' => 'COMPLETED',
            'user_prompt' => $prompt,
            'generated_draft' => $draft,
            'was_accepted_by_user' => false,
        ])->setAttribute('source', $source);
    }

    /**
     * Message dans une conversation : l'historique récent est renvoyé au modèle.
     *
     * @return array{user_message: AiMessage, assistant_message: AiMessage, source: string}
     */
    public function sendMessage(AiConversation $conversation, string $userMessage, User $user): array
    {
        // Le message de l'utilisateur est enregistré même si l'appel IA échoue ensuite
        $userMsg = AiMessage::create([
            'id' => (string) Str::uuid(),
            'ai_conversation_id' => $conversation->id,
            'position' => $this->nextPosition($conversation),
            'role' => 'user',
            'content' => $userMessage,
        ]);

        if ($this->isConfigured()) {
            $history = AiMessage::where('ai_conversation_id', $conversation->id)
                ->whereIn('role', ['user', 'assistant'])
                ->orderByDesc('position')
                ->limit(self::HISTORY_LIMIT)
                ->get()
                ->reverse()
                ->map(fn (AiMessage $m) => ['role' => $m->role, 'content' => $m->content])
                ->values()
                ->all();

            $result = $this->complete($user, $this->normalizeTurns($history));
            $reply = $result['text'];
            $usage = $result['usage'];
            $source = 'claude';
        } else {
            $reply = "Mode démonstration : l'assistant IA n'est pas encore activé sur ce serveur (clé ANTHROPIC_API_KEY absente).\n\n"
                . "Votre demande (« " . Str::limit($userMessage, 140) . " ») a bien été enregistrée. Une fois l'IA activée, "
                . "je pourrai rédiger courriers, fiches de poste, clauses et synthèses. En attendant, le moteur documentaire "
                . "propose des modèles officiels prêts à l'emploi (attestations, contrats, ordres de mission, présentations).";
            $usage = null;
            $source = 'demo';
        }

        $assistantMsg = AiMessage::create([
            'id' => (string) Str::uuid(),
            'ai_conversation_id' => $conversation->id,
            'position' => $this->nextPosition($conversation),
            'role' => 'assistant',
            'content' => $reply,
            'tokens_usage' => $usage,
        ]);
        $conversation->touch();

        return ['user_message' => $userMsg, 'assistant_message' => $assistantMsg, 'source' => $source];
    }

    /**
     * Appel à Claude. Lève une AiUnavailableException avec un message en français en cas d'échec.
     *
     * @param array<int, array{role: string, content: string}> $messages
     * @return array{text: string, usage: array<string, int>}
     */
    protected function complete(User $user, array $messages): array
    {
        $client = new Client(apiKey: config('services.anthropic.key'));

        try {
            $response = $client->beta->messages->create(
                model: config('services.anthropic.model'),
                maxTokens: config('services.anthropic.max_tokens'),
                system: [[
                    'type' => 'text',
                    'text' => $this->systemPrompt($user),
                    'cacheControl' => ['type' => 'ephemeral'],
                ]],
                messages: $messages,
                outputConfig: ['effort' => config('services.anthropic.effort')],
                // Si le modèle décline une demande, le serveur la relance sur le modèle de repli prévu
                fallbacks: 'default',
                betas: ['server-side-fallback-2026-07-01'],
            );
        } catch (AuthenticationException $e) {
            Log::error('Assistant IA : clé API refusée', ['error' => $e->getMessage()]);
            throw new AiUnavailableException('La clé de l\'assistant IA est invalide. Contactez l\'administrateur.', 503);
        } catch (RateLimitException $e) {
            throw new AiUnavailableException('L\'assistant IA est très sollicité. Réessayez dans quelques instants.', 429);
        } catch (APIConnectionException $e) {
            throw new AiUnavailableException('Le service d\'IA est injoignable. Vérifiez la connexion du serveur.', 503);
        } catch (APIStatusException $e) {
            Log::error('Assistant IA : erreur API', ['status' => $e->getCode(), 'error' => $e->getMessage()]);
            throw new AiUnavailableException('L\'assistant IA a rencontré une erreur. Réessayez plus tard.', 502);
        }

        if ($response->stopReason === 'refusal') {
            return [
                'text' => 'Je ne peux pas traiter cette demande. Reformulez-la ou contactez le service RH.',
                'usage' => $this->usage($response),
            ];
        }

        $text = '';
        foreach ($response->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }
        if ($response->stopReason === 'max_tokens') {
            $text .= "\n\n[Réponse tronquée : demandez la suite si nécessaire.]";
        }
        if (trim($text) === '') {
            throw new AiUnavailableException('L\'assistant IA n\'a pas produit de réponse. Réessayez.', 502);
        }

        return ['text' => trim($text), 'usage' => $this->usage($response)];
    }

    /**
     * Consigne système stable (mise en cache) : rôle, langue, règles de prudence.
     * Aucune donnée personnelle de collaborateur n'y figure.
     */
    private function systemPrompt(User $user): string
    {
        $org = $user->organization?->name ?? 'l\'organisation';
        $city = $user->organization?->city ?? '';

        return <<<PROMPT
Tu es NTEMO AI, l'assistant de rédaction administrative et RH de {$org}{$this->suffix($city)}, intégré à la plateforme NTEMO ONE.

Ton rôle : aider la Direction, les RH et les collaborateurs à rédiger des courriers, fiches de poste, clauses de contrat, comptes rendus, synthèses et plans de présentation.

Règles :
- Réponds toujours en français, dans un registre professionnel et sobre.
- Produis directement un texte utilisable ; structure-le avec des titres courts et des listes quand c'est utile. N'utilise pas de tableaux Markdown.
- N'invente jamais de faits, de noms, de montants ou de dates : laisse un champ entre crochets, par exemple [Date de début].
- Pour les questions juridiques ou de paie, donne une première base de travail et rappelle qu'une validation par un juriste ou le service RH est nécessaire.
- Tu n'as pas accès aux données de la plateforme (dossiers, pointages, congés) : si on te les demande, explique où les trouver dans NTEMO ONE.
PROMPT;
    }

    private function suffix(string $city): string
    {
        return $city !== '' ? " ({$city})" : '';
    }

    private function nextPosition(AiConversation $conversation): int
    {
        return (int) AiMessage::where('ai_conversation_id', $conversation->id)->max('position') + 1;
    }

    /** L'API exige une alternance stricte user / assistant commençant par user. */
    private function normalizeTurns(array $history): array
    {
        $turns = [];
        foreach ($history as $m) {
            if (!$turns && $m['role'] !== 'user') {
                continue;
            }
            if ($turns && end($turns)['role'] === $m['role']) {
                $turns[count($turns) - 1]['content'] .= "\n\n" . $m['content'];
                continue;
            }
            $turns[] = $m;
        }

        return $turns;
    }

    private function usage(object $response): array
    {
        return [
            'input_tokens' => (int) ($response->usage->inputTokens ?? 0),
            'output_tokens' => (int) ($response->usage->outputTokens ?? 0),
            'cache_read_input_tokens' => (int) ($response->usage->cacheReadInputTokens ?? 0),
            'model' => (string) ($response->model ?? config('services.anthropic.model')),
        ];
    }

    private function demoDraft(string $taskType, string $prompt, string $orgName): string
    {
        $label = self::TASK_TYPES[$taskType] ?? 'Document';

        return "[Mode démonstration — trame type, l'assistant IA n'est pas activé]\n\n"
            . strtoupper($label) . " — {$prompt}\n\n"
            . match ($taskType) {
                'DRAFT_JOB_DESCRIPTION' => "1. Finalité du poste\n[À compléter]\n\n2. Missions principales\n- [Mission 1]\n- [Mission 2]\n\n3. Profil recherché\n- Formation : [À compléter]\n- Expérience : [À compléter]",
                'DRAFT_CONTRACT_CLAUSE' => "Article [N] — [Intitulé]\nLe Salarié s'engage à [obligation] envers {$orgName}, pendant toute la durée du contrat et [durée] après sa rupture.\n\nClause à faire valider par un juriste avant signature.",
                'SUMMARIZE_REPORT' => "Contexte : [À compléter]\n\nPoints clés :\n- [Point 1]\n- [Point 2]\n\nActions : [Responsable] — [Échéance]",
                default => "[Lieu], le [Date]\n\nObjet : [Objet]\n\nMadame, Monsieur,\n\n[Corps du courrier]\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.\n\nLa Direction de {$orgName}",
            };
    }
}

