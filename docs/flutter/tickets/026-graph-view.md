# 026 グラフ表示機能

## 概要

トレーニングデータをグラフで可視化する機能を実装するチケットです。fl_chartパッケージを使用して、フォームスコアの推移、レップ数の推移、種目別トレーニング頻度などを表示します。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 024: 履歴画面実装

## 要件

### 機能要件

- FR-024: フォームスコアの推移をグラフで確認できる
- FR-025: レップ数の推移をグラフで確認できる
- FR-026: 種目別のトレーニング頻度を円グラフで確認できる

### 非機能要件

- NFR-016: グラフは1秒以内に描画される

## 受け入れ条件（Todo）

- [ ] fl_chartパッケージがインストールされている
- [ ] フォームスコアの折れ線グラフが表示される
- [ ] レップ数の棒グラフが表示される
- [ ] 種目別トレーニング頻度の円グラフが表示される
- [ ] グラフは過去7日間、30日間、全期間で切り替えられる
- [ ] グラフをタップすると詳細情報がツールチップで表示される
- [ ] データがない期間は適切に表示される
- [ ] ローディング中はスピナーが表示される
- [ ] エラー時は適切なエラーメッセージが表示される

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-024, FR-025, FR-026
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション

## 技術詳細

### パッケージインストール

```yaml
# pubspec.yaml
dependencies:
  fl_chart: ^0.65.0
```

### グラフ表示画面

```dart
// lib/screens/history/graph_view.dart
class GraphView extends ConsumerStatefulWidget {
  @override
  ConsumerState<GraphView> createState() => _GraphViewState();
}

class _GraphViewState extends ConsumerState<GraphView> {
  DateRange _selectedRange = DateRange.last7Days;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 期間選択
          _buildDateRangeSelector(),

          SizedBox(height: 24),

          // フォームスコア推移グラフ
          _buildSectionTitle('フォームスコアの推移'),
          SizedBox(height: 16),
          FormScoreLineChart(range: _selectedRange),

          SizedBox(height: 32),

          // レップ数推移グラフ
          _buildSectionTitle('レップ数の推移'),
          SizedBox(height: 16),
          RepsBarChart(range: _selectedRange),

          SizedBox(height: 32),

          // 種目別頻度グラフ
          _buildSectionTitle('種目別トレーニング頻度'),
          SizedBox(height: 16),
          ExerciseTypePieChart(range: _selectedRange),
        ],
      ),
    );
  }

  Widget _buildDateRangeSelector() {
    return SegmentedButton<DateRange>(
      segments: [
        ButtonSegment(
          value: DateRange.last7Days,
          label: Text('7日間'),
        ),
        ButtonSegment(
          value: DateRange.last30Days,
          label: Text('30日間'),
        ),
        ButtonSegment(
          value: DateRange.all,
          label: Text('全期間'),
        ),
      ],
      selected: {_selectedRange},
      onSelectionChanged: (newSelection) {
        setState(() {
          _selectedRange = newSelection.first;
        });
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
    );
  }
}

enum DateRange {
  last7Days,
  last30Days,
  all,
}
```

### フォームスコア折れ線グラフ

```dart
// lib/widgets/graphs/form_score_line_chart.dart
class FormScoreLineChart extends ConsumerWidget {
  final DateRange range;

  const FormScoreLineChart({required this.range});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chartData = ref.watch(formScoreChartDataProvider(range));

    return chartData.when(
      data: (data) {
        if (data.isEmpty) {
          return _buildEmptyState();
        }

        return SizedBox(
          height: 250,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(show: true),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 40,
                    getTitlesWidget: (value, meta) {
                      return Text('${value.toInt()}');
                    },
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, meta) {
                      return Text(
                        _formatDate(data[value.toInt()].date),
                        style: TextStyle(fontSize: 10),
                      );
                    },
                  ),
                ),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: true),
              minY: 0,
              maxY: 100,
              lineBarsData: [
                LineChartBarData(
                  spots: data.asMap().entries.map((entry) {
                    return FlSpot(
                      entry.key.toDouble(),
                      entry.value.score,
                    );
                  }).toList(),
                  isCurved: true,
                  color: Colors.blue,
                  barWidth: 3,
                  dotData: FlDotData(show: true),
                  belowBarData: BarAreaData(
                    show: true,
                    color: Colors.blue.withOpacity(0.2),
                  ),
                ),
              ],
            ),
          ),
        );
      },
      loading: () => SizedBox(
        height: 250,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => SizedBox(
        height: 250,
        child: Center(child: Text('エラー: $error')),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      height: 250,
      alignment: Alignment.center,
      child: Text('この期間のデータがありません'),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}';
  }
}
```

