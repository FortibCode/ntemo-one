import 'package:ntemo_one_mobile/core/api/api_client.dart';

/// Synthèse d'une journée de présence (calculée par le serveur).
class AttendanceDayModel {
  final DateTime date;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final int workedMinutes;
  final int lateMinutes;
  final String status;
  final bool hasAnomaly;

  AttendanceDayModel({
    required this.date,
    this.checkIn,
    this.checkOut,
    required this.workedMinutes,
    required this.lateMinutes,
    required this.status,
    required this.hasAnomaly,
  });

  bool get isLate => lateMinutes > 0 || status == 'LATE';

  factory AttendanceDayModel.fromJson(Map<String, dynamic> json) {
    DateTime? ts(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
    int n(dynamic v) => v is num ? v.toInt() : int.tryParse('${v ?? 0}') ?? 0;
    return AttendanceDayModel(
      // « date » est un jour calendaire (AAAA-MM-JJ) : pas de conversion de fuseau
      date: DateTime.parse(json['date'].toString().substring(0, 10)),
      checkIn: ts(json['first_check_in']),
      checkOut: ts(json['last_check_out']),
      workedMinutes: n(json['worked_minutes']),
      lateMinutes: n(json['late_minutes']),
      status: json['status']?.toString() ?? 'PRESENT',
      hasAnomaly: json['has_anomaly'] == true,
    );
  }
}

class AttendanceService {
  final ApiClient apiClient;

  AttendanceService({required this.apiClient});

  /// Envoie le jeton QR scanné (valable 15 secondes) avec la géolocalisation
  Future<Map<String, dynamic>> punch({
    required String qrToken,
    String type = 'IN',
    double? latitude,
    double? longitude,
    String? deviceMeta,
  }) async {
    final response = await apiClient.post('/attendance/punch', {
      'token': qrToken,
      'type': type,
      'latitude': latitude,
      'longitude': longitude,
      'device_meta': deviceMeta ?? 'NTEMO ONE Mobile App (Flutter)',
    });

    return response as Map<String, dynamic>;
  }

  /// Historique des 30 dernières journées de l'utilisateur
  Future<List<AttendanceDayModel>> getMyAttendances() async {
    final response = await apiClient.get('/attendance/my-records');
    if (response is Map && response['data'] is List) {
      return (response['data'] as List)
          .whereType<Map>()
          .map((e) => AttendanceDayModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return [];
  }
}

