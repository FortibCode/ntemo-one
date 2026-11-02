import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../services/leaves_service.dart';

class LeavesScreen extends StatefulWidget {
  final ApiClient apiClient;

  const LeavesScreen({super.key, required this.apiClient});

  @override
  State<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends State<LeavesScreen> {
  late final LeavesService _leavesService;
  List<LeaveRequestModel> _requests = [];
  List<LeaveTypeModel> _types = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _leavesService = LeavesService(apiClient: widget.apiClient);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final types = await _leavesService.getLeaveTypes();
      final requests = await _leavesService.getMyLeaveRequests();
      setState(() {
        _types = types;
        _requests = requests;
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

  void _showNewRequestDialog() {
    if (_types.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aucun type de congé configuré.')),
      );
      return;
    }

    String selectedTypeId = _types.first.id;
    final reasonController = TextEditingController();
    DateTime startDate = DateTime.now().add(const Duration(days: 1));
    DateTime endDate = DateTime.now().add(const Duration(days: 5));

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Nouvelle Demande de Congé', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Type de Congé', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: selectedTypeId,
                  items: _types.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedTypeId = val);
                  },
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                const Text('Période souhaitée', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(
                  'Du ${startDate.toIso8601String().substring(0, 10)} au ${endDate.toIso8601String().substring(0, 10)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
                ),
                const SizedBox(height: 16),
                const Text('Motif de la demande', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                TextField(
                  controller: reasonController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Précisez la raison de votre absence...',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                reasonController.dispose();
                Navigator.pop(ctx);
              },
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () async {
                final reason = reasonController.text.trim();
                reasonController.dispose();
                if (reason.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await _leavesService.submitLeaveRequest(
                    leaveTypeId: selectedTypeId,
                    startDate: startDate.toIso8601String().substring(0, 10),
                    endDate: endDate.toIso8601String().substring(0, 10),
                    reason: reason,
                  );
                  if (mounted) _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Demande de congé déposée avec succès !')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString())),
                    );
                  }
                }
              },
              child: const Text('Soumettre'),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      case 'PENDING_HR':
        return Colors.orange;
      case 'PENDING_N1':
      default:
        return Colors.indigo;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewRequestDialog,
        icon: const Icon(Icons.add),
        label: const Text('Demander un congé'),
        backgroundColor: const Color(0xFF4F46E5),
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _requests.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.beach_access, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          const Text(
                            'Aucune demande de congé enregistrée',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Déposez une demande en appuyant sur le bouton ci-dessous.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _requests.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final req = _requests[index];
                        return Card(
                          elevation: 2,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      req.leaveTypeName,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(req.status).withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: _getStatusColor(req.status)),
                                      ),
                                      child: Text(
                                        req.status,
                                        style: TextStyle(
                                          color: _getStatusColor(req.status),
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Du ${req.startDate} au ${req.endDate} (${req.totalDays} jours ouvrés)',
                                  style: const TextStyle(color: Colors.black87, fontSize: 13),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Motif : ${req.reason}',
                                  style: const TextStyle(color: Colors.black54, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

