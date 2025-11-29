// GDPR関連データモデル
// データエクスポートと削除リクエストの管理
//
// @version 1.0.0
// @date 2025-11-29

import 'package:cloud_firestore/cloud_firestore.dart';

/// Export request status
enum ExportStatus {
  pending,
  processing,
  completed,
  failed,
  expired,
}

/// Export format type
enum ExportFormat {
  json,
  csv,
}

/// Export scope type
enum ExportScopeType {
  all,
  dateRange,
  specific,
}

/// Deletion type
enum DeletionType {
  soft, // 30 days grace period
  hard, // Immediate deletion
  partial, // Partial data deletion
}

/// Deletion status
enum DeletionStatus {
  pending,
  scheduled,
  processing,
  completed,
  cancelled,
}

/// Export scope configuration
class ExportScope {
  final ExportScopeType type;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<String>? dataTypes;

  const ExportScope({
    required this.type,
    this.startDate,
    this.endDate,
    this.dataTypes,
  });

  factory ExportScope.all() {
    return const ExportScope(type: ExportScopeType.all);
  }

  factory ExportScope.dateRange({
    required DateTime startDate,
    required DateTime endDate,
  }) {
    return ExportScope(
      type: ExportScopeType.dateRange,
      startDate: startDate,
      endDate: endDate,
    );
  }

  factory ExportScope.specific({
    required List<String> dataTypes,
  }) {
    return ExportScope(
      type: ExportScopeType.specific,
      dataTypes: dataTypes,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': type.name,
      if (startDate != null) 'startDate': Timestamp.fromDate(startDate!),
      if (endDate != null) 'endDate': Timestamp.fromDate(endDate!),
      if (dataTypes != null) 'dataTypes': dataTypes,
    };
  }

  factory ExportScope.fromMap(Map<String, dynamic> map) {
    return ExportScope(
      type: ExportScopeType.values.firstWhere(
        (e) => e.name == map['type'],
        orElse: () => ExportScopeType.all,
      ),
      startDate: map['startDate'] != null
          ? (map['startDate'] as Timestamp).toDate()
          : null,
      endDate: map['endDate'] != null
          ? (map['endDate'] as Timestamp).toDate()
          : null,
      dataTypes: map['dataTypes'] != null
          ? List<String>.from(map['dataTypes'])
          : null,
    );
  }
}

/// Export request model
class ExportRequest {
  final String requestId;
  final String userId;
  final ExportFormat format;
  final ExportScope scope;
  final ExportStatus status;
  final DateTime requestedAt;
  final DateTime? completedAt;
  final String? downloadUrl;
  final DateTime? expiresAt;
  final String? errorMessage;

  const ExportRequest({
    required this.requestId,
    required this.userId,
    required this.format,
    required this.scope,
    required this.status,
    required this.requestedAt,
    this.completedAt,
    this.downloadUrl,
    this.expiresAt,
    this.errorMessage,
  });

  /// Check if the download link has expired
  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// Check if download is available
  bool get canDownload {
    return status == ExportStatus.completed &&
        downloadUrl != null &&
        !isExpired;
  }

  /// Get status display text
  String get statusText {
    switch (status) {
      case ExportStatus.pending:
        return '処理待ち';
      case ExportStatus.processing:
        return '処理中';
      case ExportStatus.completed:
        return '完了';
      case ExportStatus.failed:
        return 'エラー';
      case ExportStatus.expired:
        return '期限切れ';
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'requestId': requestId,
      'userId': userId,
      'format': format.name,
      'scope': scope.toMap(),
      'status': status.name,
      'requestedAt': Timestamp.fromDate(requestedAt),
      if (completedAt != null)
        'completedAt': Timestamp.fromDate(completedAt!),
      if (downloadUrl != null) 'downloadUrl': downloadUrl,
      if (expiresAt != null) 'expiresAt': Timestamp.fromDate(expiresAt!),
      if (errorMessage != null) 'error': errorMessage,
    };
  }

