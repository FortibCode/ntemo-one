import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/notifications/services/notifications_service.dart';

class NotificationsScreen extends StatefulWidget {
  final NotificationsService service;

  const NotificationsScreen({super.key, required this.service});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotificationModel> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.service.fetch();
      if (!mounted) return;
      setState(() => _items = page.items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(AppNotificationModel n) async {
    if (n.isRead) return;
    setState(() => _items = [for (final i in _items) i.id == n.id ? i.copyRead() : i]);
    try {
      await widget.service.markAsRead(n.id);
    } catch (_) {
      // Sans gravité : l'état « lu » sera resynchronisé au prochain chargement
    }
  }

  Future<void> _markAll() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.service.markAllAsRead();
      if (!mounted) return;
      setState(() => _items = [for (final i in _items) i.copyRead()]);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  static IconData _icon(String type) => switch (type) {
        'TASK_ASSIGNED' => Icons.assignment_outlined,
        'LEAVE_DECISION' => Icons.beach_access_outlined,
        'CORRECTION_DECISION' => Icons.edit_calendar_outlined,
        'TIMESHEET_DECISION' => Icons.schedule_outlined,
        'BADGE' => Icons.badge_outlined,
        _ => Icons.notifications_none,
      };

  static String _when(DateTime? d) {
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'à l’instant';
    if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
    return DateFormat('d MMM à HH:mm', 'fr_FR').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _items.any((n) => !n.isRead);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(onPressed: _markAll, child: const Text('Tout marquer comme lu')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center))])
                : _items.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          Icon(Icons.notifications_off_outlined, size: 56, color: Colors.black26),
                          SizedBox(height: 12),
                          Text('Aucune notification.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
                        ],
                      )
                    : ListView.separated(
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final n = _items[i];
                          return ListTile(
                            onTap: () => _markRead(n),
                            tileColor: n.isRead ? null : AppColors.logoMist.withValues(alpha: 0.5),
                            leading: CircleAvatar(
                              backgroundColor: AppColors.logoMist,
                              child: Icon(_icon(n.type), color: AppColors.logoBlue),
                            ),
                            title: Text(
                              n.title,
                              style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 2),
                                Text(n.message),
                                const SizedBox(height: 4),
                                Text(_when(n.createdAt), style: const TextStyle(fontSize: 11, color: Colors.black45)),
                              ],
                            ),
                            isThreeLine: true,
                            trailing: n.isRead
                                ? null
                                : const Icon(Icons.circle, size: 10, color: AppColors.logoCyan, semanticLabel: 'Non lue'),
                          );
                        },
                      ),
      ),
    );
  }
}
