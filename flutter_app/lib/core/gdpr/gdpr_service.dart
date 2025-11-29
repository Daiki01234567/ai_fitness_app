// GDPRサービス
// データエクスポートと削除リクエストのCloud Functions呼び出し
//
// 仕様: FR-025～FR-027 (GDPR対応)
// 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
//
// @version 1.0.0
// @date 2025-11-29

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'gdpr_models.dart';

/// GDPR service for data export and deletion
class GdprService {
  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  GdprService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'asia-northeast1');

  /// Get current user ID
  String? get _currentUserId => _auth.currentUser?.uid;

  /// Request data export
  ///
  /// Creates a new export request and triggers the Cloud Function
  /// to process the export asynchronously.
  ///
  /// Rate limit: 1 request per 24 hours (enforced by Cloud Functions)
  Future<ExportRequest> requestDataExport({
    required ExportFormat format,
    required ExportScope scope,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      // Call Cloud Function to create export request
      final callable = _functions.httpsCallable('requestDataExport');
      final result = await callable.call<Map<String, dynamic>>({
        'format': format.name,
        'scope': scope.toMap(),
      });

      final data = result.data;

      // Return the created export request
      return ExportRequest(
        requestId: data['requestId'] as String? ?? '',
        userId: userId,
        format: format,
        scope: scope,
        status: ExportStatus.pending,
        requestedAt: DateTime.now(),
      );
    } on FirebaseFunctionsException catch (e) {
      throw _handleFunctionsError(e, 'データエクスポートリクエスト');
    }
  }

  /// Get export request status
  Future<ExportRequest?> getExportStatus(String requestId) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      final doc = await _firestore
          .collection('exportRequests')
          .doc(requestId)
          .get();

      if (!doc.exists) {
        return null;
      }

      final data = doc.data()!;

      // Verify user owns this request
      if (data['userId'] != userId) {
        throw Exception('Access denied');
      }

      return ExportRequest.fromMap(data, doc.id);
    } catch (e) {
      throw Exception('エクスポートステータスの取得に失敗しました: $e');
    }
  }

  /// Get all export requests for current user
  Future<List<ExportRequest>> getExportRequests({
    int limit = 10,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      final querySnapshot = await _firestore
          .collection('exportRequests')
          .where('userId', isEqualTo: userId)
          .orderBy('requestedAt', descending: true)
          .limit(limit)
          .get();

      return querySnapshot.docs
          .map((doc) => ExportRequest.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      throw Exception('エクスポートリクエスト一覧の取得に失敗しました: $e');
    }
  }

  /// Stream export requests for real-time updates
  Stream<List<ExportRequest>> streamExportRequests({
    int limit = 10,
  }) {
    final userId = _currentUserId;
    if (userId == null) {
      return Stream.value([]);
    }

    return _firestore
        .collection('exportRequests')
        .where('userId', isEqualTo: userId)
        .orderBy('requestedAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => ExportRequest.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Request account deletion
  ///
  /// Creates a deletion request with 30-day grace period (soft delete)
  /// or immediate deletion (hard delete).
  Future<DeletionRequest> requestAccountDeletion({
    required DeletionType type,
    String? reason,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      // Call Cloud Function to create deletion request
      final callable = _functions.httpsCallable('requestAccountDeletion');
      final result = await callable.call<Map<String, dynamic>>({
        'type': type.name,
        if (reason != null) 'reason': reason,
      });

      final data = result.data;

      final scheduledDate = type == DeletionType.hard
          ? DateTime.now()
          : DateTime.now().add(const Duration(days: 30));

      return DeletionRequest(
        requestId: data['requestId'] as String? ?? '',
        userId: userId,
        type: type,
        scope: DeletionScope.full(),
        reason: reason,
        requestedAt: DateTime.now(),
        scheduledAt: scheduledDate,
        status: type == DeletionType.hard
            ? DeletionStatus.processing
            : DeletionStatus.scheduled,
        canRecover: type != DeletionType.hard,
        recoverDeadline:
            type != DeletionType.hard ? scheduledDate : null,
      );
    } on FirebaseFunctionsException catch (e) {
      throw _handleFunctionsError(e, 'アカウント削除リクエスト');
    }
  }

  /// Cancel deletion request
  ///
  /// Only possible during the 30-day grace period for soft deletes.
  Future<void> cancelDeletion(String requestId) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      // Call Cloud Function to cancel deletion
      final callable = _functions.httpsCallable('cancelAccountDeletion');
      await callable.call<Map<String, dynamic>>({
        'requestId': requestId,
      });
    } on FirebaseFunctionsException catch (e) {
      throw _handleFunctionsError(e, '削除キャンセル');
    }
  }

  /// Get deletion status for current user
  Future<DeletionRequest?> getDeletionStatus() async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      final querySnapshot = await _firestore
          .collection('dataDeletionRequests')
          .where('userId', isEqualTo: userId)
          .where('status', whereIn: ['pending', 'scheduled', 'processing'])
          .orderBy('requestedAt', descending: true)
          .limit(1)
          .get();

      if (querySnapshot.docs.isEmpty) {
        return null;
      }

      final doc = querySnapshot.docs.first;
      return DeletionRequest.fromMap(doc.data(), doc.id);
    } catch (e) {
      throw Exception('削除ステータスの取得に失敗しました: $e');
    }
  }

  /// Get all deletion requests for current user
  Future<List<DeletionRequest>> getDeletionRequests({
    int limit = 10,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    try {
      final querySnapshot = await _firestore
          .collection('dataDeletionRequests')
          .where('userId', isEqualTo: userId)
          .orderBy('requestedAt', descending: true)
          .limit(limit)
          .get();

      return querySnapshot.docs
          .map((doc) => DeletionRequest.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      throw Exception('削除リクエスト一覧の取得に失敗しました: $e');
    }
  }

  /// Stream deletion status for real-time updates
  Stream<DeletionRequest?> streamDeletionStatus() {
    final userId = _currentUserId;
    if (userId == null) {
      return Stream.value(null);
    }

    return _firestore
        .collection('dataDeletionRequests')
        .where('userId', isEqualTo: userId)
        .where('status', whereIn: ['pending', 'scheduled', 'processing'])
        .orderBy('requestedAt', descending: true)
        .limit(1)
        .snapshots()
        .map((snapshot) {
      if (snapshot.docs.isEmpty) {
        return null;
      }
      final doc = snapshot.docs.first;
      return DeletionRequest.fromMap(doc.data(), doc.id);
    });
  }

  /// Download exported data
  ///
  /// Returns the download URL if available, or null if not ready.
  Future<String?> getExportDownloadUrl(String requestId) async {
    final request = await getExportStatus(requestId);
    if (request == null || !request.canDownload) {
      return null;
    }
    return request.downloadUrl;
  }

  /// Create export request directly in Firestore (fallback for Cloud Functions)
  ///
  /// This is a fallback method when Cloud Functions are not available.
  /// The actual export processing should be done by Cloud Functions.
  Future<ExportRequest> createExportRequestLocally({
    required ExportFormat format,
    required ExportScope scope,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    final requestRef = _firestore.collection('exportRequests').doc();
    final now = DateTime.now();

    final request = ExportRequest(
      requestId: requestRef.id,
      userId: userId,
      format: format,
      scope: scope,
      status: ExportStatus.pending,
      requestedAt: now,
    );

    await requestRef.set(request.toMap());

    return request;
  }

  /// Create deletion request directly in Firestore (fallback for Cloud Functions)
  ///
  /// This is a fallback method that updates user document directly.
  /// This should be replaced with Cloud Functions for production.
  Future<DeletionRequest> createDeletionRequestLocally({
    required DeletionType type,
    String? reason,
  }) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    final requestRef = _firestore.collection('dataDeletionRequests').doc();
    final now = DateTime.now();
    final scheduledDate = type == DeletionType.hard
        ? now
        : now.add(const Duration(days: 30));

    final request = DeletionRequest(
      requestId: requestRef.id,
      userId: userId,
      type: type,
      scope: DeletionScope.full(),
      reason: reason,
      requestedAt: now,
      scheduledAt: scheduledDate,
      status: type == DeletionType.hard
          ? DeletionStatus.processing
          : DeletionStatus.scheduled,
      canRecover: type != DeletionType.hard,
      recoverDeadline: type != DeletionType.hard ? scheduledDate : null,
    );

    // Create deletion request
    await requestRef.set(request.toMap());

    // Update user document with deletion scheduled flag
    await _firestore.collection('users').doc(userId).update({
      'deletionScheduled': true,
      'deletionScheduledAt': FieldValue.serverTimestamp(),
      'scheduledDeletionDate': Timestamp.fromDate(scheduledDate),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return request;
  }

  /// Cancel deletion request locally (fallback for Cloud Functions)
  Future<void> cancelDeletionLocally(String requestId) async {
    final userId = _currentUserId;
    if (userId == null) {
      throw Exception('User not authenticated');
    }

    // Update deletion request
    await _firestore.collection('dataDeletionRequests').doc(requestId).update({
      'status': DeletionStatus.cancelled.name,
      'cancelledAt': FieldValue.serverTimestamp(),
    });

    // Update user document
    await _firestore.collection('users').doc(userId).update({
      'deletionScheduled': false,
      'deletionScheduledAt': null,
      'scheduledDeletionDate': null,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Handle Cloud Functions errors
  Exception _handleFunctionsError(
    FirebaseFunctionsException e,
    String operation,
  ) {
    switch (e.code) {
      case 'unauthenticated':
        return Exception('認証が必要です');
      case 'permission-denied':
        return Exception('権限がありません');
      case 'resource-exhausted':
        return Exception('リクエスト制限に達しました。24時間後に再試行してください');
      case 'not-found':
        return Exception('リクエストが見つかりません');
      case 'already-exists':
        return Exception('既に処理中のリクエストがあります');
      case 'invalid-argument':
        return Exception('入力内容が不正です');
      default:
        return Exception('$operationに失敗しました: ${e.message}');
    }
  }
}