  factory ExportRequest.fromMap(Map<String, dynamic> map, String docId) {
    return ExportRequest(
      requestId: map['requestId'] ?? docId,
      userId: map['userId'] ?? '',
      format: ExportFormat.values.firstWhere(
        (e) => e.name == map['format'],
        orElse: () => ExportFormat.json,
      ),
      scope: map['scope'] != null
          ? ExportScope.fromMap(Map<String, dynamic>.from(map['scope']))
          : ExportScope.all(),
      status: ExportStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => ExportStatus.pending,
      ),
      requestedAt: map['requestedAt'] != null
          ? (map['requestedAt'] as Timestamp).toDate()
          : DateTime.now(),
      completedAt: map['completedAt'] != null
          ? (map['completedAt'] as Timestamp).toDate()
          : null,
      downloadUrl: map['downloadUrl'],
      expiresAt: map['expiresAt'] != null
          ? (map['expiresAt'] as Timestamp).toDate()
          : null,
      errorMessage: map['error'],
    );
  }

  ExportRequest copyWith({
    String? requestId,
    String? userId,
    ExportFormat? format,
    ExportScope? scope,
    ExportStatus? status,
    DateTime? requestedAt,
    DateTime? completedAt,
    String? downloadUrl,
    DateTime? expiresAt,
    String? errorMessage,
  }) {
    return ExportRequest(
      requestId: requestId ?? this.requestId,
      userId: userId ?? this.userId,
      format: format ?? this.format,
      scope: scope ?? this.scope,
      status: status ?? this.status,
      requestedAt: requestedAt ?? this.requestedAt,
      completedAt: completedAt ?? this.completedAt,
      downloadUrl: downloadUrl ?? this.downloadUrl,
      expiresAt: expiresAt ?? this.expiresAt,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

/// Deletion scope configuration
class DeletionScope {
  final List<String> collections;
  final bool includeAuth;
  final bool includeStorage;
  final bool includeBigQuery;

  const DeletionScope({
    this.collections = const ['users', 'sessions', 'consents'],
    this.includeAuth = true,
    this.includeStorage = true,
    this.includeBigQuery = true,
  });

  factory DeletionScope.full() {
    return const DeletionScope(
      collections: ['users', 'sessions', 'consents', 'trainingResults'],
      includeAuth: true,
      includeStorage: true,
      includeBigQuery: true,
    );
  }

  factory DeletionScope.partial(List<String> collections) {
    return DeletionScope(
      collections: collections,
      includeAuth: false,
      includeStorage: false,
      includeBigQuery: false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'collections': collections,
      'includeAuth': includeAuth,
      'includeStorage': includeStorage,
      'includeBigQuery': includeBigQuery,
    };
  }

  factory DeletionScope.fromMap(Map<String, dynamic> map) {
    return DeletionScope(
      collections: map['collections'] != null
          ? List<String>.from(map['collections'])
          : const ['users', 'sessions', 'consents'],
      includeAuth: map['includeAuth'] ?? true,
      includeStorage: map['includeStorage'] ?? true,
      includeBigQuery: map['includeBigQuery'] ?? true,
    );
  }
}

/// Deletion request model
class DeletionRequest {
  final String requestId;
  final String userId;
  final DeletionType type;
  final DeletionScope scope;
  final String? reason;
  final DateTime requestedAt;
  final DateTime scheduledAt;
  final DateTime? executedAt;
  final DeletionStatus status;
  final bool canRecover;
  final DateTime? recoverDeadline;
  final DateTime? recoveredAt;
  final DateTime? cancelledAt;

  const DeletionRequest({
    required this.requestId,
    required this.userId,
    required this.type,
    required this.scope,
    this.reason,
    required this.requestedAt,
    required this.scheduledAt,
    this.executedAt,
    required this.status,
    required this.canRecover,
    this.recoverDeadline,
    this.recoveredAt,
    this.cancelledAt,
  });

  /// Get days until deletion
  int get daysUntilDeletion {
    if (status != DeletionStatus.scheduled &&
        status != DeletionStatus.pending) {
      return 0;
    }
    return scheduledAt.difference(DateTime.now()).inDays;
  }

  /// Check if recovery is still possible
  bool get canStillRecover {
    if (!canRecover) return false;
    if (recoverDeadline == null) return false;
    if (status == DeletionStatus.completed ||
        status == DeletionStatus.cancelled) {
      return false;
    }
    return DateTime.now().isBefore(recoverDeadline!);
  }

  /// Get status display text
  String get statusText {
    switch (status) {
      case DeletionStatus.pending:
        return '処理待ち';
      case DeletionStatus.scheduled:
        return '削除予定';
      case DeletionStatus.processing:
        return '処理中';
      case DeletionStatus.completed:
        return '削除完了';
      case DeletionStatus.cancelled:
        return 'キャンセル済み';
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'requestId': requestId,
      'userId': userId,
      'type': type.name,
      'scope': scope.toMap(),
      if (reason != null) 'reason': reason,
      'requestedAt': Timestamp.fromDate(requestedAt),
      'scheduledAt': Timestamp.fromDate(scheduledAt),
      if (executedAt != null) 'executedAt': Timestamp.fromDate(executedAt!),
      'status': status.name,
      'canRecover': canRecover,
      if (recoverDeadline != null)
        'recoverDeadline': Timestamp.fromDate(recoverDeadline!),
      if (recoveredAt != null) 'recoveredAt': Timestamp.fromDate(recoveredAt!),
      if (cancelledAt != null) 'cancelledAt': Timestamp.fromDate(cancelledAt!),
    };
  }

  factory DeletionRequest.fromMap(Map<String, dynamic> map, String docId) {
    return DeletionRequest(
      requestId: map['requestId'] ?? docId,
      userId: map['userId'] ?? '',
      type: DeletionType.values.firstWhere(
        (e) => e.name == map['type'],
        orElse: () => DeletionType.soft,
      ),
      scope: map['scope'] != null
          ? DeletionScope.fromMap(Map<String, dynamic>.from(map['scope']))
          : const DeletionScope(),
      reason: map['reason'],
      requestedAt: map['requestedAt'] != null
          ? (map['requestedAt'] as Timestamp).toDate()
          : DateTime.now(),
      scheduledAt: map['scheduledAt'] != null
          ? (map['scheduledAt'] as Timestamp).toDate()
          : DateTime.now().add(const Duration(days: 30)),
      executedAt: map['executedAt'] != null
          ? (map['executedAt'] as Timestamp).toDate()
          : null,
      status: DeletionStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => DeletionStatus.pending,
      ),
      canRecover: map['canRecover'] ?? true,
      recoverDeadline: map['recoverDeadline'] != null
          ? (map['recoverDeadline'] as Timestamp).toDate()
          : null,
      recoveredAt: map['recoveredAt'] != null
          ? (map['recoveredAt'] as Timestamp).toDate()
          : null,
      cancelledAt: map['cancelledAt'] != null
          ? (map['cancelledAt'] as Timestamp).toDate()
          : null,
    );
  }

  DeletionRequest copyWith({
    String? requestId,
    String? userId,
    DeletionType? type,
    DeletionScope? scope,
    String? reason,
    DateTime? requestedAt,
    DateTime? scheduledAt,
    DateTime? executedAt,
    DeletionStatus? status,
    bool? canRecover,
    DateTime? recoverDeadline,
    DateTime? recoveredAt,
    DateTime? cancelledAt,
  }) {
    return DeletionRequest(
      requestId: requestId ?? this.requestId,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      scope: scope ?? this.scope,
      reason: reason ?? this.reason,
      requestedAt: requestedAt ?? this.requestedAt,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      executedAt: executedAt ?? this.executedAt,
      status: status ?? this.status,
      canRecover: canRecover ?? this.canRecover,
      recoverDeadline: recoverDeadline ?? this.recoverDeadline,
      recoveredAt: recoveredAt ?? this.recoveredAt,
      cancelledAt: cancelledAt ?? this.cancelledAt,
    );
  }
}
