// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_state_notifier.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$AuthState {
  /// 現在のユーザー
  User? get user => throw _privateConstructorUsedError;

  /// ユーザーデータ（Firestoreから取得）
  Map<String, dynamic>? get userData => throw _privateConstructorUsedError;

  /// ローディング状態
  /// 初期値はtrueで、Firebase Authの初期化完了まで待機
  bool get isLoading => throw _privateConstructorUsedError;

  /// エラーメッセージ
  String? get error => throw _privateConstructorUsedError;

  /// メール確認済みフラグ
  bool get isEmailVerified => throw _privateConstructorUsedError;

  /// 強制ログアウトフラグ
  bool get isForceLogout => throw _privateConstructorUsedError;

  /// 削除予定フラグ
  bool get isDeletionScheduled => throw _privateConstructorUsedError;

  /// カスタムクレーム
  Map<String, dynamic>? get customClaims => throw _privateConstructorUsedError;

  /// 初回初期化完了フラグ
  /// Firebase Authの初期状態取得が完了したかどうか
  bool get isInitialized => throw _privateConstructorUsedError;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthStateCopyWith<AuthState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthStateCopyWith<$Res> {
  factory $AuthStateCopyWith(AuthState value, $Res Function(AuthState) then) =
      _$AuthStateCopyWithImpl<$Res, AuthState>;
  @useResult
  $Res call({
    User? user,
    Map<String, dynamic>? userData,
    bool isLoading,
    String? error,
    bool isEmailVerified,
    bool isForceLogout,
    bool isDeletionScheduled,
    Map<String, dynamic>? customClaims,
    bool isInitialized,
  });
}

