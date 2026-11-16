<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\Badge;
use App\Models\Contract;
use App\Models\DocumentGeneration;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;

class DashboardAnalyticsService
{
    /** Horizon des alertes contrats (fin de période d'essai, échéance CDD). */
    private const CONTRACT_ALERT_DAYS = 30;

    /**
     * Indicateurs RH et opérationnels pour la Direction et les RH (cahier des charges §3.5).
     * Toutes les dates sont calculées dans le fuseau de l'organisation.
     */
    public function getExecutiveKpis(Organization $organization): array
    {
        $timezone = $organization->timezone ?: 'Africa/Brazzaville';
        $now = CarbonImmutable::now($timezone);
        $today = $now->toDateString();
        $orgId = $organization->id;

        // 1. Effectifs
        $totalEmployees = Employee::where('organization_id', $orgId)->count();
        $activeEmployees = Employee::where('organization_id', $orgId)->where('status', 'ACTIVE')->count();

        // 2. Présences du jour
        $presentToday = AttendanceDay::where('organization_id', $orgId)
            ->whereDate('date', $today)
            ->whereNotNull('first_check_in')
            ->count();

        $lateToday = AttendanceDay::where('organization_id', $orgId)
            ->whereDate('date', $today)
            ->where('late_minutes', '>', 0)
            ->count();

        $onLeaveToday = LeaveRequest::where('organization_id', $orgId)
            ->where('status', 'APPROVED')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->count();

        $isWorkingDay = $this->isWorkingDay($organization, $now);
        $expectedToday = max(0, $activeEmployees - $onLeaveToday);
        $absentToday = $isWorkingDay ? max(0, $expectedToday - $presentToday) : 0;
        $attendanceRate = $expectedToday > 0 ? round($presentToday / $expectedToday * 100, 1) : 0.0;

        // 3. Validations en attente
        $pendingLeavesN1 = LeaveRequest::where('organization_id', $orgId)->where('status', 'PENDING_N1')->count();
        $pendingLeavesHr = LeaveRequest::where('organization_id', $orgId)->where('status', 'PENDING_HR')->count();
        $pendingCorrections = AttendanceCorrection::where('organization_id', $orgId)->where('status', 'PENDING')->count();
        $pendingTimesheets = TimeEntry::where('organization_id', $orgId)->where('status', 'PENDING')->count();

        // 4. Documents & badges
        $monthStart = $now->startOfMonth()->utc();
        $documentsThisMonth = DocumentGeneration::where('organization_id', $orgId)
            ->where('status', 'COMPLETED')
            ->where('generated_at', '>=', $monthStart)
            ->count();
        $activeBadges = Badge::where('organization_id', $orgId)->where('status', 'ACTIVE')->count();

        // 5. Projets & heures
        $activeProjects = Project::where('organization_id', $orgId)->where('status', 'IN_PROGRESS')->count();
        $monthlyHours = (float) TimeEntry::where('organization_id', $orgId)
            ->whereDate('date', '>=', $now->startOfMonth()->toDateString())
            ->whereDate('date', '<=', $now->endOfMonth()->toDateString())
            ->where('status', 'APPROVED')
            ->sum('hours');

        return [
            'date' => $today,
            'is_working_day' => $isWorkingDay,
            'workforce' => [
                'total_employees' => $totalEmployees,
                'active_employees' => $activeEmployees,
                'on_leave_today' => $onLeaveToday,
            ],
            'attendance' => [
                'present_today' => $presentToday,
                'late_today' => $lateToday,
                'absent_today' => $absentToday,
                'attendance_rate_percentage' => $attendanceRate,
                'trend' => $this->attendanceTrend($orgId, $now, 7),
                'recent_events' => $this->recentEvents($orgId, $now, $timezone),
            ],
            'leaves' => [
                'pending_approval_count' => $pendingLeavesN1 + $pendingLeavesHr,
                'pending_manager_count' => $pendingLeavesN1,
                'pending_hr_count' => $pendingLeavesHr,
            ],
            'approvals' => [
                'pending_corrections' => $pendingCorrections,
                'pending_timesheets' => $pendingTimesheets,
            ],
            'documents' => [
                'generated_this_month' => $documentsThisMonth,
                'active_badges' => $activeBadges,
            ],
            'projects' => [
                'active_projects_count' => $activeProjects,
                'approved_hours_this_month' => $monthlyHours,
            ],
            'contract_alerts' => $this->contractAlerts($orgId, $now),
        ];
    }

