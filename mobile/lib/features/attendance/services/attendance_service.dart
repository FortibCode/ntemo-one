import 'package:ntemo_one_mobile/core/api/api_client.dart';

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

  /// Récupère l'historique des présences de l'utilisateur
  Future<List<dynamic>> getMyAttendances() async {
    final response = await apiClient.get('/attendance/my-records');
    if (response is Map && response['data'] is List) {
      return response['data'] as List<dynamic>;
    }
    return [];
  }
}

