import '../../core/api/api_client.dart';

class VirtualBadge {
  final String id;
  final String badgeNumber;
  final String securityToken;
  final String status;
  final String issuedAt;
  final String? expiresAt;
  final String employeeMatricule;
  final String employeeName;
  final String? department;
  final String? position;
  final String? photoPath;

  VirtualBadge({
    required this.id,
    required this.badgeNumber,
    required this.securityToken,
    required this.status,
    required this.issuedAt,
    this.expiresAt,
    required this.employeeMatricule,
    required this.employeeName,
    this.department,
    this.position,
    this.photoPath,
  });

  factory VirtualBadge.fromJson(Map<String, dynamic> json) {
    final emp = json['employee'] as Map<String, dynamic>? ?? {};
    return VirtualBadge(
      id: json['id'] ?? '',
      badgeNumber: json['badge_number'] ?? '',
      securityToken: json['security_token'] ?? '',
      status: json['status'] ?? 'ACTIVE',
      issuedAt: json['issued_at'] ?? '',
      expiresAt: json['expires_at'],
      employeeMatricule: emp['matricule'] ?? '',
      employeeName: emp['full_name'] ?? '',
      department: emp['department'],
      position: emp['position'],
      photoPath: emp['photo_path'],
    );
  }
}

class BadgeService {
  final ApiClient apiClient;

  BadgeService({required this.apiClient});

  Future<VirtualBadge> getMyVirtualBadge() async {
    final response = await apiClient.get('/badges/my-badge');
    if (response is Map && response['data'] != null) {
      return VirtualBadge.fromJson(response['data'] as Map<String, dynamic>);
    }
    throw ApiException("Aucun badge actif disponible.");
  }
}
