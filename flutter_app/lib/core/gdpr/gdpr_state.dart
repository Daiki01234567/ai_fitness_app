// GDPR状態管理
// Riverpodによるデータエクスポート・削除の状態管理
//
// @version 1.0.0
// @date 2025-11-29

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'gdpr_models.dart';
import 'gdpr_service.dart';

/// GDPR service provider
final gdprServiceProvider = Provider<GdprService>((ref) {
  return GdprService();
});

/// Export requests stream provider
final exportRequestsProvider = StreamProvider<List<ExportRequest>>((ref) {
  final service = ref.watch(gdprServiceProvider);
  return service.streamExportRequests();
});

/// Deletion status stream provider
final deletionStatusProvider = StreamProvider<DeletionRequest?>((ref) {
  final service = ref.watch(gdprServiceProvider);
  return service.streamDeletionStatus();
});

/// Export request state for managing UI state
class ExportRequestState {
  final bool isLoading;
  final String? error;
  final ExportRequest? lastRequest;
  final ExportFormat selectedFormat;
  final ExportScopeType selectedScopeType;
  final DateTime? startDate;
  final DateTime? endDate;

  const ExportRequestState({
    this.isLoading = false,
    this.error,
    this.lastRequest,
    this.selectedFormat = ExportFormat.json,
    this.selectedScopeType = ExportScopeType.all,
    this.startDate,
    this.endDate,
  });

  ExportRequestState copyWith({
    bool? isLoading,
    String? error,
    ExportRequest? lastRequest,
    ExportFormat? selectedFormat,
    ExportScopeType? selectedScopeType,
    DateTime? startDate,
    DateTime? endDate,
  }) {
    return ExportRequestState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      lastRequest: lastRequest ?? this.lastRequest,
      selectedFormat: selectedFormat ?? this.selectedFormat,
      selectedScopeType: selectedScopeType ?? this.selectedScopeType,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
    );
  }
}

/// Export request state notifier
class ExportRequestNotifier extends StateNotifier<ExportRequestState> {
  final GdprService _service;

  ExportRequestNotifier(this._service) : super(const ExportRequestState());

  /// Set export format
  void setFormat(ExportFormat format) {
    state = state.copyWith(selectedFormat: format);
  }

  /// Set export scope type
  void setScopeType(ExportScopeType scopeType) {
    state = state.copyWith(selectedScopeType: scopeType);
  }

  /// Set date range
  void setDateRange(DateTime? start, DateTime? end) {
    state = state.copyWith(startDate: start, endDate: end);
  }

  /// Submit export request
  Future<bool> submitRequest() async {
    if (state.isLoading) return false;

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Build scope based on selected type
      ExportScope scope;
      switch (state.selectedScopeType) {
        case ExportScopeType.all:
          scope = ExportScope.all();
          break;
        case ExportScopeType.dateRange:
          if (state.startDate == null || state.endDate == null) {
            state = state.copyWith(
              isLoading: false,
              error: '期間を選択してください',
            );
            return false;
          }
          scope = ExportScope.dateRange(
            startDate: state.startDate!,
            endDate: state.endDate!,
          );
          break;
        case ExportScopeType.specific:
          scope = ExportScope.all(); // Default to all for now
          break;
      }

      // Try Cloud Functions first, fallback to local
      ExportRequest request;
      try {
        request = await _service.requestDataExport(
          format: state.selectedFormat,
          scope: scope,
        );
      } catch (_) {
        // Fallback to local creation
        request = await _service.createExportRequestLocally(
          format: state.selectedFormat,
          scope: scope,
        );
      }

      state = state.copyWith(
        isLoading: false,
        lastRequest: request,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// Reset state
  void reset() {
    state = const ExportRequestState();
  }
}

/// Export request notifier provider
final exportRequestNotifierProvider =
    StateNotifierProvider<ExportRequestNotifier, ExportRequestState>((ref) {
  final service = ref.watch(gdprServiceProvider);
  return ExportRequestNotifier(service);
});

/// Deletion request state
class DeletionRequestState {
  final bool isLoading;
  final String? error;
  final DeletionRequest? currentRequest;
  final DeletionType selectedType;
  final String? reason;
  final bool confirmed;

  const DeletionRequestState({
    this.isLoading = false,
    this.error,
    this.currentRequest,
    this.selectedType = DeletionType.soft,
    this.reason,
    this.confirmed = false,
  });

  DeletionRequestState copyWith({
    bool? isLoading,
    String? error,
    DeletionRequest? currentRequest,
    DeletionType? selectedType,
    String? reason,
    bool? confirmed,
  }) {
    return DeletionRequestState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      currentRequest: currentRequest ?? this.currentRequest,
      selectedType: selectedType ?? this.selectedType,
      reason: reason ?? this.reason,
      confirmed: confirmed ?? this.confirmed,
    );
  }
}

/// Deletion request state notifier
class DeletionRequestNotifier extends StateNotifier<DeletionRequestState> {
  final GdprService _service;

  DeletionRequestNotifier(this._service) : super(const DeletionRequestState());

  /// Set deletion type
  void setType(DeletionType type) {
    state = state.copyWith(selectedType: type);
  }

  /// Set reason
  void setReason(String? reason) {
    state = state.copyWith(reason: reason);
  }

  /// Set confirmation
  void setConfirmed(bool confirmed) {
    state = state.copyWith(confirmed: confirmed);
  }

  /// Load current deletion status
  Future<void> loadCurrentStatus() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final request = await _service.getDeletionStatus();
      state = state.copyWith(
        isLoading: false,
        currentRequest: request,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Submit deletion request
  Future<bool> submitRequest() async {
    if (state.isLoading) return false;
    if (!state.confirmed) {
      state = state.copyWith(error: '確認チェックを入れてください');
      return false;
    }

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Try Cloud Functions first, fallback to local
      DeletionRequest request;
      try {
        request = await _service.requestAccountDeletion(
          type: state.selectedType,
          reason: state.reason,
        );
      } catch (_) {
        // Fallback to local creation
        request = await _service.createDeletionRequestLocally(
          type: state.selectedType,
          reason: state.reason,
        );
      }

      state = state.copyWith(
        isLoading: false,
        currentRequest: request,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Cancel deletion request
  Future<bool> cancelRequest() async {
    if (state.isLoading) return false;
    if (state.currentRequest == null) return false;

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Try Cloud Functions first, fallback to local
      try {
        await _service.cancelDeletion(state.currentRequest!.requestId);
      } catch (_) {
        // Fallback to local cancellation
        await _service.cancelDeletionLocally(state.currentRequest!.requestId);
      }

      state = state.copyWith(
        isLoading: false,
        currentRequest: null,
        confirmed: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// Reset state
  void reset() {
    state = const DeletionRequestState();
  }
}

/// Deletion request notifier provider
final deletionRequestNotifierProvider =
    StateNotifierProvider<DeletionRequestNotifier, DeletionRequestState>((ref) {
  final service = ref.watch(gdprServiceProvider);
  return DeletionRequestNotifier(service);
});
