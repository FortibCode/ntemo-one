/// Utilisateur authentifié, tel que renvoyé par `POST /auth/login`.
class AuthUser {
  final String id;
  final String name;
  final String email;
  final String? roleName;
  final List<String> roles;
  final List<String> permissions;
  final String? matricule;
  final String? department;
  final String? position;
  final String? organizationName;

  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    this.roleName,
    this.roles = const [],
    this.permissions = const [],
    this.matricule,
    this.department,
    this.position,
    this.organizationName,
  });

  bool can(String permission) => permissions.contains('*') || permissions.contains(permission);

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final employee = json['employee'] as Map<String, dynamic>?;
    final organization = json['organization'] as Map<String, dynamic>?;
    List<String> strings(dynamic v) => v is List ? v.map((e) => e.toString()).toList() : const [];

    return AuthUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      roleName: json['role_name'] as String?,
      roles: strings(json['roles']),
      permissions: strings(json['permissions']),
      matricule: employee?['matricule'] as String?,
      department: employee?['department'] as String?,
      position: employee?['position'] as String?,
      organizationName: organization?['name'] as String?,
    );
  }

  /// Format de persistance locale (même forme que la réponse API, pour un seul parseur).
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role_name': roleName,
        'roles': roles,
        'permissions': permissions,
        'employee': {
          'matricule': matricule,
          'department': department,
          'position': position,
        },
        'organization': {'name': organizationName},
      };
}
