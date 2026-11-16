import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/features/leaves/services/leaves_service.dart';

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
  List<LeaveBalanceModel> _balances = [];
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
      final balances = await _leavesService.getBalances();
      if (!mounted) return;
      setState(() {
        _types = types;
        _requests = requests;
        _balances = balances;
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

  static String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  static String _isoDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _showNewRequestDialog() {
    if (_types.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aucun type de congé configuré.')),
      );
      return;
    }

    String selectedTypeId = _types.first.id;
    final reasonController = TextEditingController();
    final tomorrow =
        DateUtils.dateOnly(DateTime.now()).add(const Duration(days: 1));
    DateTime startDate = tomorrow;
    DateTime endDate = tomorrow.add(const Duration(days: 4));

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Nouvelle Demande de Congé',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Type de Congé',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: selectedTypeId,
                  items: _types
                      .map((t) =>
                          DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedTypeId = val);
                  },
                  decoration:
                      const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                const Text('Période souhaitée',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  key: const Key('leave-date-range'),
                  onPressed: () async {
                    final today = DateUtils.dateOnly(DateTime.now());
                    final picked = await showDateRangePicker(
                      context: ctx,
                      firstDate: today,
                      lastDate: today.add(const Duration(days: 365)),
                      initialDateRange:
                          DateTimeRange(start: startDate, end: endDate),
                      helpText: 'Période du congé',
                      saveText: 'Valider',
                    );
                    if (picked != null) {
                      setDialogState(() {
                        startDate = picked.start;
                        endDate = picked.end;
                      });
                    }
                  },
                  icon: const Icon(Icons.date_range),
                  label: Text(
                    'Du ${_formatDate(startDate)} au ${_formatDate(endDate)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Motif de la demande',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () async {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) return;
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(ctx);
                try {
                  await _leavesService.submitLeaveRequest(
                    leaveTypeId: selectedTypeId,
                    startDate: _isoDate(startDate),
                    endDate: _isoDate(endDate),
                    reason: reason,
                  );
                  if (!mounted) return;
                  _loadData();
                  messenger.showSnackBar(
                    const SnackBar(
                        content:
                            Text('Demande de congé déposée avec succès !')),
                  );
                } catch (e) {
                  if (!mounted) return;
                  messenger.showSnackBar(SnackBar(content: Text(e.toString())));
                }
              },
              child: const Text('Soumettre'),
            ),
          ],
        ),
      ),
    ).then((_) {
      reasonController.dispose();
    });
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

  static String _statusLabel(String status) => switch (status) {
        'PENDING_N1' => 'En attente N+1',
        'PENDING_HR' => 'En attente RH',
        'APPROVED' => 'Approuvé',
        'REJECTED' => 'Refusé',
        'CANCELLED' => 'Annulé',
        _ => status,
      };

  /// « 2026-11-23 » ou « 2026-11-23T00:00:00Z » → « 23/11/2026 »
  static String _displayDate(String raw) {
    final d = DateTime.tryParse(raw.length >= 10 ? raw.substring(0, 10) : raw);
    return d == null ? raw : _formatDate(d);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewRequestDialog,
        icon: const Icon(Icons.add),
        label: const Text('Demander un congé'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          if (!_isLoading && _balances.isNotEmpty) _buildBalances(),
          Expanded(child: _buildRequests()),
        ],
      ),
    );
  }

  /// Soldes de l'année : jours restants par type de congé (demandes en attente déduites).
  Widget _buildBalances() {
    return SizedBox(
      height: 116,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        scrollDirection: Axis.horizontal,
        itemCount: _balances.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final b = _balances[i];
          String fmt(double v) => v == v.roundToDouble()
              ? v.toInt().toString()
              : v.toStringAsFixed(1);
          return Container(
            width: 150,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.logoMist.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(b.typeName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 4),
                Text('${fmt(b.remaining)} j',
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.logoNavy)),
                Text(
                  b.pending > 0
                      ? 'sur ${fmt(b.allocated)} • ${fmt(b.pending)} en attente'
                      : 'restants sur ${fmt(b.allocated)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: Colors.black45),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildRequests() {
    return _isLoading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
            ? Center(child: Text(_error!))
            : _requests.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.beach_access,
                            size: 64, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        const Text(
                          'Aucune demande de congé enregistrée',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
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
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    req.leaveTypeName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: _getStatusColor(req.status)
                                          .withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                          color: _getStatusColor(req.status)),
                                    ),
                                    child: Text(
                                      _statusLabel(req.status),
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
                                'Du ${_displayDate(req.startDate)} au ${_displayDate(req.endDate)} (${req.totalDays.toStringAsFixed(req.totalDays == req.totalDays.roundToDouble() ? 0 : 1)} jours ouvrés)',
                                style: const TextStyle(
                                    color: Colors.black87, fontSize: 13),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Motif : ${req.reason}',
                                style: const TextStyle(
                                    color: Colors.black54, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
  }
}
