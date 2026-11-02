import '../../core/api/api_client.dart';

class EmployeeProfile {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? organizationName;
  final String? matricule;
  final String? department;
  final String? position;
  final String? hireDate;
  final List<String> roles;

  EmployeeProfile({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.organizationName,
    this.matricule,
    this.department,
    this.position,
    this.hireDate,
    required this.roles,
  });

  factory EmployeeProfile.fromJson(Map<String, dynamic> json) {
    final org = json['organization'] as Map<String, dynamic>?;
    final emp = json['employee'] as Map<String, dynamic>?;
    final rolesList = (json['roles'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];

    return EmployeeProfile(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      organizationName: org?['name'],
      matricule: emp?['matricule'],
      department: emp?['department']?['name'],
      position: emp?['position']?['title'],
      hireDate: emp?['hire_date'],
      roles: rolesList,
    );
  }
}

class ProfileService {
  final ApiClient apiClient;

  ProfileService({required this.apiClient});

  Future<EmployeeProfile> getMyProfile() async {
    final response = await apiClient.get('/auth/me');
    if (response is Map && response['data'] != null) {
      return EmployeeProfile.fromJson(response['data'] as Map<String, dynamic>);
    }
    throw ApiException("Impossible de charger les données du profil.");
  }
}
