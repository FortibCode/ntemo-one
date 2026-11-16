import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/features/badge/services/badge_service.dart';
import 'package:qr_flutter/qr_flutter.dart';

class VirtualBadgeScreen extends StatefulWidget {
  final ApiClient apiClient;

  const VirtualBadgeScreen({super.key, required this.apiClient});

  @override
  State<VirtualBadgeScreen> createState() => _VirtualBadgeScreenState();
}

class _VirtualBadgeScreenState extends State<VirtualBadgeScreen> {
  late final BadgeService _badgeService;
  VirtualBadge? _badge;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _badgeService = BadgeService(apiClient: widget.apiClient);
    _loadBadge();
  }

  Future<void> _loadBadge() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final badge = await _badgeService.getMyVirtualBadge();
      if (!mounted) return;
      setState(() {
        _badge = badge;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
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
              const Icon(Icons.badge_outlined, size: 64, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadBadge,
                child: const Text('Actualiser'),
              ),
            ],
          ),
        ),
      );
    }

    final badge = _badge!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          // Carte Badge Virtuel Professionnelle
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E1B4B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 16,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'NTEMO CONSULTING',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.greenAccent),
                      ),
                      child: Text(
                        badge.status,
                        style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white12,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Icon(Icons.person, size: 48, color: Colors.white),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            badge.employeeName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            badge.position ?? 'Collaborateur',
                            style: const TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                          Text(
                            badge.department ?? 'Direction',
                            style: const TextStyle(color: Colors.white38, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('MATRICULE', style: TextStyle(color: Colors.white38, fontSize: 10)),
                          Text(
                            badge.employeeMatricule,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('NUMÉRO BADGE', style: TextStyle(color: Colors.white38, fontSize: 10)),
                          Text(
                            badge.badgeNumber,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: badge.securityToken.isEmpty
                        ? const Icon(Icons.qr_code_2, size: 160, color: Colors.black26)
                        : QrImageView(
                            data: badge.securityToken,
                            version: QrVersions.auto,
                            size: 180,
                            gapless: true,
                            errorCorrectionLevel: QrErrorCorrectLevel.M,
                            semanticsLabel: 'QR code du badge virtuel',
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'Jeton sécurisé : ${badge.securityToken.length > 16 ? '${badge.securityToken.substring(0, 16)}…' : badge.securityToken}',
                    style: const TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'monospace'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _loadBadge,
            icon: const Icon(Icons.refresh),
            label: const Text('Actualiser les autorisations du badge'),
          ),
        ],
      ),
    );
  }
}

