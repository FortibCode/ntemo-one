<?php

namespace Tests\Feature;

use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class AttendanceReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_attendance_report_is_a_real_xlsx_with_formulas(): void
    {
        $org = Organization::create(['id' => (string) Str::uuid(), 'name' => 'NTEMO Report', 'slug' => 'ntemo-report', 'is_active' => true]);
        $perm = Permission::create(['id' => (string) Str::uuid(), 'name' => 'x', 'slug' => 'attendance.manage_all', 'module' => 'attendance']);
        $role = Role::create(['id' => (string) Str::uuid(), 'organization_id' => $org->id, 'name' => 'RH', 'slug' => 'rh']);
        $role->permissions()->attach($perm->id);

        $hr = User::create(['id' => (string) Str::uuid(), 'organization_id' => $org->id, 'name' => 'RH', 'email' => 'rh@r.local', 'password' => bcrypt('p'), 'is_active' => true]);
        $hr->roles()->attach($role->id);
        $plain = User::create(['id' => (string) Str::uuid(), 'organization_id' => $org->id, 'name' => 'E', 'email' => 'e@r.local', 'password' => bcrypt('p'), 'is_active' => true]);

        $employee = Employee::create([
            'id' => (string) Str::uuid(), 'organization_id' => $org->id, 'user_id' => $plain->id,
            'matricule' => 'NTM-R-1', 'first_name' => 'Ada', 'last_name' => 'Lovelace',
            'hire_date' => '2026-01-01', 'status' => 'ACTIVE',
        ]);

        foreach (['2026-11-02' => 480, '2026-11-03' => 450] as $date => $minutes) {
            AttendanceDay::create([
                'id' => (string) Str::uuid(), 'organization_id' => $org->id, 'employee_id' => $employee->id,
                'date' => $date, 'first_check_in' => "{$date} 07:00:00", 'last_check_out' => "{$date} 15:00:00",
                'worked_minutes' => $minutes, 'late_minutes' => $date === '2026-11-03' ? 20 : 0, 'status' => 'PRESENT',
            ]);
        }

        $this->actingAs($plain, 'sanctum')->get('/api/v1/reports/attendance/monthly?month=2026-11')->assertStatus(403);

        $response = $this->actingAs($hr, 'sanctum')->get('/api/v1/reports/attendance/monthly?month=2026-11');
        $response->assertOk();
        $this->assertStringContainsString('spreadsheetml', $response->headers->get('Content-Type'));

        $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
        file_put_contents($tmp, $response->getContent());
        $book = IOFactory::load($tmp);
        unlink($tmp);

        $sheet = $book->getSheetByName('Synthèse');
        $this->assertSame('NTM-R-1', $sheet->getCell('A5')->getValue());
        $this->assertSame(2, $sheet->getCell('D5')->getValue());           // jours présents
        $this->assertSame(1, $sheet->getCell('E5')->getValue());           // retards
        $this->assertStringStartsWith('=', $sheet->getCell('G5')->getValue()); // formule
        $this->assertEqualsWithDelta(15.5, $sheet->getCell('G5')->getCalculatedValue(), 0.001); // 930 min
        $this->assertSame(21, $sheet->getCell('M1')->getValue());          // jours ouvrés novembre 2026
        $this->assertSame(19, $sheet->getCell('H5')->getCalculatedValue()); // absences = 21 - 2
        $this->assertNotNull($book->getSheetByName('Détail journalier'));

        $this->actingAs($hr, 'sanctum')->getJson('/api/v1/reports/attendance/monthly?month=2026-13')->assertStatus(422);
    }
}
