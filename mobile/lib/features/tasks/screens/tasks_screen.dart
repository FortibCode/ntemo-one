import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/tasks/services/tasks_service.dart';

/// Tâches attribuées au collaborateur, avec mise à jour du statut.
class TasksScreen extends StatefulWidget {
  final ApiClient apiClient;

  const TasksScreen({super.key, required this.apiClient});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  late final TasksService _service;
  List<TaskModel> _tasks = [];
  bool _loading = true;
  bool _showDone = false;
  String? _error;
  String? _updatingId;

  @override
  void initState() {
    super.initState();
    _service = TasksService(apiClient: widget.apiClient);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tasks = await _service.myTasks();
      if (!mounted) return;
      setState(() => _tasks = tasks);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeStatus(TaskModel task) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(task.title, style: const TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
            ),
            for (final entry in TasksService.statuses.entries)
              ListTile(
                leading: Icon(
                  entry.key == task.status ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: AppColors.logoBlue,
                ),
                title: Text(entry.value),
                onTap: () => Navigator.pop(ctx, entry.key),
              ),
          ],
        ),
      ),
    );
    if (selected == null || selected == task.status || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _updatingId = task.id);
    try {
      await _service.updateStatus(task.id, selected);
      messenger.showSnackBar(SnackBar(content: Text('« ${task.title} » : ${TasksService.statuses[selected]}')));
      await _load();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  static Color _priorityColor(String p) => switch (p) {
        'URGENT' => Colors.red.shade700,
        'HIGH' => Colors.orange.shade800,
        'LOW' => Colors.blueGrey,
        _ => AppColors.logoBlue,
      };

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Réessayer')),
          ]),
        ),
      );
    }

    final open = _tasks.where((t) => t.status != 'DONE').toList();
    final done = _tasks.where((t) => t.status == 'DONE').toList();
    final overdue = open.where((t) => t.isOverdue).length;
    final visible = _showDone ? _tasks : open;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${open.length} tâche(s) en cours${overdue > 0 ? ' • $overdue en retard' : ''}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: overdue > 0 ? Colors.red.shade700 : Colors.black87,
                  ),
                ),
              ),
              if (done.isNotEmpty)
                FilterChip(
                  label: Text('Terminées (${done.length})'),
                  selected: _showDone,
                  onSelected: (v) => setState(() => _showDone = v),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Column(children: [
                Icon(Icons.task_alt, size: 56, color: Colors.black26),
                SizedBox(height: 12),
                Text('Aucune tâche en cours.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
              ]),
            ),
          for (final task in visible)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: task.isOverdue ? BorderSide(color: Colors.red.shade200) : BorderSide.none,
              ),
              elevation: 0.8,
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                title: Text(
                  task.title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    decoration: task.status == 'DONE' ? TextDecoration.lineThrough : null,
                  ),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (task.projectName != null) Text(task.projectName!, style: const TextStyle(fontSize: 12)),
                      const SizedBox(height: 4),
                      Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        Text(
                          TasksService.priorities[task.priority] ?? task.priority,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _priorityColor(task.priority)),
                        ),
                        if (task.dueDate != null)
                          Text(
                            '${task.isOverdue ? '⚠ En retard • ' : ''}échéance ${DateFormat('d MMM', 'fr_FR').format(task.dueDate!)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: task.isOverdue ? Colors.red.shade700 : Colors.black54,
                              fontWeight: task.isOverdue ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                      ]),
                    ],
                  ),
                ),
                trailing: _updatingId == task.id
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : ActionChip(
                        label: Text(TasksService.statuses[task.status] ?? task.status, style: const TextStyle(fontSize: 12)),
                        onPressed: () => _changeStatus(task),
                      ),
              ),
            ),
        ],
      ),
    );
  }
}
