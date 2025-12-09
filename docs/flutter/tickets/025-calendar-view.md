# 025 カレンダー表示機能

## 概要

履歴画面にカレンダー形式でトレーニング実施日を表示する機能を実装するチケットです。table_calendarパッケージを使用して、トレーニングした日にマーカーを表示します。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 024: 履歴画面実装

## 要件

### 機能要件

- FR-021: カレンダー形式でトレーニング履歴を確認できる
- FR-022: トレーニング実施日にマーカーが表示される
- FR-023: カレンダーから日付を選択して、その日のトレーニング一覧を確認できる

### 非機能要件

- NFR-015: カレンダーデータは1秒以内に表示される

## 受け入れ条件（Todo）

- [ ] table_calendarパッケージがインストールされている
- [ ] 月単位のカレンダーが表示される
- [ ] トレーニング実施日にドット（●）マーカーが表示される
- [ ] 複数種目実施した日は複数色のマーカーが表示される
- [ ] 日付をタップすると、その日のセッション一覧が下に表示される
- [ ] カレンダーは月単位で切り替えられる
- [ ] 今日の日付がハイライトされる
- [ ] ローディング中はスピナーが表示される
- [ ] エラー時は適切なエラーメッセージが表示される

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-021, FR-022, FR-023
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション

## 技術詳細

### パッケージインストール

```yaml
# pubspec.yaml
dependencies:
  table_calendar: ^3.0.9
```

### カレンダー画面

```dart
// lib/screens/history/calendar_view.dart
class CalendarView extends ConsumerStatefulWidget {
  @override
  ConsumerState<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends ConsumerState<CalendarView> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  Widget build(BuildContext context) {
    final calendarData = ref.watch(calendarDataProvider);

    return Column(
      children: [
        Card(
          margin: EdgeInsets.all(16),
          child: TableCalendar(
            firstDay: DateTime.utc(2020, 1, 1),
            lastDay: DateTime.now().add(Duration(days: 365)),
            focusedDay: _focusedDay,
            selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
            calendarFormat: CalendarFormat.month,
            headerStyle: HeaderStyle(
              formatButtonVisible: false,
              titleCentered: true,
            ),
            calendarStyle: CalendarStyle(
              todayDecoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.5),
                shape: BoxShape.circle,
              ),
              selectedDecoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                shape: BoxShape.circle,
              ),
              markerDecoration: BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
            ),
            eventLoader: (day) {
              return calendarData[_normalizeDate(day)] ?? [];
            },
            onDaySelected: (selectedDay, focusedDay) {
              setState(() {
                _selectedDay = selectedDay;
                _focusedDay = focusedDay;
              });
            },
            onPageChanged: (focusedDay) {
              _focusedDay = focusedDay;
            },
          ),
        ),

        // 選択した日のセッション一覧
        if (_selectedDay != null)
          Expanded(
            child: _buildSessionsForDay(_selectedDay!),
          ),
      ],
    );
  }

  Widget _buildSessionsForDay(DateTime day) {
    final sessions = ref.watch(
      sessionsByDateProvider(_normalizeDate(day)),
    );

    return sessions.when(
      data: (sessions) {
        if (sessions.isEmpty) {
          return Center(
            child: Text('この日のトレーニングはありません'),
          );
        }

        return ListView.builder(
          padding: EdgeInsets.symmetric(horizontal: 16),
          itemCount: sessions.length,
          itemBuilder: (context, index) {
            return SessionCard(session: sessions[index]);
          },
        );
      },
      loading: () => Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(child: Text('エラー: $error')),
    );
  }

  DateTime _normalizeDate(DateTime date) {
    return DateTime(date.year, date.month, date.day);
  }
}
```

### カレンダーデータProvider

```dart
// lib/providers/calendar_data_provider.dart
@riverpod
Future<Map<DateTime, List<TrainingSession>>> calendarData(
  CalendarDataRef ref,
) async {
  final sessions = await ref.watch(historyProvider.future);

  final Map<DateTime, List<TrainingSession>> data = {};

  for (final session in sessions) {
    final date = DateTime(
      session.startTime.year,
      session.startTime.month,
      session.startTime.day,
    );

    if (data[date] == null) {
      data[date] = [];
    }

    data[date]!.add(session);
  }

  return data;
}

@riverpod
Future<List<TrainingSession>> sessionsByDate(
  SessionsByDateRef ref,
  DateTime date,
) async {
  final calendarData = await ref.watch(calendarDataProvider.future);
  return calendarData[date] ?? [];
}
```

### カスタムマーカー表示

```dart
// lib/widgets/calendar_marker.dart
class CalendarMarker extends StatelessWidget {
  final List<TrainingSession> sessions;

  const CalendarMarker({required this.sessions});

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) return SizedBox.shrink();

    // 最大3個のマーカーを表示
    final visibleSessions = sessions.take(3).toList();

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: visibleSessions.map((session) {
        return Container(
          margin: EdgeInsets.symmetric(horizontal: 1),
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: session.exerciseType.color,
            shape: BoxShape.circle,
          ),
        );
      }).toList(),
    );
  }
}

// TableCalendarのカスタマイズ
TableCalendar(
  // ... 他の設定

  calendarBuilders: CalendarBuilders(
    markerBuilder: (context, date, events) {
      if (events.isEmpty) return null;

      return Positioned(
        bottom: 4,
        child: CalendarMarker(
          sessions: events.cast<TrainingSession>(),
        ),
      );
    },
  ),
)
```

### 種目別色定義

```dart
// lib/models/exercise_type.dart（拡張）
extension ExerciseTypeColor on ExerciseType {
  Color get color {
    switch (this) {
      case ExerciseType.squat:
        return Colors.blue;
      case ExerciseType.pushup:
        return Colors.green;
      case ExerciseType.armCurl:
        return Colors.orange;
      case ExerciseType.sideRaise:
        return Colors.purple;
      case ExerciseType.shoulderPress:
        return Colors.red;
    }
  }

  String get displayName {
    switch (this) {
      case ExerciseType.squat:
        return 'スクワット';
      case ExerciseType.pushup:
        return 'プッシュアップ';
      case ExerciseType.armCurl:
        return 'アームカール';
      case ExerciseType.sideRaise:
        return 'サイドレイズ';
      case ExerciseType.shoulderPress:
        return 'ショルダープレス';
    }
  }
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- table_calendarパッケージはカスタマイズ性が高い
- トレーニングデータはチケット024で取得済み
- カレンダーは月単位での表示がメイン
- グラフ表示はチケット026で実装

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
