import '../../core/api/api_client.dart';

class LeaveTypeModel {
  final String id;
  final String name;
  final String? code;
  final double defaultDaysPerYear;
  final bool isPaid;

  LeaveTypeModel({
    required this.id,
    required this.name,
    this.code,
    required this.defaultDaysPerYear,
    required this.isPaid,
  });

  factory LeaveTypeModel.fromJson(Map<String, dynamic> json) {
    return LeaveTypeModel(
      id: json['id'],
      name: json['name'],
      code: json['code'],
      defaultDaysPerYear: double.tryParse(json['default_days_per_year'].toString()) ?? 26.0,
      isPaid: json['is_paid'] ?? true,
    );
  }
}

class LeaveRequestModel {
  final String id;
  final String leaveTypeName;
  final String startDate;
  final String endDate;
  final double totalDays;
  final String reason;
  final String status;
  final String createdAt;

  LeaveRequestModel({
    required this.id,
    required this.leaveTypeName,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  factory LeaveRequestModel.fromJson(Map<String, dynamic> json) {
    final typeMap = json['leave_type'] as Map<String, dynamic>?;
    return LeaveRequestModel(
      id: json['id'],
      leaveTypeName: typeMap != null ? typeMap['name'] : 'Congé',
      startDate: json['start_date'],
      endDate: json['end_date'],
      totalDays: double.tryParse(json['total_days'].toString()) ?? 1.0,
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'PENDING_N1',
      createdAt: json['created_at'] != null ? json['created_at'].toString().substring(0, 10) : '',
    );
  }
}

class LeavesService {
  final ApiClient apiClient;

  LeavesService({required this.apiClient});

  Future<List<LeaveTypeModel>> getLeaveTypes() async {
    final response = await apiClient.get('/leaves/types');
    if (response is Map && response['data'] is List) {
      return (response['data'] as List)
          .map((item) => LeaveTypeModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<LeaveRequestModel>> getMyLeaveRequests() async {
    final response = await apiClient.get('/leaves/my-requests');
    if (response is Map && response['data'] is List) {
      return (response['data'] as List)
          .map((item) => LeaveRequestModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<LeaveRequestModel> submitLeaveRequest({
    required String leaveTypeId,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    final response = await apiClient.post('/leaves/requests', {
      'leave_type_id': leaveTypeId,
      'start_date': startDate,
      'end_date': endDate,
      'reason': reason,
    });

    if (response is Map && response['data'] != null) {
      return LeaveRequestModel.fromJson(response['data'] as Map<String, dynamic>);
    }
    throw ApiException("Échec du dépôt de la demande.");
  }
}
