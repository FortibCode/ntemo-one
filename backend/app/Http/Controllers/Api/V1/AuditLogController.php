<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Journal d'audit de l'organisation (permission `audit.view`), du plus récent au plus ancien.
     * Filtres : `module` (préfixe d'action, ex. « badge »), `user_id`, `from` / `to` (AAAA-MM-JJ).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'module' => ['nullable', 'string', 'max:50', 'regex:/^[a-z_]+$/'],
            'user_id' => ['nullable', 'uuid'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $user = $request->user();
        $timezone = $user->organization?->timezone ?: 'Africa/Brazzaville';

        $query = AuditLog::where('organization_id', $user->organization_id)
            ->with('user:id,name,email')
            ->latest('created_at');

        if ($module = $request->input('module')) {
            $query->where('action', 'like', $module . '.%');
        }
        if ($userId = $request->input('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($from = $request->input('from')) {
            $query->where('created_at', '>=', CarbonImmutable::parse($from, $timezone)->startOfDay()->utc());
        }
        if ($to = $request->input('to')) {
            $query->where('created_at', '<=', CarbonImmutable::parse($to, $timezone)->endOfDay()->utc());
        }

        $page = $query->paginate(50);
        $page->getCollection()->transform(fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'subject_type' => $log->auditable_type,
            'subject_id' => $log->auditable_id,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toISOString(),
            'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name, 'email' => $log->user->email] : null,
        ]);

        return response()->json($page);
    }
}
