import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/attendance/services/attendance_service.dart';

/// Historique des présences (30 derniers jours) : arrivée, départ, temps effectif, retard.
class AttendanceHistory extends StatefulWidget {
  final AttendanceService service;

  const AttendanceHistory({super.key, required this.service});

  @override
  State<AttendanceHistory> createState() => _AttendanceHistoryState();
}

class _AttendanceHistoryState extends State<AttendanceHistory> {
  late Future<List<AttendanceDayModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.service.getMyAttendances();
  }

  void _reload() => setState(() => _future = widget.service.getMyAttendances());

  static String _time(DateTime? t) => t == null ? '—' : DateFormat.Hm('fr_FR').format(t);

  static String _duration(int minutes) {
    if (minutes <= 0) return '—';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '$h h' : '$h h ${m.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text('Mon historique', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            IconButton(
              tooltip: 'Actualiser',
              icon: const Icon(Icons.refresh),
              onPressed: _reload,
            ),
          ],
        ),
        FutureBuilder<List<AttendanceDayModel>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              return Text(snapshot.error.toString(), style: const TextStyle(color: Colors.redAccent));
            }
            final days = snapshot.data ?? const [];
            if (days.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Aucun pointage enregistré pour le moment.', style: TextStyle(color: Colors.black54)),
              );
            }
            return Card(
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 0.8,
              child: Column(
                children: [
                  for (final (index, day) in days.indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    _DayTile(day: day, time: _time, duration: _duration),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _DayTile extends StatelessWidget {
  final AttendanceDayModel day;
  final String Function(DateTime?) time;
  final String Function(int) duration;

  const _DayTile({required this.day, required this.time, required this.duration});

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE d MMM', 'fr_FR').format(day.date);
    final statusColor = day.isLate ? Colors.orange.shade700 : Colors.green.shade700;
    final statusLabel = day.isLate ? 'Retard ${day.lateMinutes} min' : 'À l’heure';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 84,
            child: Text(
              dateLabel[0].toUpperCase() + dateLabel.substring(1),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${time(day.checkIn)} → ${time(day.checkOut)}', style: const TextStyle(fontFamily: 'monospace')),
                const SizedBox(height: 2),
                Text(
                  'Effectif : ${duration(day.workedMinutes)}${day.hasAnomaly ? ' • anomalie' : ''}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
          if (day.checkIn != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(day.isLate ? Icons.schedule : Icons.check_circle_outline, size: 14, color: statusColor),
                  const SizedBox(width: 4),
                  Text(statusLabel, style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
                ],
              ),
            )
          else
            const Icon(Icons.remove_circle_outline, size: 18, color: AppColors.logoBlue),
        ],
      ),
    );
  }
}