/// @nodoc
class _$AuthStateCopyWithImpl<$Res, $Val extends AuthState>
    implements $AuthStateCopyWith<$Res> {
  _$AuthStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? user = freezed,
    Object? userData = freezed,
    Object? isLoading = null,
    Object? error = freezed,
    Object? isEmailVerified = null,
    Object? isForceLogout = null,
    Object? isDeletionScheduled = null,
    Object? customClaims = freezed,
    Object? isInitialized = null,
  }) {
    return _then(
      _value.copyWith(
            user: freezed == user
                ? _value.user
                : user // ignore: cast_nullable_to_non_nullable
                      as User?,
            userData: freezed == userData
                ? _value.userData
                : userData // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            isLoading: null == isLoading
                ? _value.isLoading
                : isLoading // ignore: cast_nullable_to_non_nullable
                      as bool,
            error: freezed == error
                ? _value.error
                : error // ignore: cast_nullable_to_non_nullable
                      as String?,
            isEmailVerified: null == isEmailVerified
                ? _value.isEmailVerified
                : isEmailVerified // ignore: cast_nullable_to_non_nullable
                      as bool,
            isForceLogout: null == isForceLogout
                ? _value.isForceLogout
                : isForceLogout // ignore: cast_nullable_to_non_nullable
                      as bool,
            isDeletionScheduled: null == isDeletionScheduled
                ? _value.isDeletionScheduled
                : isDeletionScheduled // ignore: cast_nullable_to_non_nullable
                      as bool,
            customClaims: freezed == customClaims
                ? _value.customClaims
                : customClaims // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
            isInitialized: null == isInitialized
                ? _value.isInitialized
                : isInitialized // ignore: cast_nullable_to_non_nullable
                      as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$AuthStateImplCopyWith<$Res>
    implements $AuthStateCopyWith<$Res> {
  factory _$$AuthStateImplCopyWith(
    _$AuthStateImpl value,
    $Res Function(_$AuthStateImpl) then,
  ) = __$$AuthStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    User? user,
    Map<String, dynamic>? userData,
    bool isLoading,
    String? error,
    bool isEmailVerified,
    bool isForceLogout,
    bool isDeletionScheduled,
    Map<String, dynamic>? customClaims,
    bool isInitialized,
  });
}

/// @nodoc
class __$$AuthStateImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthStateImpl>
    implements _$$AuthStateImplCopyWith<$Res> {
  __$$AuthStateImplCopyWithImpl(
    _$AuthStateImpl _value,
    $Res Function(_$AuthStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? user = freezed,
    Object? userData = freezed,
    Object? isLoading = null,
    Object? error = freezed,
    Object? isEmailVerified = null,
    Object? isForceLogout = null,
    Object? isDeletionScheduled = null,
    Object? customClaims = freezed,
    Object? isInitialized = null,
  }) {
    return _then(
      _$AuthStateImpl(
        user: freezed == user
            ? _value.user
            : user // ignore: cast_nullable_to_non_nullable
                  as User?,
        userData: freezed == userData
            ? _value._userData
            : userData // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        isLoading: null == isLoading
            ? _value.isLoading
            : isLoading // ignore: cast_nullable_to_non_nullable
                  as bool,
        error: freezed == error
            ? _value.error
            : error // ignore: cast_nullable_to_non_nullable
                  as String?,
        isEmailVerified: null == isEmailVerified
            ? _value.isEmailVerified
            : isEmailVerified // ignore: cast_nullable_to_non_nullable
                  as bool,
        isForceLogout: null == isForceLogout
            ? _value.isForceLogout
            : isForceLogout // ignore: cast_nullable_to_non_nullable
                  as bool,
        isDeletionScheduled: null == isDeletionScheduled
            ? _value.isDeletionScheduled
            : isDeletionScheduled // ignore: cast_nullable_to_non_nullable
                  as bool,
        customClaims: freezed == customClaims
            ? _value._customClaims
            : customClaims // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        isInitialized: null == isInitialized
            ? _value.isInitialized
            : isInitialized // ignore: cast_nullable_to_non_nullable
                  as bool,
      ),
    );
  }
}

/// @nodoc

class _$AuthStateImpl with DiagnosticableTreeMixin implements _AuthState {
  const _$AuthStateImpl({
    this.user,
    final Map<String, dynamic>? userData,
    this.isLoading = true,
    this.error,
    this.isEmailVerified = false,
    this.isForceLogout = false,
    this.isDeletionScheduled = false,
    final Map<String, dynamic>? customClaims,
    this.isInitialized = false,
  }) : _userData = userData,
       _customClaims = customClaims;

  /// 現在のユーザー
  @override
  final User? user;

  /// ユーザーデータ（Firestoreから取得）
  final Map<String, dynamic>? _userData;

  /// ユーザーデータ（Firestoreから取得）
  @override
  Map<String, dynamic>? get userData {
    final value = _userData;
    if (value == null) return null;
    if (_userData is EqualUnmodifiableMapView) return _userData;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  /// ローディング状態
  /// 初期値はtrueで、Firebase Authの初期化完了まで待機
  @override
  @JsonKey()
  final bool isLoading;

  /// エラーメッセージ
  @override
  final String? error;

  /// メール確認済みフラグ
  @override
  @JsonKey()
  final bool isEmailVerified;

  /// 強制ログアウトフラグ
  @override
  @JsonKey()
  final bool isForceLogout;

  /// 削除予定フラグ
  @override
  @JsonKey()
  final bool isDeletionScheduled;

  /// カスタムクレーム
  final Map<String, dynamic>? _customClaims;

  /// カスタムクレーム
  @override
  Map<String, dynamic>? get customClaims {
    final value = _customClaims;
    if (value == null) return null;
    if (_customClaims is EqualUnmodifiableMapView) return _customClaims;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  /// 初回初期化完了フラグ
  /// Firebase Authの初期状態取得が完了したかどうか
  @override
  @JsonKey()
  final bool isInitialized;

  @override
  String toString({DiagnosticLevel minLevel = DiagnosticLevel.info}) {
    return 'AuthState(user: $user, userData: $userData, isLoading: $isLoading, error: $error, isEmailVerified: $isEmailVerified, isForceLogout: $isForceLogout, isDeletionScheduled: $isDeletionScheduled, customClaims: $customClaims, isInitialized: $isInitialized)';
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties
      ..add(DiagnosticsProperty('type', 'AuthState'))
      ..add(DiagnosticsProperty('user', user))
      ..add(DiagnosticsProperty('userData', userData))
      ..add(DiagnosticsProperty('isLoading', isLoading))
      ..add(DiagnosticsProperty('error', error))
      ..add(DiagnosticsProperty('isEmailVerified', isEmailVerified))
      ..add(DiagnosticsProperty('isForceLogout', isForceLogout))
      ..add(DiagnosticsProperty('isDeletionScheduled', isDeletionScheduled))
      ..add(DiagnosticsProperty('customClaims', customClaims))
      ..add(DiagnosticsProperty('isInitialized', isInitialized));
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthStateImpl &&
            (identical(other.user, user) || other.user == user) &&
            const DeepCollectionEquality().equals(other._userData, _userData) &&
            (identical(other.isLoading, isLoading) ||
                other.isLoading == isLoading) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.isEmailVerified, isEmailVerified) ||
                other.isEmailVerified == isEmailVerified) &&
            (identical(other.isForceLogout, isForceLogout) ||
                other.isForceLogout == isForceLogout) &&
            (identical(other.isDeletionScheduled, isDeletionScheduled) ||
                other.isDeletionScheduled == isDeletionScheduled) &&
            const DeepCollectionEquality().equals(
              other._customClaims,
              _customClaims,
            ) &&
            (identical(other.isInitialized, isInitialized) ||
                other.isInitialized == isInitialized));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    user,
    const DeepCollectionEquality().hash(_userData),
    isLoading,
    error,
    isEmailVerified,
    isForceLogout,
    isDeletionScheduled,
    const DeepCollectionEquality().hash(_customClaims),
    isInitialized,
  );

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthStateImplCopyWith<_$AuthStateImpl> get copyWith =>
      __$$AuthStateImplCopyWithImpl<_$AuthStateImpl>(this, _$identity);
}

abstract class _AuthState implements AuthState {
  const factory _AuthState({
    final User? user,
    final Map<String, dynamic>? userData,
    final bool isLoading,
    final String? error,
    final bool isEmailVerified,
    final bool isForceLogout,
    final bool isDeletionScheduled,
    final Map<String, dynamic>? customClaims,
    final bool isInitialized,
  }) = _$AuthStateImpl;

  /// 現在のユーザー
  @override
  User? get user;

  /// ユーザーデータ（Firestoreから取得）
  @override
  Map<String, dynamic>? get userData;

  /// ローディング状態
  /// 初期値はtrueで、Firebase Authの初期化完了まで待機
  @override
  bool get isLoading;

  /// エラーメッセージ
  @override
  String? get error;

  /// メール確認済みフラグ
  @override
  bool get isEmailVerified;

  /// 強制ログアウトフラグ
  @override
  bool get isForceLogout;

  /// 削除予定フラグ
  @override
  bool get isDeletionScheduled;

  /// カスタムクレーム
  @override
  Map<String, dynamic>? get customClaims;

  /// 初回初期化完了フラグ
  /// Firebase Authの初期状態取得が完了したかどうか
  @override
  bool get isInitialized;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthStateImplCopyWith<_$AuthStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
