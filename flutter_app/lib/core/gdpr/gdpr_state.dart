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
            state = state.copyWith(isLoading: false, error: '期間を選択してください');
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

      state = state.copyWith(isLoading: false, lastRequest: request);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
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
      state = state.copyWith(isLoading: false, currentRequest: request);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
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

      state = state.copyWith(isLoading: false, currentRequest: request);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
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
      state = state.copyWith(isLoading: false, error: e.toString());
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

/// Account recovery state
class AccountRecoveryState {
  final bool isLoading;
  final String? error;
  final String? email;
  final bool codeSent;
  final DateTime? recoveryDeadline;
  final DateTime? codeExpiresAt;
  final bool isRecovered;

  const AccountRecoveryState({
    this.isLoading = false,
    this.error,
    this.email,
    this.codeSent = false,
    this.recoveryDeadline,
    this.codeExpiresAt,
    this.isRecovered = false,
  });

  AccountRecoveryState copyWith({
    bool? isLoading,
    String? error,
    String? email,
    bool? codeSent,
    DateTime? recoveryDeadline,
    DateTime? codeExpiresAt,
    bool? isRecovered,
  }) {
    return AccountRecoveryState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      email: email ?? this.email,
      codeSent: codeSent ?? this.codeSent,
      recoveryDeadline: recoveryDeadline ?? this.recoveryDeadline,
      codeExpiresAt: codeExpiresAt ?? this.codeExpiresAt,
      isRecovered: isRecovered ?? this.isRecovered,
    );
  }

  /// Check if the recovery code has expired
  bool get isCodeExpired {
    if (codeExpiresAt == null) return false;
    return DateTime.now().isAfter(codeExpiresAt!);
  }

  /// Check if recovery is still possible
  bool get canStillRecover {
    if (recoveryDeadline == null) return true;
    return DateTime.now().isBefore(recoveryDeadline!);
  }

  /// Days remaining until recovery deadline
  int get daysRemaining {
    if (recoveryDeadline == null) return 0;
    final diff = recoveryDeadline!.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }
}

/// Account recovery state notifier
class AccountRecoveryNotifier extends StateNotifier<AccountRecoveryState> {
  final GdprService _service;

  AccountRecoveryNotifier(this._service) : super(const AccountRecoveryState());

  /// Request recovery code via email
  ///
  /// Returns RecoveryInfo if successful, null otherwise.
  Future<RecoveryInfo?> requestRecoveryCode(String email) async {
    if (state.isLoading) return null;

    state = state.copyWith(isLoading: true, error: null, email: email);

    try {
      // Try Cloud Functions first, fallback to local
      RecoveryInfo? info;
      try {
        info = await _service.requestRecoveryCode(email);
      } catch (_) {
        // Fallback to local implementation
        info = await _service.requestRecoveryCodeLocally(email);
      }

      if (info != null) {
        state = state.copyWith(
          isLoading: false,
          codeSent: true,
          recoveryDeadline: info.recoveryDeadline,
          codeExpiresAt: info.codeExpiresAt,
        );
      } else {
        state = state.copyWith(isLoading: false, error: '復元コードの送信に失敗しました');
      }

      return info;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceAll('Exception: ', ''),
      );
      return null;
    }
  }

  /// Recover account with verification code
  ///
  /// Returns true if recovery was successful.
  Future<bool> recoverAccount({
    required String email,
    required String code,
  }) async {
    if (state.isLoading) return false;

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Try Cloud Functions first, fallback to local
      bool success;
      try {
        success = await _service.recoverAccount(email: email, code: code);
      } catch (_) {
        // Fallback to local implementation
        success = await _service.recoverAccountLocally(
          email: email,
          code: code,
        );
      }

      state = state.copyWith(isLoading: false, isRecovered: success);

      return success;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  /// Check if account is eligible for recovery
  Future<RecoveryEligibility> checkEligibility(String email) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final eligibility = await _service.checkRecoveryEligibility(email);

      state = state.copyWith(
        isLoading: false,
        recoveryDeadline: eligibility.recoveryDeadline,
      );

      if (!eligibility.isEligible) {
        state = state.copyWith(error: eligibility.reason);
      }

      return eligibility;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceAll('Exception: ', ''),
      );
      return RecoveryEligibility(isEligible: false, reason: e.toString());
    }
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// Reset to initial state
  void reset() {
    state = const AccountRecoveryState();
  }
}

/// Account recovery notifier provider
final accountRecoveryNotifierProvider =
    StateNotifierProvider<AccountRecoveryNotifier, AccountRecoveryState>((ref) {
      final service = ref.watch(gdprServiceProvider);
      return AccountRecoveryNotifier(service);
    });
