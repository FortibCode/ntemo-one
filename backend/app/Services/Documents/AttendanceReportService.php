<?php

namespace App\Services\Documents;

use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Bilan mensuel de présence au format Excel (.xlsx), avec formules intégrées
 * (cahier des charges §3.3 « Rapports Excel »).
 */
class AttendanceReportService
{
    private const NAVY = '0B2563';
    private const CYAN = '1C9BD6';
    private const MIST = 'EAF6FC';

    /**
     * @return string Contenu binaire du classeur .xlsx
     */
    public function monthlyWorkbook(Organization $organization, CarbonImmutable $month): string
    {
        $start = $month->startOfMonth();
        $end = $month->endOfMonth();
        $timezone = $organization->timezone ?: 'Africa/Brazzaville';

        $employees = Employee::where('organization_id', $organization->id)
            ->with('department')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        $days = AttendanceDay::where('organization_id', $organization->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('date')
            ->get()
            ->groupBy('employee_id');

        $workingDays = $this->countWorkingDays($start, $end, $organization);

        $book = new Spreadsheet();
        $book->getProperties()
            ->setCreator('NTEMO ONE')
            ->setCompany($organization->name)
            ->setTitle('Bilan de présence ' . $start->translatedFormat('F Y'));

        $summary = $book->getActiveSheet();
        $summary->setTitle('Synthèse');
        $this->buildSummary($summary, $organization, $start, $employees, $days, $workingDays);

        $detail = $book->createSheet();
        $detail->setTitle('Détail journalier');
        $this->buildDetail($detail, $employees, $days, $timezone);

        $book->setActiveSheetIndex(0);

        $tmp = tempnam(sys_get_temp_dir(), 'ntemo_xlsx_');
        try {
            (new Xlsx($book))->save($tmp);

            return file_get_contents($tmp);
        } finally {
            @unlink($tmp);
            $book->disconnectWorksheets();
        }
    }

    private function buildSummary(
        Worksheet $sheet,
        Organization $organization,
        CarbonImmutable $start,
        $employees,
        $days,
        int $workingDays
    ): void {
        $sheet->setCellValue('A1', $organization->name . ' — Bilan de présence');
        $sheet->setCellValue('A2', 'Période : ' . ucfirst($start->locale('fr')->translatedFormat('F Y')) . " — {$workingDays} jours ouvrés");
        $sheet->mergeCells('A1:J1');
        $sheet->mergeCells('A2:J2');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->getColor()->setRGB(self::NAVY);
        $sheet->getStyle('A2')->getFont()->setItalic(true)->getColor()->setRGB('4B5563');

        // Jours ouvrés de référence (cellule utilisée par les formules)
        $sheet->setCellValue('L1', 'Jours ouvrés');
        $sheet->setCellValue('M1', $workingDays);
        $sheet->getStyle('L1')->getFont()->setBold(true);

        $headers = ['Matricule', 'Collaborateur', 'Service', 'Jours présents', 'Retards',
            'Minutes de retard', 'Heures travaillées', 'Absences', 'Taux de présence', 'Anomalies'];
        $sheet->fromArray($headers, null, 'A4');
        $this->styleHeader($sheet, 'A4:J4');

        $row = 5;
        foreach ($employees as $employee) {
            $records = $days->get($employee->id, collect());
            $present = $records->filter(fn ($d) => $d->first_check_in !== null)->count();
            $late = $records->filter(fn ($d) => $d->late_minutes > 0 || $d->status === 'LATE')->count();

            $sheet->fromArray([
                $employee->matricule,
                $employee->full_name,
                $employee->department?->name ?? '—',
                $present,
                $late,
                (int) $records->sum('late_minutes'),
                null,
                null,
                null,
                $records->where('has_anomaly', true)->count(),
            ], null, "A{$row}");

            // Formules : heures = minutes / 60 ; absences = ouvrés - présents ; taux = présents / ouvrés
            $minutes = (int) $records->sum('worked_minutes');
            $sheet->setCellValue("G{$row}", "=ROUND({$minutes}/60,2)");
            $sheet->setCellValue("H{$row}", "=MAX(0,\$M\$1-D{$row})");
            $sheet->setCellValue("I{$row}", "=IF(\$M\$1=0,0,D{$row}/\$M\$1)");
            $row++;
        }

        $last = max(5, $row - 1);
        if ($employees->isNotEmpty()) {
            $sheet->setCellValue("A{$row}", 'TOTAL');
            $sheet->mergeCells("A{$row}:C{$row}");
            foreach (['D', 'E', 'F', 'G', 'H', 'J'] as $col) {
                $sheet->setCellValue("{$col}{$row}", "=SUM({$col}5:{$col}{$last})");
            }
            $sheet->setCellValue("I{$row}", "=IFERROR(AVERAGE(I5:I{$last}),0)");
            $sheet->getStyle("A{$row}:J{$row}")->getFont()->setBold(true);
            $sheet->getStyle("A{$row}:J{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::MIST);
        } else {
            $sheet->setCellValue('A5', 'Aucun collaborateur.');
        }

        $sheet->getStyle("G5:G{$row}")->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle("I5:I{$row}")->getNumberFormat()->setFormatCode('0.0%');
        $this->borders($sheet, "A4:J{$row}");
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
        $sheet->freezePane('A5');
        $sheet->setAutoFilter("A4:J{$last}");
    }

    private function buildDetail(Worksheet $sheet, $employees, $days, string $timezone): void
    {
        $headers = ['Date', 'Matricule', 'Collaborateur', 'Arrivée', 'Départ',
            'Minutes travaillées', 'Minutes de retard', 'Statut', 'Anomalie'];
        $sheet->fromArray($headers, null, 'A1');
        $this->styleHeader($sheet, 'A1:I1');

        $byId = $employees->keyBy('id');
        $rows = [];
        foreach ($days as $employeeId => $records) {
            $employee = $byId->get($employeeId);
            if (!$employee) {
                continue;
            }
            foreach ($records as $day) {
                $rows[] = [
                    $day->date instanceof \DateTimeInterface ? $day->date->format('d/m/Y') : (string) $day->date,
                    $employee->matricule,
                    $employee->full_name,
                    $day->first_check_in?->copy()->setTimezone($timezone)->format('H:i') ?? '—',
                    $day->last_check_out?->copy()->setTimezone($timezone)->format('H:i') ?? '—',
                    (int) $day->worked_minutes,
                    (int) $day->late_minutes,
                    $day->status,
                    $day->has_anomaly ? ($day->anomaly_reason ?: 'Oui') : '',
                ];
            }
        }
        usort($rows, fn ($a, $b) => [CarbonImmutable::createFromFormat('d/m/Y', $a[0]), $a[2]] <=> [CarbonImmutable::createFromFormat('d/m/Y', $b[0]), $b[2]]);

        if ($rows) {
            $sheet->fromArray($rows, null, 'A2');
        } else {
            $sheet->setCellValue('A2', 'Aucun pointage sur la période.');
        }

        $last = max(2, count($rows) + 1);
        $this->borders($sheet, "A1:I{$last}");
        foreach (range('A', 'I') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
        $sheet->freezePane('A2');
        if ($rows) {
            $sheet->setAutoFilter("A1:I{$last}");
        }
    }

    /**
     * Jours ouvrés selon les paramètres de l'organisation (lundi–vendredi par défaut).
     */
    private function countWorkingDays(CarbonImmutable $start, CarbonImmutable $end, Organization $organization): int
    {
        $map = ['monday' => 1, 'tuesday' => 2, 'wednesday' => 3, 'thursday' => 4, 'friday' => 5, 'saturday' => 6, 'sunday' => 7];
        $configured = $organization->settings['working_days'] ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        $isoDays = array_values(array_filter(array_map(fn ($d) => $map[$d] ?? null, $configured)));

        $count = 0;
        for ($day = $start; $day->lte($end); $day = $day->addDay()) {
            if (in_array($day->dayOfWeekIso, $isoDays, true)) {
                $count++;
            }
        }

        return $count;
    }

    private function styleHeader(Worksheet $sheet, string $range): void
    {
        $style = $sheet->getStyle($range);
        $style->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::NAVY);
        $style->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(true);
        $style->getBorders()->getBottom()->setBorderStyle(Border::BORDER_MEDIUM)->getColor()->setRGB(self::CYAN);
    }

    private function borders(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');
    }
}
