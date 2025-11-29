// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'session_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SetupChecklistItem {
  String get id => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  bool get isChecked => throw _privateConstructorUsedError;
  bool get canAutoDetect => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $SetupChecklistItemCopyWith<SetupChecklistItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupChecklistItemCopyWith<$Res> {
  factory $SetupChecklistItemCopyWith(
          SetupChecklistItem value, $Res Function(SetupChecklistItem) then) =
      _$SetupChecklistItemCopyWithImpl<$Res, SetupChecklistItem>;
  @useResult
  $Res call({String id, String label, bool isChecked, bool canAutoDetect});
}

/// @nodoc
class _$SetupChecklistItemCopyWithImpl<$Res, $Val extends SetupChecklistItem>
    implements $SetupChecklistItemCopyWith<$Res> {
  _$SetupChecklistItemCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? isChecked = null,
    Object? canAutoDetect = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      isChecked: null == isChecked
          ? _value.isChecked
          : isChecked // ignore: cast_nullable_to_non_nullable
              as bool,
      canAutoDetect: null == canAutoDetect
          ? _value.canAutoDetect
          : canAutoDetect // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupChecklistItemImplCopyWith<$Res>
    implements $SetupChecklistItemCopyWith<$Res> {
  factory _$$SetupChecklistItemImplCopyWith(_$SetupChecklistItemImpl value,
          $Res Function(_$SetupChecklistItemImpl) then) =
      __$$SetupChecklistItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String label, bool isChecked, bool canAutoDetect});
}

