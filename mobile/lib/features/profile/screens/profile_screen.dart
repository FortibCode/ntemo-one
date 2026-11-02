import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../services/profile_service.dart';

class ProfileScreen extends StatefulWidget {
  final ApiClient apiClient;

  const ProfileScreen({super.key, required this.apiClient});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final ProfileService _profileService;
  EmployeeProfile? _profile;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _profileService = ProfileService(apiClient: widget.apiClient);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final profile = await _profileService.getMyProfile();
      setState(() {
        _profile = profile;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.redAccent),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _loadProfile, child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }

    final p = _profile!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          // En-tête Avatar
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 46,
                  backgroundColor: const Color(0xFF4F46E5),
                  child: Text(
                    p.name.isNotEmpty ? p.name.substring(0, 1).toUpperCase() : 'N',
                    style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  p.name,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                Text(
                  p.position ?? 'Collaborateur',
                  style: const TextStyle(color: Colors.black54, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.indigo.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    p.organizationName ?? 'NTEMO Consulting',
                    style: const TextStyle(color: Color(0xFF4F46E5), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Informations détaillées
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 1.5,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  _buildProfileTile(Icons.badge, 'Matricule', p.matricule ?? 'Non assigné'),
                  const Divider(),
                  _buildProfileTile(Icons.email, 'Email professionnel', p.email),
                  const Divider(),
                  _buildProfileTile(Icons.phone, 'Téléphone', p.phone ?? 'Non renseigné'),
                  const Divider(),
                  _buildProfileTile(Icons.corporate_fare, 'Département', p.department ?? 'Direction Générale'),
                  const Divider(),
                  _buildProfileTile(Icons.calendar_today, 'Date d\'embauche', p.hireDate ?? '-'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF4F46E5), size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: Colors.black45)),
                Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