### レップ数棒グラフ

```dart
// lib/widgets/graphs/reps_bar_chart.dart
class RepsBarChart extends ConsumerWidget {
  final DateRange range;

  const RepsBarChart({required this.range});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chartData = ref.watch(repsChartDataProvider(range));

    return chartData.when(
      data: (data) {
        if (data.isEmpty) {
          return _buildEmptyState();
        }

        return SizedBox(
          height: 250,
          child: BarChart(
            BarChartData(
              gridData: FlGridData(show: true),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 40,
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, meta) {
                      return Text(
                        _formatDate(data[value.toInt()].date),
                        style: TextStyle(fontSize: 10),
                      );
                    },
                  ),
                ),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: true),
              barGroups: data.asMap().entries.map((entry) {
                return BarChartGroupData(
                  x: entry.key,
                  barRods: [
                    BarChartRodData(
                      toY: entry.value.reps.toDouble(),
                      color: Colors.green,
                      width: 16,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(4),
                        topRight: Radius.circular(4),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        );
      },
      loading: () => SizedBox(
        height: 250,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => SizedBox(
        height: 250,
        child: Center(child: Text('エラー: $error')),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      height: 250,
      alignment: Alignment.center,
      child: Text('この期間のデータがありません'),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}';
  }
}
```

### 種目別頻度円グラフ

```dart
// lib/widgets/graphs/exercise_type_pie_chart.dart
class ExerciseTypePieChart extends ConsumerWidget {
  final DateRange range;

  const ExerciseTypePieChart({required this.range});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chartData = ref.watch(exerciseTypeChartDataProvider(range));

    return chartData.when(
      data: (data) {
        if (data.isEmpty) {
          return _buildEmptyState();
        }

        return SizedBox(
          height: 250,
          child: PieChart(
            PieChartData(
              sections: data.entries.map((entry) {
                return PieChartSectionData(
                  value: entry.value.toDouble(),
                  title: '${entry.key.displayName}\n${entry.value}回',
                  color: entry.key.color,
                  radius: 100,
                  titleStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                );
              }).toList(),
              sectionsSpace: 2,
              centerSpaceRadius: 40,
            ),
          ),
        );
      },
      loading: () => SizedBox(
        height: 250,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => SizedBox(
        height: 250,
        child: Center(child: Text('エラー: $error')),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      height: 250,
      alignment: Alignment.center,
      child: Text('この期間のデータがありません'),
    );
  }
}
```

### グラフデータProvider

```dart
// lib/providers/graph_data_provider.dart
@riverpod
Future<List<FormScoreDataPoint>> formScoreChartData(
  FormScoreChartDataRef ref,
  DateRange range,
) async {
  final sessions = await ref.watch(historyProvider.future);
  final filteredSessions = _filterByDateRange(sessions, range);

  return filteredSessions.map((session) {
    return FormScoreDataPoint(
      date: session.startTime,
      score: session.averageFormScore,
    );
  }).toList();
}

@riverpod
Future<List<RepsDataPoint>> repsChartData(
  RepsChartDataRef ref,
  DateRange range,
) async {
  final sessions = await ref.watch(historyProvider.future);
  final filteredSessions = _filterByDateRange(sessions, range);

  return filteredSessions.map((session) {
    return RepsDataPoint(
      date: session.startTime,
      reps: session.totalReps,
    );
  }).toList();
}

@riverpod
Future<Map<ExerciseType, int>> exerciseTypeChartData(
  ExerciseTypeChartDataRef ref,
  DateRange range,
) async {
  final sessions = await ref.watch(historyProvider.future);
  final filteredSessions = _filterByDateRange(sessions, range);

  final Map<ExerciseType, int> counts = {};

  for (final session in filteredSessions) {
    counts[session.exerciseType] = (counts[session.exerciseType] ?? 0) + 1;
  }

  return counts;
}

List<TrainingSession> _filterByDateRange(
  List<TrainingSession> sessions,
  DateRange range,
) {
  final now = DateTime.now();

  switch (range) {
    case DateRange.last7Days:
      final cutoff = now.subtract(Duration(days: 7));
      return sessions.where((s) => s.startTime.isAfter(cutoff)).toList();

    case DateRange.last30Days:
      final cutoff = now.subtract(Duration(days: 30));
      return sessions.where((s) => s.startTime.isAfter(cutoff)).toList();

    case DateRange.all:
      return sessions;
  }
}
```

## 見積もり

- 工数: 5日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- fl_chartは多機能なグラフライブラリ
- トレーニングデータはチケット024で取得済み
- カレンダー表示はチケット025で実装済み
- グラフはインタラクティブ（タップでツールチップ表示）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
