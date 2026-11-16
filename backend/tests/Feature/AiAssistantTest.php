<?php

namespace Tests\Feature;

use App\Models\AiConversation;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Services\AiUnavailableException;
use App\Models\User;
use App\Services\AiAssistantService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $org;
    protected User $user;
    protected AiAssistantService $aiService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->aiService = app(AiAssistantService::class);

        $this->org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'NTEMO AI Org',
            'slug' => 'ntemo-ai',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'name' => 'Expert RH',
            'email' => 'expert_rh@ntemo.local',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => 'IA', 'slug' => 'ai.use', 'module' => 'ai']);
        $role = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'RH', 'slug' => 'rh']);
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        // Par défaut : pas de clé → mode démonstration (aucun appel réseau en test)
        config(['services.anthropic.key' => null]);
    }

    public function test_can_generate_document_draft_with_ai(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/ai/tasks/draft', [
                'task_type' => 'DRAFT_JOB_DESCRIPTION',
                'prompt' => 'Chef de Projet Informatique Senior',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.task_type', 'DRAFT_JOB_DESCRIPTION')
            ->assertJsonPath('data.status', 'COMPLETED');

        $this->assertDatabaseHas('ai_document_tasks', [
            'user_id' => $this->user->id,
            'task_type' => 'DRAFT_JOB_DESCRIPTION',
        ]);
    }

    public function test_can_send_message_in_ai_conversation(): void
    {
        $conv = AiConversation::create([
            'id' => (string) Str::uuid(),
            'organization_id' => $this->org->id,
            'user_id' => $this->user->id,
            'title' => 'Assistance RH',
            'context_module' => 'documents',
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/ai/conversations/{$conv->id}/messages", [
                'message' => 'Comment formuler une clause de dédit-formation ?',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user_message.role', 'user')
            ->assertJsonPath('data.assistant_message.role', 'assistant');

        $this->assertDatabaseHas('ai_messages', [
            'ai_conversation_id' => $conv->id,
            'role' => 'assistant',
        ]);
    }

    public function test_ai_requires_permission_and_reports_demo_mode(): void
    {
        $other = User::create(['id' => (string) Str::uuid(), 'organization_id' => $this->org->id, 'name' => 'Sans IA', 'email' => 'noai@ntemo.local', 'password' => bcrypt('p'), 'is_active' => true]);
        $this->actingAs($other, 'sanctum')->getJson('/api/v1/ai/status')->assertStatus(403);

        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/ai/status')
            ->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.task_types.DRAFT_LETTER', 'Courrier administratif');
    }

    public function test_enabled_mode_sends_alternating_history_and_records_usage(): void
    {
        config(['services.anthropic.key' => 'test-key']);
        $fake = new class extends AiAssistantService {
            public array $calls = [];

            protected function complete(\App\Models\User $user, array $messages): array
            {
                $this->calls[] = $messages;

                return ['text' => 'Réponse ' . count($this->calls), 'usage' => ['input_tokens' => 120, 'output_tokens' => 30]];
            }
        };
        $this->app->instance(AiAssistantService::class, $fake);

        $conv = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/ai/conversations', ['title' => 'Courrier'])->json('data.id');

        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/ai/conversations/{$conv}/messages", ['message' => 'Bonjour'])
            ->assertOk()->assertJsonPath('data.source', 'claude')->assertJsonPath('data.assistant_message.content', 'Réponse 1');
        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/ai/conversations/{$conv}/messages", ['message' => 'Rédige un courrier'])
            ->assertOk();

        // Le second appel reçoit l'historique complet, en alternance stricte
        $this->assertSame(['user', 'assistant', 'user'], array_column($fake->calls[1], 'role'));
        $this->assertSame('Rédige un courrier', $fake->calls[1][2]['content']);
        $this->assertDatabaseHas('ai_messages', ['content' => 'Réponse 2', 'role' => 'assistant']);
    }

    public function test_ai_errors_are_reported_without_500(): void
    {
        config(['services.anthropic.key' => 'test-key']);
        $this->app->instance(AiAssistantService::class, new class extends AiAssistantService {
            protected function complete(\App\Models\User $user, array $messages): array
            {
                throw new AiUnavailableException('L\'assistant IA est très sollicité. Réessayez dans quelques instants.', 429);
            }
        });

        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/ai/tasks/draft', ['task_type' => 'DRAFT_LETTER', 'prompt' => 'Courrier de bienvenue'])
            ->assertStatus(429)->assertJsonPath('message', 'L\'assistant IA est très sollicité. Réessayez dans quelques instants.');
    }
}
