<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Services\Documents\AttendanceReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    /**
     * Bilan mensuel de présence (.xlsx). Paramètre `month` au format AAAA-MM (mois courant par défaut).
     */
    public function monthlyAttendance(Request $request, AttendanceReportService $reports): Response
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        $organization = $request->user()->organization;
        $timezone = $organization->timezone ?: 'Africa/Brazzaville';
        $month = $request->filled('month')
            ? CarbonImmutable::createFromFormat('Y-m-d', $request->input('month') . '-01', $timezone)
            : CarbonImmutable::now($timezone);

        $content = $reports->monthlyWorkbook($organization, $month->startOfMonth());
        $filename = 'bilan-presence-' . $month->format('Y-m') . '.xlsx';
        app(AuditLogger::class)->record('report.attendance_exported', $organization, ['month' => $month->format('Y-m')]);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store',
        ]);
    }
}
