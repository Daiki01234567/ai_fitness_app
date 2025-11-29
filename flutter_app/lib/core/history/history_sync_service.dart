/// History Sync Service
///
/// Offline-capable data synchronization service for training history.
/// Uses shared_preferences for simple caching (MVP implementation).
/// Reference: docs/tickets/012_history_analytics.md
///
/// Legal notice: This is NOT a medical device.
/// All feedback is for reference purposes only.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import 'history_models.dart';
import 'history_service.dart';

/// Sync status for monitoring
enum SyncStatus {
  /// Sync completed successfully
  synced,

  /// Sync in progress
  syncing,

  /// Pending changes to sync
  pending,

  /// Offline mode
  offline,

  /// Sync failed with error
  error,
}

/// Pending operation for offline queue
class PendingOperation {
  const PendingOperation({
    required this.id,
    required this.type,
    required this.sessionId,
    required this.data,
    required this.timestamp,
  });

  final String id;
  final String type; // 'update_note', 'update_tags', 'update_condition'
  final String sessionId;
  final Map<String, dynamic> data;
  final DateTime timestamp;

  factory PendingOperation.fromJson(Map<String, dynamic> json) {
    return PendingOperation(
      id: json['id'] as String,
      type: json['type'] as String,
      sessionId: json['sessionId'] as String,
      data: json['data'] as Map<String, dynamic>,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'sessionId': sessionId,
      'data': data,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

/// Sync state for UI display
class SyncState {
  const SyncState({
    this.status = SyncStatus.synced,
    this.lastSyncTime,
    this.pendingCount = 0,
    this.errorMessage,
    this.isOnline = true,
  });

  final SyncStatus status;
  final DateTime? lastSyncTime;
  final int pendingCount;
  final String? errorMessage;
  final bool isOnline;

  SyncState copyWith({
    SyncStatus? status,
    DateTime? lastSyncTime,
    int? pendingCount,
    String? errorMessage,
    bool? isOnline,
  }) {
    return SyncState(
      status: status ?? this.status,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      pendingCount: pendingCount ?? this.pendingCount,
      errorMessage: errorMessage,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}

/// History sync service for offline support
class HistorySyncService {
  HistorySyncService(this._historyService);

  final HistoryService _historyService;

  // Cache keys
  static const String _sessionCacheKey = 'cached_sessions';
  static const String _summariesCacheKey = 'cached_summaries';
  static const String _pendingOpsKey = 'pending_operations';
  static const String _lastSyncKey = 'last_sync_time';
  static const String _cacheExpiryKey = 'cache_expiry';

  // Cache configuration
  static const int _maxCacheDays = 30;
  static const int _maxCachedSessions = 100;
  static const Duration _cacheExpiry = Duration(hours: 24);

  SharedPreferences? _prefs;
  StreamSubscription? _connectivitySubscription;
  final _syncStateController = StreamController<SyncState>.broadcast();

  SyncState _currentState = const SyncState();

  /// Stream of sync state updates
  Stream<SyncState> get syncStateStream => _syncStateController.stream;

  /// Current sync state
  SyncState get currentState => _currentState;

  /// Initialize the service
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();

    // Monitor connectivity
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen(_handleConnectivityChange);

    // Check initial connectivity
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);
    _updateState(_currentState.copyWith(isOnline: isOnline));

    // Load pending operations count
    final pendingOps = await _getPendingOperations();
    _updateState(_currentState.copyWith(pendingCount: pendingOps.length));

    // Load last sync time
    final lastSyncMs = _prefs?.getInt(_lastSyncKey);
    if (lastSyncMs != null) {
      _updateState(_currentState.copyWith(
        lastSyncTime: DateTime.fromMillisecondsSinceEpoch(lastSyncMs),
      ));
    }

    // Process pending operations if online
    if (isOnline && pendingOps.isNotEmpty) {
      await _processPendingOperations();
    }
  }

  /// Dispose resources
  void dispose() {
    _connectivitySubscription?.cancel();
    _syncStateController.close();
  }

  /// Handle connectivity changes
  void _handleConnectivityChange(List<ConnectivityResult> results) {
    final isOnline = !results.contains(ConnectivityResult.none);
    _updateState(_currentState.copyWith(
      isOnline: isOnline,
      status: isOnline ? SyncStatus.synced : SyncStatus.offline,
    ));

    if (isOnline) {
      _processPendingOperations();
    }
  }

  /// Update sync state and notify listeners
  void _updateState(SyncState newState) {
    _currentState = newState;
    _syncStateController.add(newState);
  }

  /// Get cached sessions for user
  Future<List<HistorySession>> getCachedSessions({
    required String userId,
  }) async {
    _prefs ??= await SharedPreferences.getInstance();

    final cacheKey = '${_sessionCacheKey}_$userId';
    final cachedJson = _prefs?.getString(cacheKey);

    if (cachedJson == null) return [];

    try {
      final List<dynamic> decoded = jsonDecode(cachedJson);
      return decoded
          .map((json) => HistorySession.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      // Invalid cache, clear it
      await _prefs?.remove(cacheKey);
      return [];
    }
  }

  /// Get cached daily summaries
  Future<List<DailySummary>> getCachedSummaries({
    required String userId,
  }) async {
    _prefs ??= await SharedPreferences.getInstance();

    final cacheKey = '${_summariesCacheKey}_$userId';
    final cachedJson = _prefs?.getString(cacheKey);

    if (cachedJson == null) return [];

    try {
      final List<dynamic> decoded = jsonDecode(cachedJson);
      return decoded.map((json) {
        final map = json as Map<String, dynamic>;
        return DailySummary(
          date: DateTime.parse(map['date'] as String),
          sessionCount: map['sessionCount'] as int,
          totalReps: map['totalReps'] as int,
          averageScore: (map['averageScore'] as num).toDouble(),
          exerciseTypes: [], // Simplified for cache
        );
      }).toList();
    } catch (e) {
      await _prefs?.remove(cacheKey);
      return [];
    }
  }

  /// Sync sessions from Firestore and update cache
  Future<List<HistorySession>> syncSessions({
    required String userId,
    bool forceRefresh = false,
  }) async {
    // Check if we're online
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);

    if (!isOnline) {
      _updateState(_currentState.copyWith(status: SyncStatus.offline));
      return getCachedSessions(userId: userId);
    }

    // Check cache expiry
    if (!forceRefresh) {
      final cachedSessions = await getCachedSessions(userId: userId);
      final expiryMs = _prefs?.getInt('${_cacheExpiryKey}_$userId');

      if (cachedSessions.isNotEmpty && expiryMs != null) {
        final expiry = DateTime.fromMillisecondsSinceEpoch(expiryMs);
        if (DateTime.now().isBefore(expiry)) {
          return cachedSessions;
        }
      }
    }

    _updateState(_currentState.copyWith(status: SyncStatus.syncing));

    try {
      // Fetch from Firestore
      final startDate = DateTime.now().subtract(const Duration(days: _maxCacheDays));
      final sessions = await _historyService.fetchSessions(
        userId: userId,
        filter: HistoryFilter(startDate: startDate),
        limit: _maxCachedSessions,
      );

      // Cache the results
      await _cacheSessions(userId: userId, sessions: sessions);

      // Update sync state
      final now = DateTime.now();
      await _prefs?.setInt(_lastSyncKey, now.millisecondsSinceEpoch);

      _updateState(_currentState.copyWith(
        status: SyncStatus.synced,
        lastSyncTime: now,
      ));

      return sessions;
    } catch (e) {
      _updateState(_currentState.copyWith(
        status: SyncStatus.error,
        errorMessage: '同期に失敗しました: $e',
      ));

      // Return cached data on error
      return getCachedSessions(userId: userId);
    }
  }

  /// Cache sessions locally
  Future<void> _cacheSessions({
    required String userId,
    required List<HistorySession> sessions,
  }) async {
    _prefs ??= await SharedPreferences.getInstance();

    final cacheKey = '${_sessionCacheKey}_$userId';
    final expiryKey = '${_cacheExpiryKey}_$userId';

    final jsonList = sessions.map((s) => s.toJson()).toList();
    await _prefs?.setString(cacheKey, jsonEncode(jsonList));

    // Set expiry
    final expiry = DateTime.now().add(_cacheExpiry);
    await _prefs?.setInt(expiryKey, expiry.millisecondsSinceEpoch);
  }

  /// Cache daily summaries locally
  Future<void> cacheSummaries({
    required String userId,
    required List<DailySummary> summaries,
  }) async {
    _prefs ??= await SharedPreferences.getInstance();

    final cacheKey = '${_summariesCacheKey}_$userId';

    final jsonList = summaries.map((s) => {
      'date': s.date.toIso8601String(),
      'sessionCount': s.sessionCount,
      'totalReps': s.totalReps,
      'averageScore': s.averageScore,
    }).toList();

    await _prefs?.setString(cacheKey, jsonEncode(jsonList));
  }

  /// Queue operation for offline sync
  Future<void> queueOperation({
    required String userId,
    required String type,
    required String sessionId,
    required Map<String, dynamic> data,
  }) async {
    _prefs ??= await SharedPreferences.getInstance();

    final operations = await _getPendingOperations();

    final operation = PendingOperation(
      id: '${DateTime.now().millisecondsSinceEpoch}_${operations.length}',
      type: type,
      sessionId: sessionId,
      data: {...data, 'userId': userId},
      timestamp: DateTime.now(),
    );

    operations.add(operation);
    await _savePendingOperations(operations);

    _updateState(_currentState.copyWith(
      status: SyncStatus.pending,
      pendingCount: operations.length,
    ));

    // Try to process immediately if online
    final connectivity = await Connectivity().checkConnectivity();
    if (!connectivity.contains(ConnectivityResult.none)) {
      await _processPendingOperations();
    }
  }

  /// Get pending operations from storage
  Future<List<PendingOperation>> _getPendingOperations() async {
    _prefs ??= await SharedPreferences.getInstance();

    final json = _prefs?.getString(_pendingOpsKey);
    if (json == null) return [];

    try {
      final List<dynamic> decoded = jsonDecode(json);
      return decoded
          .map((j) => PendingOperation.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Save pending operations to storage
  Future<void> _savePendingOperations(List<PendingOperation> operations) async {
    _prefs ??= await SharedPreferences.getInstance();

    final json = jsonEncode(operations.map((o) => o.toJson()).toList());
    await _prefs?.setString(_pendingOpsKey, json);
  }

  /// Process pending operations
  Future<void> _processPendingOperations() async {
    final operations = await _getPendingOperations();
    if (operations.isEmpty) return;

    _updateState(_currentState.copyWith(status: SyncStatus.syncing));

    final completed = <String>[];
    final failed = <PendingOperation>[];

    for (final op in operations) {
      try {
        await _executeOperation(op);
        completed.add(op.id);
      } catch (e) {
        // Keep failed operations for retry
        failed.add(op);
      }
    }

    // Save remaining operations
    await _savePendingOperations(failed);

    _updateState(_currentState.copyWith(
      status: failed.isEmpty ? SyncStatus.synced : SyncStatus.pending,
      pendingCount: failed.length,
    ));
  }

  /// Execute a single pending operation
  Future<void> _executeOperation(PendingOperation op) async {
    final userId = op.data['userId'] as String?;
    if (userId == null) return;

    switch (op.type) {
      case 'update_note':
        await _historyService.saveSessionNote(
          userId: userId,
          sessionId: op.sessionId,
          note: op.data['note'] as String,
        );
        break;

      case 'update_tags':
        await _historyService.saveSessionTags(
          userId: userId,
          sessionId: op.sessionId,
          tags: List<String>.from(op.data['tags'] as List),
        );
        break;

      case 'update_condition':
        await _historyService.saveBodyCondition(
          userId: userId,
          sessionId: op.sessionId,
          condition: BodyCondition.fromJson(
            op.data['condition'] as Map<String, dynamic>,
          ),
        );
        break;
    }
  }

  /// Clear all cached data
  Future<void> clearCache({required String userId}) async {
    _prefs ??= await SharedPreferences.getInstance();

    await _prefs?.remove('${_sessionCacheKey}_$userId');
    await _prefs?.remove('${_summariesCacheKey}_$userId');
    await _prefs?.remove('${_cacheExpiryKey}_$userId');
  }

  /// Update session note with offline support
  Future<void> updateSessionNote({
    required String userId,
    required String sessionId,
    required String note,
  }) async {
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);

    if (isOnline) {
      try {
        await _historyService.saveSessionNote(
          userId: userId,
          sessionId: sessionId,
          note: note,
        );
        return;
      } catch (e) {
        // Fall through to queue
      }
    }

    // Queue for later sync
    await queueOperation(
      userId: userId,
      type: 'update_note',
      sessionId: sessionId,
      data: {'note': note},
    );
  }

  /// Update session tags with offline support
  Future<void> updateSessionTags({
    required String userId,
    required String sessionId,
    required List<String> tags,
  }) async {
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);

    if (isOnline) {
      try {
        await _historyService.saveSessionTags(
          userId: userId,
          sessionId: sessionId,
          tags: tags,
        );
        return;
      } catch (e) {
        // Fall through to queue
      }
    }

    await queueOperation(
      userId: userId,
      type: 'update_tags',
      sessionId: sessionId,
      data: {'tags': tags},
    );
  }

  /// Update body condition with offline support
  Future<void> updateBodyCondition({
    required String userId,
    required String sessionId,
    required BodyCondition condition,
  }) async {
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);

    if (isOnline) {
      try {
        await _historyService.saveBodyCondition(
          userId: userId,
          sessionId: sessionId,
          condition: condition,
        );
        return;
      } catch (e) {
        // Fall through to queue
      }
    }

    await queueOperation(
      userId: userId,
      type: 'update_condition',
      sessionId: sessionId,
      data: {'condition': condition.toJson()},
    );
  }

  /// Force sync now
  Future<void> syncNow({required String userId}) async {
    await _processPendingOperations();
    await syncSessions(userId: userId, forceRefresh: true);
  }
}

/// History sync service provider
final historySyncServiceProvider = Provider<HistorySyncService>((ref) {
  final historyService = ref.watch(historyServiceProvider);
  final service = HistorySyncService(historyService);

  ref.onDispose(() => service.dispose());

  return service;
});

/// Sync state stream provider
final syncStateProvider = StreamProvider<SyncState>((ref) {
  final syncService = ref.watch(historySyncServiceProvider);
  return syncService.syncStateStream;
});

/// Current sync status provider
final syncStatusProvider = Provider<SyncStatus>((ref) {
  final syncState = ref.watch(syncStateProvider);
  return syncState.when(
    data: (state) => state.status,
    loading: () => SyncStatus.syncing,
    error: (_, _) => SyncStatus.error,
  );
});
