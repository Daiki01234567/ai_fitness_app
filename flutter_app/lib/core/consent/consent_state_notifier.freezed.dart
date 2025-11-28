// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'consent_state_notifier.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$ConsentState {
  /// Loading state
  bool get isLoading => throw _privateConstructorUsedError;

  /// Error message
  String? get error => throw _privateConstructorUsedError;

  /// Success message
  String? get successMessage => throw _privateConstructorUsedError;

  /// ToS accepted
  bool get tosAccepted => throw _privateConstructorUsedError;

  /// ToS accepted date
  DateTime? get tosAcceptedAt => throw _privateConstructorUsedError;

  /// ToS version
  String? get tosVersion => throw _privateConstructorUsedError;

  /// PP accepted
  bool get ppAccepted => throw _privateConstructorUsedError;

  /// PP accepted date
  DateTime? get ppAcceptedAt => throw _privateConstructorUsedError;

  /// PP version
  String? get ppVersion => throw _privateConstructorUsedError;

  /// Needs consent (either ToS or PP not accepted)
  bool get needsConsent => throw _privateConstructorUsedError;

  /// Needs update (version mismatch)
  bool get needsUpdate => throw _privateConstructorUsedError;

  /// Consent history
  List<ConsentHistoryEntry> get history => throw _privateConstructorUsedError;

  /// Create a copy of ConsentState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConsentStateCopyWith<ConsentState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConsentStateCopyWith<$Res> {
  factory $ConsentStateCopyWith(
    ConsentState value,
    $Res Function(ConsentState) then,
  ) = _$ConsentStateCopyWithImpl<$Res, ConsentState>;
  @useResult
  $Res call({
    bool isLoading,
    String? error,
    String? successMessage,
    bool tosAccepted,
    DateTime? tosAcceptedAt,
    String? tosVersion,
    bool ppAccepted,
    DateTime? ppAcceptedAt,
    String? ppVersion,
    bool needsConsent,
    bool needsUpdate,
    List<ConsentHistoryEntry> history,
  });
}

