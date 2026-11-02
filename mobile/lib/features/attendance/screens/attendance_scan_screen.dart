import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../services/attendance_service.dart';

class AttendanceScanScreen extends StatefulWidget {
  final ApiClient apiClient;

  const AttendanceScanScreen({super.key, required this.apiClient});

  @override
  State<AttendanceScanScreen> createState() => _AttendanceScanScreenState();
}

class _AttendanceScanScreenState extends State<AttendanceScanScreen> {
  late final AttendanceService _attendanceService;
  final TextEditingController _manualTokenController = TextEditingController();
  bool _isLoading = false;
  String? _successMessage;
  String? _errorMessage;
  String _punchType = 'IN'; // IN, OUT

  @override
  void initState() {
    super.initState();
    _attendanceService = AttendanceService(apiClient: widget.apiClient);
  }

  @override
  void dispose() {
    _manualTokenController.dispose();
    super.dispose();
  }

  Future<void> _submitPunch(String rawToken) async {
    if (rawToken.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final result = await _attendanceService.punch(
        qrToken: rawToken.trim(),
        type: _punchType,
        deviceMeta: 'Flutter Mobile Scanner (Android/iOS)',
      );

      setState(() {
        _successMessage = "Pointage validé avec succès (${_punchType == 'IN' ? 'Entrée' : 'Sortie'}) à ${DateTime.now().toIso8601String().substring(11, 16)} !";
        _manualTokenController.clear();
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // En-tête statut
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.indigo.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.indigo.shade100),
            ),
            child: Row(
              children: [
                const Icon(Icons.security, color: Color(0xFF4F46E5), size: 32),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Pointage Sécurisé 15s',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      Text(
                        'Signature cryptographique HMAC anti-rejeu',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Sélecteur Type de Pointage
          SegmentedButton<String>(
            segments: const [
              ButtonSegment<String>(
                value: 'IN',
                label: Text('Arrivée / Entrée'),
                icon: Icon(Icons.login),
              ),
              ButtonSegment<String>(
                value: 'OUT',
                label: Text('Départ / Sortie'),
                icon: Icon(Icons.logout),
              ),
            ],
            selected: {_punchType},
            onSelectionChanged: (Set<String> newSelection) {
              setState(() {
                _punchType = newSelection.first;
              });
            },
          ),
          const SizedBox(height: 24),

          // Scanner visuel simulé / interactif
          Center(
            child: Container(
              height: 220,
              width: 220,
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFF4F46E5), width: 3),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.qr_code_scanner, color: Colors.white38, size: 100),
                  Positioned(
                    bottom: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Alignez le QR code dynamique',
                        style: TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Champ de saisie ou scan direct
          TextField(
            controller: _manualTokenController,
            decoration: InputDecoration(
              labelText: 'Jeton ou Token QR Scanné',
              hintText: 'Collez le token ou scannez le QR code...',
              prefixIcon: const Icon(Icons.qr_code),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),

          FilledButton.icon(
            onPressed: _isLoading
                ? null
                : () => _submitPunch(_manualTokenController.text),
            icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.fingerprint),
            label: Text(_isLoading ? 'Validation serveur...' : 'Valider le Pointage'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),

          if (_successMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.greenAccent.shade700),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _successMessage!,
                      style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

