# 024 履歴画面実装

## 概要

ユーザーの過去のトレーニングセッションを一覧表示する履歴画面を実装するチケットです。Firestoreから`sessions`コレクションを取得し、日付順にリスト表示します。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 010: ボトムナビゲーション
- common/011: セッション保存API（完了後）
- common/012: セッション取得API（完了後）
- common/013: 履歴一覧API（完了後）

## 要件

### 機能要件

- FR-018: ユーザーは過去のトレーニング履歴を閲覧できる
- FR-019: 履歴は日付順に表示される
- FR-020: 各セッションの詳細を確認できる

### 非機能要件

- NFR-013: 履歴データは2秒以内に表示される
- NFR-014: 100件以上のセッションがある場合はページネーションされる

## 受け入れ条件（Todo）

- [ ] 履歴画面がボトムナビゲーションから遷移できる
- [ ] Firestoreから自分のセッション一覧を取得できる
- [ ] セッションが新しい順に表示される
- [ ] 各セッションカードに日付、種目、レップ数、スコアが表示される
- [ ] セッションをタップすると詳細画面に遷移する
- [ ] 履歴がない場合は「まだトレーニング履歴がありません」と表示される
- [ ] ローディング中はスピナーが表示される
- [ ] エラー時は適切なエラーメッセージが表示される
- [ ] プルダウンでリフレッシュできる
- [ ] 無限スクロールでページネーションされる（25件ずつ）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-018, FR-019, FR-020
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 履歴取得API

## 技術詳細

### 画面構成

```dart
// lib/screens/history/history_screen.dart
class HistoryScreen extends ConsumerStatefulWidget {
  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();

    // 無限スクロール
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent * 0.8) {
        ref.read(historyProvider.notifier).loadMore();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(historyProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('トレーニング履歴'),
      ),
      body: historyState.when(
        data: (sessions) => _buildHistoryList(sessions),
        loading: () => Center(child: CircularProgressIndicator()),
        error: (error, stack) => _buildError(error),
      ),
    );
  }

  Widget _buildHistoryList(List<TrainingSession> sessions) {
    if (sessions.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(historyProvider);
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: EdgeInsets.all(16),
        itemCount: sessions.length + 1,
        itemBuilder: (context, index) {
          if (index == sessions.length) {
            return _buildLoadingIndicator();
          }

          return SessionCard(session: sessions[index]);
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            'まだトレーニング履歴がありません',
            style: TextStyle(fontSize: 16, color: Colors.grey),
          ),
          SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => context.go('/'),
            child: Text('トレーニングを始める'),
          ),
        ],
      ),
    );
  }
}
```

### セッションカード

```dart
// lib/widgets/session_card.dart
class SessionCard extends StatelessWidget {
  final TrainingSession session;

  const SessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          context.push('/history/${session.id}');
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ヘッダー（日付・種目）
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatDate(session.startTime),
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                  Chip(
                    label: Text(session.exerciseType.displayName),
                    backgroundColor: session.exerciseType.color.withOpacity(0.2),
                  ),
                ],
              ),

              SizedBox(height: 12),

              // メトリクス
              Row(
                children: [
                  _MetricBadge(
                    icon: Icons.fitness_center,
                    label: '${session.totalReps}レップ',
                  ),
                  SizedBox(width: 12),
                  _MetricBadge(
                    icon: Icons.timer,
                    label: _formatDuration(session.duration),
                  ),
                  SizedBox(width: 12),
                  _MetricBadge(
                    icon: Icons.star,
                    label: '${session.averageFormScore.toInt()}点',
                    color: _getScoreColor(session.averageFormScore),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}年${date.month}月${date.day}日 ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  Color _getScoreColor(double score) {
    if (score >= 80) return Colors.green;
    if (score >= 60) return Colors.orange;
    return Colors.red;
  }
}

class _MetricBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _MetricBadge({
    required this.icon,
    required this.label,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color ?? Colors.grey[600]),
        SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: color ?? Colors.grey[800],
            fontWeight: color != null ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}
```

### Firestore取得（Riverpod）

```dart
// lib/providers/history_provider.dart
@riverpod
class History extends _$History {
  static const int _pageSize = 25;
  DocumentSnapshot? _lastDocument;
  bool _hasMore = true;

  @override
  Future<List<TrainingSession>> build() async {
    return _loadSessions();
  }

  Future<List<TrainingSession>> _loadSessions({bool loadMore = false}) async {
    if (loadMore && !_hasMore) {
      return state.value ?? [];
    }

    final userId = ref.read(authProvider).currentUser?.uid;
    if (userId == null) {
      throw Exception('ユーザーが認証されていません');
    }

    Query query = FirebaseFirestore.instance
        .collection('sessions')
        .where('userId', isEqualTo: userId)
        .orderBy('startTime', descending: true)
        .limit(_pageSize);

    if (loadMore && _lastDocument != null) {
      query = query.startAfterDocument(_lastDocument!);
    }

    final snapshot = await query.get();

    if (snapshot.docs.length < _pageSize) {
      _hasMore = false;
    }

    if (snapshot.docs.isNotEmpty) {
      _lastDocument = snapshot.docs.last;
    }

    final newSessions = snapshot.docs
        .map((doc) => TrainingSession.fromFirestore(doc))
        .toList();

    if (loadMore) {
      final currentSessions = state.value ?? [];
      return [...currentSessions, ...newSessions];
    }

    return newSessions;
  }

  Future<void> loadMore() async {
    if (state.isLoading || !_hasMore) return;

    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _loadSessions(loadMore: true));
  }
}
```

### モデル

```dart
// lib/models/training_session.dart
@freezed
class TrainingSession with _$TrainingSession {
  const factory TrainingSession({
    required String id,
    required String userId,
    required ExerciseType exerciseType,
    required DateTime startTime,
    required DateTime endTime,
    required Duration duration,
    required int totalReps,
    required int totalSets,
    required double averageFormScore,
    required int estimatedCalories,
  }) = _TrainingSession;

  factory TrainingSession.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;

    return TrainingSession(
      id: doc.id,
      userId: data['userId'],
      exerciseType: ExerciseType.fromString(data['exerciseType']),
      startTime: DateTime.parse(data['startTime']),
      endTime: DateTime.parse(data['endTime']),
      duration: Duration(seconds: data['duration']),
      totalReps: data['totalReps'],
      totalSets: data['totalSets'],
      averageFormScore: data['averageFormScore'].toDouble(),
      estimatedCalories: data['estimatedCalories'],
    );
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

- commonチケット011-013の完了を待つ必要がある
- セキュリティルールで本人のセッションのみ取得可能
- ページネーションは無限スクロール方式（25件ずつ）
- カレンダー表示（025）とグラフ表示（026）は別チケット

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