/// @nodoc
class _$ConsentStateCopyWithImpl<$Res, $Val extends ConsentState>
    implements $ConsentStateCopyWith<$Res> {
  _$ConsentStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConsentState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? isLoading = null,
    Object? error = freezed,
    Object? successMessage = freezed,
    Object? tosAccepted = null,
    Object? tosAcceptedAt = freezed,
    Object? tosVersion = freezed,
    Object? ppAccepted = null,
    Object? ppAcceptedAt = freezed,
    Object? ppVersion = freezed,
    Object? needsConsent = null,
    Object? needsUpdate = null,
    Object? history = null,
  }) {
    return _then(
      _value.copyWith(
            isLoading: null == isLoading
                ? _value.isLoading
                : isLoading // ignore: cast_nullable_to_non_nullable
                      as bool,
            error: freezed == error
                ? _value.error
                : error // ignore: cast_nullable_to_non_nullable
                      as String?,
            successMessage: freezed == successMessage
                ? _value.successMessage
                : successMessage // ignore: cast_nullable_to_non_nullable
                      as String?,
            tosAccepted: null == tosAccepted
                ? _value.tosAccepted
                : tosAccepted // ignore: cast_nullable_to_non_nullable
                      as bool,
            tosAcceptedAt: freezed == tosAcceptedAt
                ? _value.tosAcceptedAt
                : tosAcceptedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            tosVersion: freezed == tosVersion
                ? _value.tosVersion
                : tosVersion // ignore: cast_nullable_to_non_nullable
                      as String?,
            ppAccepted: null == ppAccepted
                ? _value.ppAccepted
                : ppAccepted // ignore: cast_nullable_to_non_nullable
                      as bool,
            ppAcceptedAt: freezed == ppAcceptedAt
                ? _value.ppAcceptedAt
                : ppAcceptedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
            ppVersion: freezed == ppVersion
                ? _value.ppVersion
                : ppVersion // ignore: cast_nullable_to_non_nullable
                      as String?,
            needsConsent: null == needsConsent
                ? _value.needsConsent
                : needsConsent // ignore: cast_nullable_to_non_nullable
                      as bool,
            needsUpdate: null == needsUpdate
                ? _value.needsUpdate
                : needsUpdate // ignore: cast_nullable_to_non_nullable
                      as bool,
            history: null == history
                ? _value.history
                : history // ignore: cast_nullable_to_non_nullable
                      as List<ConsentHistoryEntry>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ConsentStateImplCopyWith<$Res>
    implements $ConsentStateCopyWith<$Res> {
  factory _$$ConsentStateImplCopyWith(
    _$ConsentStateImpl value,
    $Res Function(_$ConsentStateImpl) then,
  ) = __$$ConsentStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    bool isLoading,
    String? error,
    String? successMessage,
    bool tosAccepted,
    DateTime? tosAcceptedAt,
    String? tosVersion,
    bool ppAccepted,
    DateTime? ppAcceptedAt,
    String? ppVersion,
    bool needsConsent,
    bool needsUpdate,
    List<ConsentHistoryEntry> history,
  });
}

/// @nodoc
class __$$ConsentStateImplCopyWithImpl<$Res>
    extends _$ConsentStateCopyWithImpl<$Res, _$ConsentStateImpl>
    implements _$$ConsentStateImplCopyWith<$Res> {
  __$$ConsentStateImplCopyWithImpl(
    _$ConsentStateImpl _value,
    $Res Function(_$ConsentStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ConsentState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? isLoading = null,
    Object? error = freezed,
    Object? successMessage = freezed,
    Object? tosAccepted = null,
    Object? tosAcceptedAt = freezed,
    Object? tosVersion = freezed,
    Object? ppAccepted = null,
    Object? ppAcceptedAt = freezed,
    Object? ppVersion = freezed,
    Object? needsConsent = null,
    Object? needsUpdate = null,
    Object? history = null,
  }) {
    return _then(
      _$ConsentStateImpl(
        isLoading: null == isLoading
            ? _value.isLoading
            : isLoading // ignore: cast_nullable_to_non_nullable
                  as bool,
        error: freezed == error
            ? _value.error
            : error // ignore: cast_nullable_to_non_nullable
                  as String?,
        successMessage: freezed == successMessage
            ? _value.successMessage
            : successMessage // ignore: cast_nullable_to_non_nullable
                  as String?,
        tosAccepted: null == tosAccepted
            ? _value.tosAccepted
            : tosAccepted // ignore: cast_nullable_to_non_nullable
                  as bool,
        tosAcceptedAt: freezed == tosAcceptedAt
            ? _value.tosAcceptedAt
            : tosAcceptedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        tosVersion: freezed == tosVersion
            ? _value.tosVersion
            : tosVersion // ignore: cast_nullable_to_non_nullable
                  as String?,
        ppAccepted: null == ppAccepted
            ? _value.ppAccepted
            : ppAccepted // ignore: cast_nullable_to_non_nullable
                  as bool,
        ppAcceptedAt: freezed == ppAcceptedAt
            ? _value.ppAcceptedAt
            : ppAcceptedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        ppVersion: freezed == ppVersion
            ? _value.ppVersion
            : ppVersion // ignore: cast_nullable_to_non_nullable
                  as String?,
        needsConsent: null == needsConsent
            ? _value.needsConsent
            : needsConsent // ignore: cast_nullable_to_non_nullable
                  as bool,
        needsUpdate: null == needsUpdate
            ? _value.needsUpdate
            : needsUpdate // ignore: cast_nullable_to_non_nullable
                  as bool,
        history: null == history
            ? _value._history
            : history // ignore: cast_nullable_to_non_nullable
                  as List<ConsentHistoryEntry>,
      ),
    );
  }
}

/// @nodoc

class _$ConsentStateImpl implements _ConsentState {
  const _$ConsentStateImpl({
    this.isLoading = true,
    this.error,
    this.successMessage,
    this.tosAccepted = false,
    this.tosAcceptedAt,
    this.tosVersion,
    this.ppAccepted = false,
    this.ppAcceptedAt,
    this.ppVersion,
    this.needsConsent = true,
    this.needsUpdate = false,
    final List<ConsentHistoryEntry> history = const [],
  }) : _history = history;

  /// Loading state
  @override
  @JsonKey()
  final bool isLoading;

  /// Error message
  @override
  final String? error;

  /// Success message
  @override
  final String? successMessage;

  /// ToS accepted
  @override
  @JsonKey()
  final bool tosAccepted;

  /// ToS accepted date
  @override
  final DateTime? tosAcceptedAt;

  /// ToS version
  @override
  final String? tosVersion;

  /// PP accepted
  @override
  @JsonKey()
  final bool ppAccepted;

  /// PP accepted date
  @override
  final DateTime? ppAcceptedAt;

  /// PP version
  @override
  final String? ppVersion;

  /// Needs consent (either ToS or PP not accepted)
  @override
  @JsonKey()
  final bool needsConsent;

  /// Needs update (version mismatch)
  @override
  @JsonKey()
  final bool needsUpdate;

  /// Consent history
  final List<ConsentHistoryEntry> _history;

  /// Consent history
  @override
  @JsonKey()
  List<ConsentHistoryEntry> get history {
    if (_history is EqualUnmodifiableListView) return _history;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_history);
  }

  @override
  String toString() {
    return 'ConsentState(isLoading: $isLoading, error: $error, successMessage: $successMessage, tosAccepted: $tosAccepted, tosAcceptedAt: $tosAcceptedAt, tosVersion: $tosVersion, ppAccepted: $ppAccepted, ppAcceptedAt: $ppAcceptedAt, ppVersion: $ppVersion, needsConsent: $needsConsent, needsUpdate: $needsUpdate, history: $history)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConsentStateImpl &&
            (identical(other.isLoading, isLoading) ||
                other.isLoading == isLoading) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.successMessage, successMessage) ||
                other.successMessage == successMessage) &&
            (identical(other.tosAccepted, tosAccepted) ||
                other.tosAccepted == tosAccepted) &&
            (identical(other.tosAcceptedAt, tosAcceptedAt) ||
                other.tosAcceptedAt == tosAcceptedAt) &&
            (identical(other.tosVersion, tosVersion) ||
                other.tosVersion == tosVersion) &&
            (identical(other.ppAccepted, ppAccepted) ||
                other.ppAccepted == ppAccepted) &&
            (identical(other.ppAcceptedAt, ppAcceptedAt) ||
                other.ppAcceptedAt == ppAcceptedAt) &&
            (identical(other.ppVersion, ppVersion) ||
                other.ppVersion == ppVersion) &&
            (identical(other.needsConsent, needsConsent) ||
                other.needsConsent == needsConsent) &&
            (identical(other.needsUpdate, needsUpdate) ||
                other.needsUpdate == needsUpdate) &&
            const DeepCollectionEquality().equals(other._history, _history));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    isLoading,
    error,
    successMessage,
    tosAccepted,
    tosAcceptedAt,
    tosVersion,
    ppAccepted,
    ppAcceptedAt,
    ppVersion,
    needsConsent,
    needsUpdate,
    const DeepCollectionEquality().hash(_history),
  );

  /// Create a copy of ConsentState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConsentStateImplCopyWith<_$ConsentStateImpl> get copyWith =>
      __$$ConsentStateImplCopyWithImpl<_$ConsentStateImpl>(this, _$identity);
}

