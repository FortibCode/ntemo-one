import 'package:ntemo_one_mobile/core/api/api_client.dart';

class TaskModel {
  final String id;
  final String title;
  final String? description;
  final String priority;
  final String status;
  final DateTime? dueDate;
  final bool isOverdue;
  final double? estimatedHours;
  final String? projectName;
  final String? projectCode;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    required this.priority,
    required this.status,
    this.dueDate,
    required this.isOverdue,
    this.estimatedHours,
    this.projectName,
    this.projectCode,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    final project = json['project'] is Map ? Map<String, dynamic>.from(json['project'] as Map) : const {};
    final due = json['due_date']?.toString();
    return TaskModel(
      id: json['id'].toString(),
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      priority: json['priority']?.toString() ?? 'MEDIUM',
      status: json['status']?.toString() ?? 'TODO',
      dueDate: due == null || due.length < 10 ? null : DateTime.parse(due.substring(0, 10)),
      isOverdue: json['is_overdue'] == true,
      estimatedHours: json['estimated_hours'] is num ? (json['estimated_hours'] as num).toDouble() : null,
      projectName: project['name']?.toString(),
      projectCode: project['code']?.toString(),
    );
  }
}

class TasksService {
  final ApiClient apiClient;

  TasksService({required this.apiClient});

  static const statuses = {
    'TODO': 'À faire',
    'IN_PROGRESS': 'En cours',
    'REVIEW': 'En revue',
    'DONE': 'Terminée',
  };

  static const priorities = {
    'LOW': 'Basse',
    'MEDIUM': 'Moyenne',
    'HIGH': 'Haute',
    'URGENT': 'Urgente',
  };

  Future<List<TaskModel>> myTasks() async {
    final response = await apiClient.get('/tasks/mine');
    if (response is Map && response['data'] is List) {
      return (response['data'] as List)
          .whereType<Map>()
          .map((e) => TaskModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return [];
  }

  Future<void> updateStatus(String taskId, String status) => apiClient.put('/tasks/$taskId', {'status': status});
}
