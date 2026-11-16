<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Enregistre les actions sensibles (cahier des charges §4 : journaux d'audit et sécurité).
 *
 * L'audit ne doit jamais bloquer l'action métier : une erreur d'écriture est
 * consignée dans les logs applicatifs puis ignorée.
 */
class AuditLogger
{
    /** Champs jamais recopiés dans le journal. */
    private const REDACTED = ['password', 'password_confirmation', 'token', 'security_token', 'secret_key', 'remember_token'];

    public function __construct(
        protected Request $request
    ) {}

    public function record(
        string $action,
        ?Model $subject = null,
        array $newValues = [],
        array $oldValues = [],
        ?User $actor = null,
        ?string $organizationId = null
    ): void {
        try {
            $actor ??= $this->request->user();

            AuditLog::create([
                'organization_id' => $organizationId ?? $actor?->organization_id ?? $subject?->getAttribute('organization_id'),
                'user_id' => $actor?->id,
                'action' => $action,
                'auditable_type' => $subject ? class_basename($subject) : null,
                'auditable_id' => $subject?->getKey(),
                'old_values' => $oldValues ? $this->redact($oldValues) : null,
                'new_values' => $newValues ? $this->redact($newValues) : null,
                'ip_address' => $this->request->ip(),
                'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 500),
            ]);
        } catch (Throwable $e) {
            Log::warning('Échec d\'écriture du journal d\'audit', ['action' => $action, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Uniquement les champs réellement modifiés (avant / après).
     *
     * @return array{0: array, 1: array}
     */
    public function diff(array $before, array $after): array
    {
        $old = [];
        $new = [];
        foreach ($after as $key => $value) {
            if (!array_key_exists($key, $before) || $before[$key] != $value) {
                $old[$key] = $before[$key] ?? null;
                $new[$key] = $value;
            }
        }

        return [$old, $new];
    }

    private function redact(array $values): array
    {
        foreach ($values as $key => $value) {
            if (in_array($key, self::REDACTED, true)) {
                $values[$key] = '[masqué]';
            } elseif (is_array($value)) {
                $values[$key] = $this->redact($value);
            }
        }

        return $values;
    }
}