abstract class _ConsentState implements ConsentState {
  const factory _ConsentState({
    final bool isLoading,
    final String? error,
    final String? successMessage,
    final bool tosAccepted,
    final DateTime? tosAcceptedAt,
    final String? tosVersion,
    final bool ppAccepted,
    final DateTime? ppAcceptedAt,
    final String? ppVersion,
    final bool needsConsent,
    final bool needsUpdate,
    final List<ConsentHistoryEntry> history,
  }) = _$ConsentStateImpl;

  /// Loading state
  @override
  bool get isLoading;

  /// Error message
  @override
  String? get error;

  /// Success message
  @override
  String? get successMessage;

  /// ToS accepted
  @override
  bool get tosAccepted;

  /// ToS accepted date
  @override
  DateTime? get tosAcceptedAt;

  /// ToS version
  @override
  String? get tosVersion;

  /// PP accepted
  @override
  bool get ppAccepted;

  /// PP accepted date
  @override
  DateTime? get ppAcceptedAt;

  /// PP version
  @override
  String? get ppVersion;

  /// Needs consent (either ToS or PP not accepted)
  @override
  bool get needsConsent;

  /// Needs update (version mismatch)
  @override
  bool get needsUpdate;

  /// Consent history
  @override
  List<ConsentHistoryEntry> get history;

  /// Create a copy of ConsentState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConsentStateImplCopyWith<_$ConsentStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
