import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/attendance/screens/qr_scanner_screen.dart';
import 'package:ntemo_one_mobile/features/attendance/services/attendance_service.dart';

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
      await _attendanceService.punch(
        qrToken: rawToken.trim(),
        type: _punchType,
        deviceMeta: 'Flutter Mobile Scanner (Android/iOS)',
      );

      if (!mounted) return;
      final now = TimeOfDay.now();
      final time = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
      setState(() {
        _successMessage = "Pointage validé avec succès (${_punchType == 'IN' ? 'Entrée' : 'Sortie'}) à $time !";
        _manualTokenController.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openScanner() async {
    final token = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const QrScannerScreen(), fullscreenDialog: true),
    );
    if (!mounted || token == null) return;
    await _submitPunch(token);
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
              color: Colors.lightBlue.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.lightBlue.shade100),
            ),
            child: const Row(
              children: [
                Icon(Icons.security, color: AppColors.primary, size: 32),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
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

          // Scan caméra du QR dynamique de la borne
          FilledButton.icon(
            key: const Key('attendance-scan'),
            onPressed: _isLoading ? null : _openScanner,
            icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.qr_code_scanner, size: 28),
            label: Text(
              _isLoading ? 'Validation serveur...' : 'Scanner le QR code',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 22),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Le QR code de la borne est valable ${AppConstants.qrTtlSeconds} secondes et ne peut être utilisé qu’une fois.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
          const SizedBox(height: 16),

          // Saisie manuelle de secours (caméra indisponible)
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const Text('Saisie manuelle du jeton', style: TextStyle(fontSize: 14)),
              subtitle: const Text('En cas de caméra indisponible', style: TextStyle(fontSize: 12)),
              children: [
                TextField(
                  controller: _manualTokenController,
                  decoration: InputDecoration(
                    labelText: 'Jeton QR',
                    hintText: 'Collez le jeton affiché sur la borne...',
                    prefixIcon: const Icon(Icons.qr_code),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isLoading ? null : () => _submitPunch(_manualTokenController.text),
                    icon: const Icon(Icons.fingerprint),
                    label: const Text('Valider le pointage'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
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

