import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/features/attendance/services/attendance_service.dart';
import 'package:ntemo_one_mobile/features/notifications/services/notifications_service.dart';
import 'package:ntemo_one_mobile/features/tasks/services/tasks_service.dart';

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

void main() {
  test('attendance history parses server days (local day, UTC timestamps)', () async {
    final api = ApiClient(
      baseUrl: 'http://api.test/v1',
      httpClient: MockClient((_) async => _json({
            'data': [
              {
                'date': '2026-11-16',
                'first_check_in': '2026-11-16T07:40:00.000000Z',
                'last_check_out': '2026-11-16T16:30:00.000000Z',
                'worked_minutes': 470,
                'late_minutes': 40,
                'status': 'LATE',
                'has_anomaly': false,
              },
              {'date': '2026-11-15', 'first_check_in': null, 'last_check_out': null, 'worked_minutes': 0, 'late_minutes': 0, 'status': 'ABSENT'},
            ],
          })),
    );

    final days = await AttendanceService(apiClient: api).getMyAttendances();

    expect(days, hasLength(2));
    expect(days.first.date, DateTime(2026, 11, 16));
    expect(days.first.isLate, isTrue);
    expect(days.first.workedMinutes, 470);
    expect(days.first.checkIn!.toUtc(), DateTime.utc(2026, 11, 16, 7, 40));
    expect(days.last.checkIn, isNull);
  });

  test('my tasks parse project and overdue flag; status update uses PUT', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
      baseUrl: 'http://api.test/v1',
      httpClient: MockClient((req) async {
        requests.add(req);
        if (req.method == 'GET') {
          return _json({
            'data': [
              {
                'id': 't1',
                'title': 'Rapport d\'audit',
                'priority': 'HIGH',
                'status': 'IN_PROGRESS',
                'due_date': '2026-11-10',
                'is_overdue': true,
                'estimated_hours': 20,
                'project': {'id': 'p1', 'name': 'Audit SI', 'code': 'PRJ-A'},
              },
            ],
          });
        }
        return _json({'success': true});
      }),
    );
    final service = TasksService(apiClient: api);

    final tasks = await service.myTasks();
    expect(tasks.single.projectName, 'Audit SI');
    expect(tasks.single.isOverdue, isTrue);
    expect(tasks.single.dueDate, DateTime(2026, 11, 10));
    expect(tasks.single.estimatedHours, 20);

    await service.updateStatus('t1', 'DONE');
    expect(requests.last.method, 'PUT');
    expect(requests.last.url.path, '/v1/tasks/t1');
    expect(jsonDecode(requests.last.body), {'status': 'DONE'});
  });

  test('notifications expose unread count and read state', () async {
    final api = ApiClient(
      baseUrl: 'http://api.test/v1',
      httpClient: MockClient((_) async => _json({
            'unread_count': 1,
            'data': [
              {'id': 'n1', 'type': 'TASK_ASSIGNED', 'title': 'Nouvelle tâche', 'message': 'm', 'created_at': '2026-11-16T08:00:00Z', 'read_at': null},
              {'id': 'n2', 'type': 'BADGE', 'title': 'Badge', 'message': 'm', 'created_at': '2026-11-15T08:00:00Z', 'read_at': '2026-11-15T09:00:00Z'},
            ],
          })),
    );

    final page = await NotificationsService(apiClient: api).fetch();
    expect(page.unreadCount, 1);
    expect(page.items.first.isRead, isFalse);
    expect(page.items.last.isRead, isTrue);
    expect(page.items.first.copyRead().isRead, isTrue);
  });
}