/// @nodoc
class __$$SetupChecklistItemImplCopyWithImpl<$Res>
    extends _$SetupChecklistItemCopyWithImpl<$Res, _$SetupChecklistItemImpl>
    implements _$$SetupChecklistItemImplCopyWith<$Res> {
  __$$SetupChecklistItemImplCopyWithImpl(_$SetupChecklistItemImpl _value,
      $Res Function(_$SetupChecklistItemImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? isChecked = null,
    Object? canAutoDetect = null,
  }) {
    return _then(_$SetupChecklistItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      isChecked: null == isChecked
          ? _value.isChecked
          : isChecked // ignore: cast_nullable_to_non_nullable
              as bool,
      canAutoDetect: null == canAutoDetect
          ? _value.canAutoDetect
          : canAutoDetect // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
class _$SetupChecklistItemImpl implements _SetupChecklistItem {
  const _$SetupChecklistItemImpl(
      {required this.id,
      required this.label,
      required this.isChecked,
      required this.canAutoDetect});

  @override
  final String id;
  @override
  final String label;
  @override
  final bool isChecked;
  @override
  final bool canAutoDetect;

  @override
  String toString() {
    return 'SetupChecklistItem(id: $id, label: $label, isChecked: $isChecked, canAutoDetect: $canAutoDetect)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupChecklistItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.isChecked, isChecked) ||
                other.isChecked == isChecked) &&
            (identical(other.canAutoDetect, canAutoDetect) ||
                other.canAutoDetect == canAutoDetect));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, id, label, isChecked, canAutoDetect);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupChecklistItemImplCopyWith<_$SetupChecklistItemImpl> get copyWith =>
      __$$SetupChecklistItemImplCopyWithImpl<_$SetupChecklistItemImpl>(
          this, _$identity);
}

abstract class _SetupChecklistItem implements SetupChecklistItem {
  const factory _SetupChecklistItem(
      {required final String id,
      required final String label,
      required final bool isChecked,
      required final bool canAutoDetect}) = _$SetupChecklistItemImpl;

  @override
  String get id;
  @override
  String get label;
  @override
  bool get isChecked;
  @override
  bool get canAutoDetect;
  @override
  @JsonKey(ignore: true)
  _$$SetupChecklistItemImplCopyWith<_$SetupChecklistItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ExerciseInfo {
  ExerciseType get type => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String get recommendedOrientation => throw _privateConstructorUsedError;
  String get targetBodyParts => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ExerciseInfoCopyWith<ExerciseInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ExerciseInfoCopyWith<$Res> {
  factory $ExerciseInfoCopyWith(
          ExerciseInfo value, $Res Function(ExerciseInfo) then) =
      _$ExerciseInfoCopyWithImpl<$Res, ExerciseInfo>;
  @useResult
  $Res call(
      {ExerciseType type,
      String name,
      String description,
      String recommendedOrientation,
      String targetBodyParts});
}

/// @nodoc
class _$ExerciseInfoCopyWithImpl<$Res, $Val extends ExerciseInfo>
    implements $ExerciseInfoCopyWith<$Res> {
  _$ExerciseInfoCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = null,
    Object? recommendedOrientation = null,
    Object? targetBodyParts = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ExerciseType,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      recommendedOrientation: null == recommendedOrientation
          ? _value.recommendedOrientation
          : recommendedOrientation // ignore: cast_nullable_to_non_nullable
              as String,
      targetBodyParts: null == targetBodyParts
          ? _value.targetBodyParts
          : targetBodyParts // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ExerciseInfoImplCopyWith<$Res>
    implements $ExerciseInfoCopyWith<$Res> {
  factory _$$ExerciseInfoImplCopyWith(
          _$ExerciseInfoImpl value, $Res Function(_$ExerciseInfoImpl) then) =
      __$$ExerciseInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ExerciseType type,
      String name,
      String description,
      String recommendedOrientation,
      String targetBodyParts});
}

/// @nodoc
class __$$ExerciseInfoImplCopyWithImpl<$Res>
    extends _$ExerciseInfoCopyWithImpl<$Res, _$ExerciseInfoImpl>
    implements _$$ExerciseInfoImplCopyWith<$Res> {
  __$$ExerciseInfoImplCopyWithImpl(
      _$ExerciseInfoImpl _value, $Res Function(_$ExerciseInfoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = null,
    Object? recommendedOrientation = null,
    Object? targetBodyParts = null,
  }) {
    return _then(_$ExerciseInfoImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ExerciseType,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      recommendedOrientation: null == recommendedOrientation
          ? _value.recommendedOrientation
          : recommendedOrientation // ignore: cast_nullable_to_non_nullable
              as String,
      targetBodyParts: null == targetBodyParts
          ? _value.targetBodyParts
          : targetBodyParts // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
class _$ExerciseInfoImpl implements _ExerciseInfo {
  const _$ExerciseInfoImpl(
      {required this.type,
      required this.name,
      required this.description,
      required this.recommendedOrientation,
      required this.targetBodyParts});

  @override
  final ExerciseType type;
  @override
  final String name;
  @override
  final String description;
  @override
  final String recommendedOrientation;
  @override
  final String targetBodyParts;

  @override
  String toString() {
    return 'ExerciseInfo(type: $type, name: $name, description: $description, recommendedOrientation: $recommendedOrientation, targetBodyParts: $targetBodyParts)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ExerciseInfoImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.recommendedOrientation, recommendedOrientation) ||
                other.recommendedOrientation == recommendedOrientation) &&
            (identical(other.targetBodyParts, targetBodyParts) ||
                other.targetBodyParts == targetBodyParts));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, type, name, description, recommendedOrientation, targetBodyParts);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ExerciseInfoImplCopyWith<_$ExerciseInfoImpl> get copyWith =>
      __$$ExerciseInfoImplCopyWithImpl<_$ExerciseInfoImpl>(this, _$identity);
}

abstract class _ExerciseInfo implements ExerciseInfo {
  const factory _ExerciseInfo(
      {required final ExerciseType type,
      required final String name,
      required final String description,
      required final String recommendedOrientation,
      required final String targetBodyParts}) = _$ExerciseInfoImpl;

  @override
  ExerciseType get type;
  @override
  String get name;
  @override
  String get description;
  @override
  String get recommendedOrientation;
  @override
  String get targetBodyParts;
  @override
  @JsonKey(ignore: true)
  _$$ExerciseInfoImplCopyWith<_$ExerciseInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$SessionConfig {
  ExerciseType get exerciseType => throw _privateConstructorUsedError;
  int get targetReps => throw _privateConstructorUsedError;
  int get targetSets => throw _privateConstructorUsedError;
  int get restDurationSeconds => throw _privateConstructorUsedError;
  bool get enableVoiceFeedback => throw _privateConstructorUsedError;
  bool get enableVisualFeedback => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $SessionConfigCopyWith<SessionConfig> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SessionConfigCopyWith<$Res> {
  factory $SessionConfigCopyWith(
          SessionConfig value, $Res Function(SessionConfig) then) =
      _$SessionConfigCopyWithImpl<$Res, SessionConfig>;
  @useResult
  $Res call(
      {ExerciseType exerciseType,
      int targetReps,
      int targetSets,
      int restDurationSeconds,
      bool enableVoiceFeedback,
      bool enableVisualFeedback});
}

/// @nodoc
class _$SessionConfigCopyWithImpl<$Res, $Val extends SessionConfig>
    implements $SessionConfigCopyWith<$Res> {
  _$SessionConfigCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? exerciseType = null,
    Object? targetReps = null,
    Object? targetSets = null,
    Object? restDurationSeconds = null,
    Object? enableVoiceFeedback = null,
    Object? enableVisualFeedback = null,
  }) {
    return _then(_value.copyWith(
      exerciseType: null == exerciseType
          ? _value.exerciseType
          : exerciseType // ignore: cast_nullable_to_non_nullable
              as ExerciseType,
      targetReps: null == targetReps
          ? _value.targetReps
          : targetReps // ignore: cast_nullable_to_non_nullable
              as int,
      targetSets: null == targetSets
          ? _value.targetSets
          : targetSets // ignore: cast_nullable_to_non_nullable
              as int,
      restDurationSeconds: null == restDurationSeconds
          ? _value.restDurationSeconds
          : restDurationSeconds // ignore: cast_nullable_to_non_nullable
              as int,
      enableVoiceFeedback: null == enableVoiceFeedback
          ? _value.enableVoiceFeedback
          : enableVoiceFeedback // ignore: cast_nullable_to_non_nullable
              as bool,
      enableVisualFeedback: null == enableVisualFeedback
          ? _value.enableVisualFeedback
          : enableVisualFeedback // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SessionConfigImplCopyWith<$Res>
    implements $SessionConfigCopyWith<$Res> {
  factory _$$SessionConfigImplCopyWith(
          _$SessionConfigImpl value, $Res Function(_$SessionConfigImpl) then) =
      __$$SessionConfigImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ExerciseType exerciseType,
      int targetReps,
      int targetSets,
      int restDurationSeconds,
      bool enableVoiceFeedback,
      bool enableVisualFeedback});
}

/// @nodoc
class __$$SessionConfigImplCopyWithImpl<$Res>
    extends _$SessionConfigCopyWithImpl<$Res, _$SessionConfigImpl>
    implements _$$SessionConfigImplCopyWith<$Res> {
  __$$SessionConfigImplCopyWithImpl(
      _$SessionConfigImpl _value, $Res Function(_$SessionConfigImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? exerciseType = null,
    Object? targetReps = null,
    Object? targetSets = null,
    Object? restDurationSeconds = null,
    Object? enableVoiceFeedback = null,
    Object? enableVisualFeedback = null,
  }) {
    return _then(_$SessionConfigImpl(
      exerciseType: null == exerciseType
          ? _value.exerciseType
          : exerciseType // ignore: cast_nullable_to_non_nullable
              as ExerciseType,
      targetReps: null == targetReps
          ? _value.targetReps
          : targetReps // ignore: cast_nullable_to_non_nullable
              as int,
      targetSets: null == targetSets
          ? _value.targetSets
          : targetSets // ignore: cast_nullable_to_non_nullable
              as int,
      restDurationSeconds: null == restDurationSeconds
          ? _value.restDurationSeconds
          : restDurationSeconds // ignore: cast_nullable_to_non_nullable
              as int,
      enableVoiceFeedback: null == enableVoiceFeedback
          ? _value.enableVoiceFeedback
          : enableVoiceFeedback // ignore: cast_nullable_to_non_nullable
              as bool,
      enableVisualFeedback: null == enableVisualFeedback
          ? _value.enableVisualFeedback
          : enableVisualFeedback // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
class _$SessionConfigImpl implements _SessionConfig {
  const _$SessionConfigImpl(
      {required this.exerciseType,
      this.targetReps = 10,
      this.targetSets = 3,
      this.restDurationSeconds = 60,
      this.enableVoiceFeedback = true,
      this.enableVisualFeedback = true});

  @override
  final ExerciseType exerciseType;
  @override
  @JsonKey()
  final int targetReps;
  @override
  @JsonKey()
  final int targetSets;
  @override
  @JsonKey()
  final int restDurationSeconds;
  @override
  @JsonKey()
  final bool enableVoiceFeedback;
  @override
  @JsonKey()
  final bool enableVisualFeedback;

  @override
  String toString() {
    return 'SessionConfig(exerciseType: $exerciseType, targetReps: $targetReps, targetSets: $targetSets, restDurationSeconds: $restDurationSeconds, enableVoiceFeedback: $enableVoiceFeedback, enableVisualFeedback: $enableVisualFeedback)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SessionConfigImpl &&
            (identical(other.exerciseType, exerciseType) ||
                other.exerciseType == exerciseType) &&
            (identical(other.targetReps, targetReps) ||
                other.targetReps == targetReps) &&
            (identical(other.targetSets, targetSets) ||
                other.targetSets == targetSets) &&
            (identical(other.restDurationSeconds, restDurationSeconds) ||
                other.restDurationSeconds == restDurationSeconds) &&
            (identical(other.enableVoiceFeedback, enableVoiceFeedback) ||
                other.enableVoiceFeedback == enableVoiceFeedback) &&
            (identical(other.enableVisualFeedback, enableVisualFeedback) ||
                other.enableVisualFeedback == enableVisualFeedback));
  }

  @override
  int get hashCode => Object.hash(runtimeType, exerciseType, targetReps,
      targetSets, restDurationSeconds, enableVoiceFeedback, enableVisualFeedback);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$SessionConfigImplCopyWith<_$SessionConfigImpl> get copyWith =>
      __$$SessionConfigImplCopyWithImpl<_$SessionConfigImpl>(this, _$identity);
}

abstract class _SessionConfig implements SessionConfig {
  const factory _SessionConfig(
      {required final ExerciseType exerciseType,
      final int targetReps,
      final int targetSets,
      final int restDurationSeconds,
      final bool enableVoiceFeedback,
      final bool enableVisualFeedback}) = _$SessionConfigImpl;

  @override
  ExerciseType get exerciseType;
  @override
  int get targetReps;
  @override
  int get targetSets;
  @override
  int get restDurationSeconds;
  @override
  bool get enableVoiceFeedback;
  @override
  bool get enableVisualFeedback;
  @override
  @JsonKey(ignore: true)
  _$$SessionConfigImplCopyWith<_$SessionConfigImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$SetData {
  int get setNumber => throw _privateConstructorUsedError;
  int get reps => throw _privateConstructorUsedError;
  double get averageScore => throw _privateConstructorUsedError;
  Duration get duration => throw _privateConstructorUsedError;
  List<FormIssue> get issues => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $SetDataCopyWith<SetData> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetDataCopyWith<$Res> {
  factory $SetDataCopyWith(SetData value, $Res Function(SetData) then) =
      _$SetDataCopyWithImpl<$Res, SetData>;
  @useResult
  $Res call(
      {int setNumber,
      int reps,
      double averageScore,
      Duration duration,
      List<FormIssue> issues});
}

/// @nodoc
class _$SetDataCopyWithImpl<$Res, $Val extends SetData>
    implements $SetDataCopyWith<$Res> {
  _$SetDataCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? setNumber = null,
    Object? reps = null,
    Object? averageScore = null,
    Object? duration = null,
    Object? issues = null,
  }) {
    return _then(_value.copyWith(
      setNumber: null == setNumber
          ? _value.setNumber
          : setNumber // ignore: cast_nullable_to_non_nullable
              as int,
      reps: null == reps
          ? _value.reps
          : reps // ignore: cast_nullable_to_non_nullable
              as int,
      averageScore: null == averageScore
          ? _value.averageScore
          : averageScore // ignore: cast_nullable_to_non_nullable
              as double,
      duration: null == duration
          ? _value.duration
          : duration // ignore: cast_nullable_to_non_nullable
              as Duration,
      issues: null == issues
          ? _value.issues
          : issues // ignore: cast_nullable_to_non_nullable
              as List<FormIssue>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetDataImplCopyWith<$Res> implements $SetDataCopyWith<$Res> {
  factory _$$SetDataImplCopyWith(
          _$SetDataImpl value, $Res Function(_$SetDataImpl) then) =
      __$$SetDataImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int setNumber,
      int reps,
      double averageScore,
      Duration duration,
      List<FormIssue> issues});
}

/// @nodoc
class __$$SetDataImplCopyWithImpl<$Res>
    extends _$SetDataCopyWithImpl<$Res, _$SetDataImpl>
    implements _$$SetDataImplCopyWith<$Res> {
  __$$SetDataImplCopyWithImpl(
      _$SetDataImpl _value, $Res Function(_$SetDataImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? setNumber = null,
    Object? reps = null,
    Object? averageScore = null,
    Object? duration = null,
    Object? issues = null,
  }) {
    return _then(_$SetDataImpl(
      setNumber: null == setNumber
          ? _value.setNumber
          : setNumber // ignore: cast_nullable_to_non_nullable
              as int,
      reps: null == reps
          ? _value.reps
          : reps // ignore: cast_nullable_to_non_nullable
              as int,
      averageScore: null == averageScore
          ? _value.averageScore
          : averageScore // ignore: cast_nullable_to_non_nullable
              as double,
      duration: null == duration
          ? _value.duration
          : duration // ignore: cast_nullable_to_non_nullable
              as Duration,
      issues: null == issues
          ? _value._issues
          : issues // ignore: cast_nullable_to_non_nullable
              as List<FormIssue>,
    ));
  }
}

/// @nodoc
class _$SetDataImpl implements _SetData {
  const _$SetDataImpl(
      {required this.setNumber,
      required this.reps,
      required this.averageScore,
      required this.duration,
      required final List<FormIssue> issues})
      : _issues = issues;

  @override
  final int setNumber;
  @override
  final int reps;
  @override
  final double averageScore;
  @override
  final Duration duration;
  final List<FormIssue> _issues;
  @override
  List<FormIssue> get issues {
    if (_issues is EqualUnmodifiableListView) return _issues;
    return EqualUnmodifiableListView(_issues);
  }

  @override
  String toString() {
    return 'SetData(setNumber: $setNumber, reps: $reps, averageScore: $averageScore, duration: $duration, issues: $issues)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetDataImpl &&
            (identical(other.setNumber, setNumber) ||
                other.setNumber == setNumber) &&
            (identical(other.reps, reps) || other.reps == reps) &&
            (identical(other.averageScore, averageScore) ||
                other.averageScore == averageScore) &&
            (identical(other.duration, duration) ||
                other.duration == duration) &&
            const DeepCollectionEquality().equals(other._issues, _issues));
  }

  @override
  int get hashCode => Object.hash(runtimeType, setNumber, reps, averageScore,
      duration, const DeepCollectionEquality().hash(_issues));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$SetDataImplCopyWith<_$SetDataImpl> get copyWith =>
      __$$SetDataImplCopyWithImpl<_$SetDataImpl>(this, _$identity);
}

abstract class _SetData implements SetData {
  const factory _SetData(
      {required final int setNumber,
      required final int reps,
      required final double averageScore,
      required final Duration duration,
      required final List<FormIssue> issues}) = _$SetDataImpl;

  @override
  int get setNumber;
  @override
  int get reps;
  @override
  double get averageScore;
  @override
  Duration get duration;
  @override
  List<FormIssue> get issues;
  @override
  @JsonKey(ignore: true)
  _$$SetDataImplCopyWith<_$SetDataImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$TrainingSessionState {
  SessionPhase get phase => throw _privateConstructorUsedError;
  SessionConfig? get config => throw _privateConstructorUsedError;
  ExerciseInfo? get exerciseInfo => throw _privateConstructorUsedError;
  List<SetupChecklistItem> get setupChecklist =>
      throw _privateConstructorUsedError;
  int get countdownValue => throw _privateConstructorUsedError;
  int get currentSet => throw _privateConstructorUsedError;
  int get currentReps => throw _privateConstructorUsedError;
  double get currentScore => throw _privateConstructorUsedError;
  List<FormIssue> get currentIssues => throw _privateConstructorUsedError;
  DateTime? get sessionStartTime => throw _privateConstructorUsedError;
  DateTime? get setStartTime => throw _privateConstructorUsedError;
  int get restTimeRemaining => throw _privateConstructorUsedError;
  PoseFrame? get currentPose => throw _privateConstructorUsedError;
  FrameEvaluationResult? get currentEvaluation =>
      throw _privateConstructorUsedError;
  List<SetData> get completedSets => throw _privateConstructorUsedError;
  String? get errorMessage => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $TrainingSessionStateCopyWith<TrainingSessionState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TrainingSessionStateCopyWith<$Res> {
  factory $TrainingSessionStateCopyWith(TrainingSessionState value,
          $Res Function(TrainingSessionState) then) =
      _$TrainingSessionStateCopyWithImpl<$Res, TrainingSessionState>;
  @useResult
  $Res call(
      {SessionPhase phase,
      SessionConfig? config,
      ExerciseInfo? exerciseInfo,
      List<SetupChecklistItem> setupChecklist,
      int countdownValue,
      int currentSet,
      int currentReps,
      double currentScore,
      List<FormIssue> currentIssues,
      DateTime? sessionStartTime,
      DateTime? setStartTime,
      int restTimeRemaining,
      PoseFrame? currentPose,
      FrameEvaluationResult? currentEvaluation,
      List<SetData> completedSets,
      String? errorMessage});

  $SessionConfigCopyWith<$Res>? get config;
  $ExerciseInfoCopyWith<$Res>? get exerciseInfo;
}

/// @nodoc
class _$TrainingSessionStateCopyWithImpl<$Res,
        $Val extends TrainingSessionState>
    implements $TrainingSessionStateCopyWith<$Res> {
  _$TrainingSessionStateCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phase = null,
    Object? config = freezed,
    Object? exerciseInfo = freezed,
    Object? setupChecklist = null,
    Object? countdownValue = null,
    Object? currentSet = null,
    Object? currentReps = null,
    Object? currentScore = null,
    Object? currentIssues = null,
    Object? sessionStartTime = freezed,
    Object? setStartTime = freezed,
    Object? restTimeRemaining = null,
    Object? currentPose = freezed,
    Object? currentEvaluation = freezed,
    Object? completedSets = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_value.copyWith(
      phase: null == phase
          ? _value.phase
          : phase // ignore: cast_nullable_to_non_nullable
              as SessionPhase,
      config: freezed == config
          ? _value.config
          : config // ignore: cast_nullable_to_non_nullable
              as SessionConfig?,
      exerciseInfo: freezed == exerciseInfo
          ? _value.exerciseInfo
          : exerciseInfo // ignore: cast_nullable_to_non_nullable
              as ExerciseInfo?,
      setupChecklist: null == setupChecklist
          ? _value.setupChecklist
          : setupChecklist // ignore: cast_nullable_to_non_nullable
              as List<SetupChecklistItem>,
      countdownValue: null == countdownValue
          ? _value.countdownValue
          : countdownValue // ignore: cast_nullable_to_non_nullable
              as int,
      currentSet: null == currentSet
          ? _value.currentSet
          : currentSet // ignore: cast_nullable_to_non_nullable
              as int,
      currentReps: null == currentReps
          ? _value.currentReps
          : currentReps // ignore: cast_nullable_to_non_nullable
              as int,
      currentScore: null == currentScore
          ? _value.currentScore
          : currentScore // ignore: cast_nullable_to_non_nullable
              as double,
      currentIssues: null == currentIssues
          ? _value.currentIssues
          : currentIssues // ignore: cast_nullable_to_non_nullable
              as List<FormIssue>,
      sessionStartTime: freezed == sessionStartTime
          ? _value.sessionStartTime
          : sessionStartTime // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      setStartTime: freezed == setStartTime
          ? _value.setStartTime
          : setStartTime // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      restTimeRemaining: null == restTimeRemaining
          ? _value.restTimeRemaining
          : restTimeRemaining // ignore: cast_nullable_to_non_nullable
              as int,
      currentPose: freezed == currentPose
          ? _value.currentPose
          : currentPose // ignore: cast_nullable_to_non_nullable
              as PoseFrame?,
      currentEvaluation: freezed == currentEvaluation
          ? _value.currentEvaluation
          : currentEvaluation // ignore: cast_nullable_to_non_nullable
              as FrameEvaluationResult?,
      completedSets: null == completedSets
          ? _value.completedSets
          : completedSets // ignore: cast_nullable_to_non_nullable
              as List<SetData>,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $SessionConfigCopyWith<$Res>? get config {
    if (_value.config == null) {
      return null;
    }

    return $SessionConfigCopyWith<$Res>(_value.config!, (value) {
      return _then(_value.copyWith(config: value) as $Val);
    });
  }

  @override
  @pragma('vm:prefer-inline')
  $ExerciseInfoCopyWith<$Res>? get exerciseInfo {
    if (_value.exerciseInfo == null) {
      return null;
    }

    return $ExerciseInfoCopyWith<$Res>(_value.exerciseInfo!, (value) {
      return _then(_value.copyWith(exerciseInfo: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$TrainingSessionStateImplCopyWith<$Res>
    implements $TrainingSessionStateCopyWith<$Res> {
  factory _$$TrainingSessionStateImplCopyWith(_$TrainingSessionStateImpl value,
          $Res Function(_$TrainingSessionStateImpl) then) =
      __$$TrainingSessionStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {SessionPhase phase,
      SessionConfig? config,
      ExerciseInfo? exerciseInfo,
      List<SetupChecklistItem> setupChecklist,
      int countdownValue,
      int currentSet,
      int currentReps,
      double currentScore,
      List<FormIssue> currentIssues,
      DateTime? sessionStartTime,
      DateTime? setStartTime,
      int restTimeRemaining,
      PoseFrame? currentPose,
      FrameEvaluationResult? currentEvaluation,
      List<SetData> completedSets,
      String? errorMessage});

  @override
  $SessionConfigCopyWith<$Res>? get config;
  @override
  $ExerciseInfoCopyWith<$Res>? get exerciseInfo;
}

/// @nodoc
class __$$TrainingSessionStateImplCopyWithImpl<$Res>
    extends _$TrainingSessionStateCopyWithImpl<$Res, _$TrainingSessionStateImpl>
    implements _$$TrainingSessionStateImplCopyWith<$Res> {
  __$$TrainingSessionStateImplCopyWithImpl(_$TrainingSessionStateImpl _value,
      $Res Function(_$TrainingSessionStateImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phase = null,
    Object? config = freezed,
    Object? exerciseInfo = freezed,
    Object? setupChecklist = null,
    Object? countdownValue = null,
    Object? currentSet = null,
    Object? currentReps = null,
    Object? currentScore = null,
    Object? currentIssues = null,
    Object? sessionStartTime = freezed,
    Object? setStartTime = freezed,
    Object? restTimeRemaining = null,
    Object? currentPose = freezed,
    Object? currentEvaluation = freezed,
    Object? completedSets = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_$TrainingSessionStateImpl(
      phase: null == phase
          ? _value.phase
          : phase // ignore: cast_nullable_to_non_nullable
              as SessionPhase,
      config: freezed == config
          ? _value.config
          : config // ignore: cast_nullable_to_non_nullable
              as SessionConfig?,
      exerciseInfo: freezed == exerciseInfo
          ? _value.exerciseInfo
          : exerciseInfo // ignore: cast_nullable_to_non_nullable
              as ExerciseInfo?,
      setupChecklist: null == setupChecklist
          ? _value._setupChecklist
          : setupChecklist // ignore: cast_nullable_to_non_nullable
              as List<SetupChecklistItem>,
      countdownValue: null == countdownValue
          ? _value.countdownValue
          : countdownValue // ignore: cast_nullable_to_non_nullable
              as int,
      currentSet: null == currentSet
          ? _value.currentSet
          : currentSet // ignore: cast_nullable_to_non_nullable
              as int,
      currentReps: null == currentReps
          ? _value.currentReps
          : currentReps // ignore: cast_nullable_to_non_nullable
              as int,
      currentScore: null == currentScore
          ? _value.currentScore
          : currentScore // ignore: cast_nullable_to_non_nullable
              as double,
      currentIssues: null == currentIssues
          ? _value._currentIssues
          : currentIssues // ignore: cast_nullable_to_non_nullable
              as List<FormIssue>,
      sessionStartTime: freezed == sessionStartTime
          ? _value.sessionStartTime
          : sessionStartTime // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      setStartTime: freezed == setStartTime
          ? _value.setStartTime
          : setStartTime // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      restTimeRemaining: null == restTimeRemaining
          ? _value.restTimeRemaining
          : restTimeRemaining // ignore: cast_nullable_to_non_nullable
              as int,
      currentPose: freezed == currentPose
          ? _value.currentPose
          : currentPose // ignore: cast_nullable_to_non_nullable
              as PoseFrame?,
      currentEvaluation: freezed == currentEvaluation
          ? _value.currentEvaluation
          : currentEvaluation // ignore: cast_nullable_to_non_nullable
              as FrameEvaluationResult?,
      completedSets: null == completedSets
          ? _value._completedSets
          : completedSets // ignore: cast_nullable_to_non_nullable
              as List<SetData>,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
class _$TrainingSessionStateImpl extends _TrainingSessionState {
  const _$TrainingSessionStateImpl(
      {this.phase = SessionPhase.idle,
      this.config,
      this.exerciseInfo,
      final List<SetupChecklistItem> setupChecklist = const [],
      this.countdownValue = 3,
      this.currentSet = 1,
      this.currentReps = 0,
      this.currentScore = 0.0,
      final List<FormIssue> currentIssues = const [],
      this.sessionStartTime,
      this.setStartTime,
      this.restTimeRemaining = 0,
      this.currentPose,
      this.currentEvaluation,
      final List<SetData> completedSets = const [],
      this.errorMessage})
      : _setupChecklist = setupChecklist,
        _currentIssues = currentIssues,
        _completedSets = completedSets,
        super._();

  @override
  @JsonKey()
  final SessionPhase phase;
  @override
  final SessionConfig? config;
  @override
  final ExerciseInfo? exerciseInfo;
  final List<SetupChecklistItem> _setupChecklist;
  @override
  @JsonKey()
  List<SetupChecklistItem> get setupChecklist {
    if (_setupChecklist is EqualUnmodifiableListView) return _setupChecklist;
    return EqualUnmodifiableListView(_setupChecklist);
  }

  @override
  @JsonKey()
  final int countdownValue;
  @override
  @JsonKey()
  final int currentSet;
  @override
  @JsonKey()
  final int currentReps;
  @override
  @JsonKey()
  final double currentScore;
  final List<FormIssue> _currentIssues;
  @override
  @JsonKey()
  List<FormIssue> get currentIssues {
    if (_currentIssues is EqualUnmodifiableListView) return _currentIssues;
    return EqualUnmodifiableListView(_currentIssues);
  }

  @override
  final DateTime? sessionStartTime;
  @override
  final DateTime? setStartTime;
  @override
  @JsonKey()
  final int restTimeRemaining;
  @override
  final PoseFrame? currentPose;
  @override
  final FrameEvaluationResult? currentEvaluation;
  final List<SetData> _completedSets;
  @override
  @JsonKey()
  List<SetData> get completedSets {
    if (_completedSets is EqualUnmodifiableListView) return _completedSets;
    return EqualUnmodifiableListView(_completedSets);
  }

  @override
  final String? errorMessage;

  @override
  String toString() {
    return 'TrainingSessionState(phase: $phase, config: $config, exerciseInfo: $exerciseInfo, setupChecklist: $setupChecklist, countdownValue: $countdownValue, currentSet: $currentSet, currentReps: $currentReps, currentScore: $currentScore, currentIssues: $currentIssues, sessionStartTime: $sessionStartTime, setStartTime: $setStartTime, restTimeRemaining: $restTimeRemaining, currentPose: $currentPose, currentEvaluation: $currentEvaluation, completedSets: $completedSets, errorMessage: $errorMessage)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TrainingSessionStateImpl &&
            (identical(other.phase, phase) || other.phase == phase) &&
            (identical(other.config, config) || other.config == config) &&
            (identical(other.exerciseInfo, exerciseInfo) ||
                other.exerciseInfo == exerciseInfo) &&
            const DeepCollectionEquality()
                .equals(other._setupChecklist, _setupChecklist) &&
            (identical(other.countdownValue, countdownValue) ||
                other.countdownValue == countdownValue) &&
            (identical(other.currentSet, currentSet) ||
                other.currentSet == currentSet) &&
            (identical(other.currentReps, currentReps) ||
                other.currentReps == currentReps) &&
            (identical(other.currentScore, currentScore) ||
                other.currentScore == currentScore) &&
            const DeepCollectionEquality()
                .equals(other._currentIssues, _currentIssues) &&
            (identical(other.sessionStartTime, sessionStartTime) ||
                other.sessionStartTime == sessionStartTime) &&
            (identical(other.setStartTime, setStartTime) ||
                other.setStartTime == setStartTime) &&
            (identical(other.restTimeRemaining, restTimeRemaining) ||
                other.restTimeRemaining == restTimeRemaining) &&
            (identical(other.currentPose, currentPose) ||
                other.currentPose == currentPose) &&
            (identical(other.currentEvaluation, currentEvaluation) ||
                other.currentEvaluation == currentEvaluation) &&
            const DeepCollectionEquality()
                .equals(other._completedSets, _completedSets) &&
            (identical(other.errorMessage, errorMessage) ||
                other.errorMessage == errorMessage));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      phase,
      config,
      exerciseInfo,
      const DeepCollectionEquality().hash(_setupChecklist),
      countdownValue,
      currentSet,
      currentReps,
      currentScore,
      const DeepCollectionEquality().hash(_currentIssues),
      sessionStartTime,
      setStartTime,
      restTimeRemaining,
      currentPose,
      currentEvaluation,
      const DeepCollectionEquality().hash(_completedSets),
      errorMessage);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$TrainingSessionStateImplCopyWith<_$TrainingSessionStateImpl>
      get copyWith =>
          __$$TrainingSessionStateImplCopyWithImpl<_$TrainingSessionStateImpl>(
              this, _$identity);
}

abstract class _TrainingSessionState extends TrainingSessionState {
  const factory _TrainingSessionState(
      {final SessionPhase phase,
      final SessionConfig? config,
      final ExerciseInfo? exerciseInfo,
      final List<SetupChecklistItem> setupChecklist,
      final int countdownValue,
      final int currentSet,
      final int currentReps,
      final double currentScore,
      final List<FormIssue> currentIssues,
      final DateTime? sessionStartTime,
      final DateTime? setStartTime,
      final int restTimeRemaining,
      final PoseFrame? currentPose,
      final FrameEvaluationResult? currentEvaluation,
      final List<SetData> completedSets,
      final String? errorMessage}) = _$TrainingSessionStateImpl;
  const _TrainingSessionState._() : super._();

  @override
  SessionPhase get phase;
  @override
  SessionConfig? get config;
  @override
  ExerciseInfo? get exerciseInfo;
  @override
  List<SetupChecklistItem> get setupChecklist;
  @override
  int get countdownValue;
  @override
  int get currentSet;
  @override
  int get currentReps;
  @override
  double get currentScore;
  @override
  List<FormIssue> get currentIssues;
  @override
  DateTime? get sessionStartTime;
  @override
  DateTime? get setStartTime;
  @override
  int get restTimeRemaining;
  @override
  PoseFrame? get currentPose;
  @override
  FrameEvaluationResult? get currentEvaluation;
  @override
  List<SetData> get completedSets;
  @override
  String? get errorMessage;
  @override
  @JsonKey(ignore: true)
  _$$TrainingSessionStateImplCopyWith<_$TrainingSessionStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