    /**
     * Présents et retards sur les N derniers jours (graphique de tendance).
     */
    private function attendanceTrend(string $orgId, CarbonImmutable $now, int $days): array
    {
        $from = $now->subDays($days - 1)->toDateString();

        $rows = AttendanceDay::where('organization_id', $orgId)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $now->toDateString())
            ->whereNotNull('first_check_in')
            ->get(['date', 'late_minutes'])
            ->groupBy(fn ($d) => $d->date->toDateString());

        $trend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = $now->subDays($i)->toDateString();
            $dayRows = $rows->get($date, collect());
            $trend[] = [
                'date' => $date,
                'present' => $dayRows->count(),
                'late' => $dayRows->where('late_minutes', '>', 0)->count(),
            ];
        }

        return $trend;
    }

    /**
     * Derniers pointages du jour (flux en temps réel).
     */
    private function recentEvents(string $orgId, CarbonImmutable $now, string $timezone): array
    {
        return AttendanceEvent::where('organization_id', $orgId)
            ->where('recorded_at', '>=', $now->startOfDay()->utc())
            ->with('employee.department')
            ->latest('recorded_at')
            ->limit(8)
            ->get()
            ->map(fn (AttendanceEvent $e) => [
                'id' => $e->id,
                'type' => $e->type,
                'source' => $e->source,
                'time' => $e->recorded_at->copy()->setTimezone($timezone)->format('H:i'),
                'employee' => [
                    'full_name' => $e->employee?->full_name,
                    'matricule' => $e->employee?->matricule,
                    'department' => $e->employee?->department?->name,
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * Contrats actifs dont la période d'essai ou l'échéance (CDD) arrive dans les 30 jours.
     */
    private function contractAlerts(string $orgId, CarbonImmutable $now): array
    {
        $today = $now->toDateString();
        $limit = $now->addDays(self::CONTRACT_ALERT_DAYS)->toDateString();

        $contracts = Contract::where('organization_id', $orgId)
            ->where('status', 'ACTIVE')
            ->where(function ($q) use ($today, $limit) {
                $q->whereBetween('probation_end_date', [$today, $limit])
                    ->orWhereBetween('end_date', [$today, $limit]);
            })
            ->with('employee')
            ->get();

        $alerts = [];
        foreach ($contracts as $contract) {
            foreach (['probation_end_date' => 'PROBATION_END', 'end_date' => 'CONTRACT_END'] as $field => $kind) {
                $date = $contract->{$field};
                if (!$date) {
                    continue;
                }
                $dateString = CarbonImmutable::parse($date)->toDateString();
                if ($dateString < $today || $dateString > $limit) {
                    continue;
                }
                $alerts[] = [
                    'kind' => $kind,
                    'date' => $dateString,
                    'days_left' => (int) $now->startOfDay()->diffInDays(CarbonImmutable::parse($dateString, $now->timezone)),
                    'contract_type' => $contract->type,
                    'employee' => [
                        'id' => $contract->employee?->id,
                        'full_name' => $contract->employee?->full_name,
                        'matricule' => $contract->employee?->matricule,
                    ],
                ];
            }
        }

        usort($alerts, fn ($a, $b) => strcmp($a['date'], $b['date']));

        return $alerts;
    }

    private function isWorkingDay(Organization $organization, CarbonImmutable $date): bool
    {
        $configured = $organization->settings['working_days'] ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

        return in_array(strtolower($date->locale('en')->dayName), $configured, true);
    }
}
