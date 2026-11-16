import 'package:ntemo_one_mobile/core/api/api_client.dart';

class AppNotificationModel {
  final String id;
  final String type;
  final String title;
  final String message;
  final DateTime? createdAt;
  final bool isRead;

  AppNotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    this.createdAt,
    required this.isRead,
  });

  factory AppNotificationModel.fromJson(Map<String, dynamic> json) => AppNotificationModel(
        id: json['id'].toString(),
        type: json['type']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        message: json['message']?.toString() ?? '',
        createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '')?.toLocal(),
        isRead: json['read_at'] != null,
      );

  AppNotificationModel copyRead() =>
      AppNotificationModel(id: id, type: type, title: title, message: message, createdAt: createdAt, isRead: true);
}

class NotificationsPage {
  final List<AppNotificationModel> items;
  final int unreadCount;

  NotificationsPage(this.items, this.unreadCount);
}

class NotificationsService {
  final ApiClient apiClient;

  NotificationsService({required this.apiClient});

  Future<NotificationsPage> fetch() async {
    final response = await apiClient.get('/notifications');
    if (response is! Map) return NotificationsPage(const [], 0);
    final items = (response['data'] is List ? response['data'] as List : const [])
        .whereType<Map>()
        .map((e) => AppNotificationModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final unread = response['unread_count'] is num ? (response['unread_count'] as num).toInt() : 0;
    return NotificationsPage(items, unread);
  }

  Future<int> unreadCount() async => (await fetch()).unreadCount;

  Future<void> markAsRead(String id) => apiClient.post('/notifications/$id/read');

  Future<void> markAllAsRead() => apiClient.post('/notifications/read-all');
}
