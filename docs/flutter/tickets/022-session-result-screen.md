# 022 セッション結果画面

## 概要

トレーニングセッション完了後に表示される結果画面を実装するチケットです。トレーニングの統計情報（総レップ数、平均フォームスコア、消費カロリー推定等）を表示し、Firestoreにセッションデータを保存します。

## Phase

Phase 2（ML Kit統合・画面実装）

## プラットフォーム

Flutter

## 依存チケット

- 021: トレーニング実行画面

## 要件

### 機能要件

- FR-013: トレーニング終了後、統計情報が表示される
- FR-014: セッションデータがFirestoreに保存される
- FR-015: ユーザーは結果をシェアできる（オプション）

### 非機能要件

- NFR-012: セッションデータは3秒以内にFirestoreに保存される
- NFR-018: データ保存失敗時は適切なエラーメッセージが表示される

## 受け入れ条件（Todo）

- [ ] トレーニング完了時に結果画面が自動的に表示される
- [ ] 総レップ数、セット数、平均フォームスコアが表示される
- [ ] トレーニング時間（分:秒）が表示される
- [ ] 消費カロリー推定値が表示される（体重×METs×時間）
- [ ] セッションデータがFirestoreの`sessions`コレクションに保存される
- [ ] 保存エラー時は再試行ボタンが表示される
- [ ] ホーム画面に戻るボタンがある
- [ ] 履歴画面に遷移するボタンがある
- [ ] ローディング中はスピナーが表示される
- [ ] 保存成功時はスナックバーで通知される

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-013, FR-014
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セッション保存API

## 技術詳細

### 画面構成

```dart
// lib/screens/training/session_result_screen.dart
class SessionResultScreen extends ConsumerWidget {
  final TrainingSessionResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Text('トレーニング結果'),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            // お疲れ様メッセージ
            _buildCongratulationsCard(),

            SizedBox(height: 24),

            // 統計サマリー
            _buildStatsGrid(result),

            SizedBox(height: 24),

            // 詳細メトリクス
            _buildDetailedMetrics(result),

            SizedBox(height: 24),

            // アクションボタン
            _buildActionButtons(context, ref),
          ],
        ),
      ),
    );
  }
}
```

### 統計表示

```dart
Widget _buildStatsGrid(TrainingSessionResult result) {
  return GridView.count(
    crossAxisCount: 2,
    shrinkWrap: true,
    physics: NeverScrollableScrollPhysics(),
    mainAxisSpacing: 16,
    crossAxisSpacing: 16,
    childAspectRatio: 1.5,
    children: [
      _StatCard(
        icon: Icons.fitness_center,
        label: '総レップ数',
        value: '${result.totalReps}',
        color: Colors.blue,
      ),
      _StatCard(
        icon: Icons.timer,
        label: 'トレーニング時間',
        value: _formatDuration(result.duration),
        color: Colors.green,
      ),
      _StatCard(
        icon: Icons.star,
        label: '平均フォームスコア',
        value: '${result.averageFormScore.toInt()}点',
        color: Colors.orange,
      ),
      _StatCard(
        icon: Icons.local_fire_department,
        label: '消費カロリー',
        value: '${result.estimatedCalories} kcal',
        color: Colors.red,
      ),
    ],
  );
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: color),
            SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
```

### Firestore保存

```dart
// lib/services/session_service.dart
class SessionService {
  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  SessionService(this._firestore, this._auth);

  Future<void> saveSession(TrainingSessionResult result) async {
    final userId = _auth.currentUser?.uid;
    if (userId == null) {
      throw Exception('ユーザーが認証されていません');
    }

    final sessionData = {
      'userId': userId,
      'exerciseType': result.exerciseType.name,
      'startTime': result.startTime.toIso8601String(),
      'endTime': result.endTime.toIso8601String(),
      'duration': result.duration.inSeconds,
      'totalReps': result.totalReps,
      'totalSets': result.totalSets,
      'averageFormScore': result.averageFormScore,
      'estimatedCalories': result.estimatedCalories,
      'poseData': result.poseData.map((p) => p.toJson()).toList(),
      'createdAt': FieldValue.serverTimestamp(),
    };

    await _firestore
        .collection('sessions')
        .add(sessionData);
  }
}
```

### 状態管理（Riverpod）

```dart
// lib/providers/session_result_provider.dart
@riverpod
class SessionSaver extends _$SessionSaver {
  @override
  AsyncValue<void> build() {
    return const AsyncValue.data(null);
  }

  Future<void> saveSession(TrainingSessionResult result) async {
    state = const AsyncValue.loading();

    state = await AsyncValue.guard(() async {
      final service = ref.read(sessionServiceProvider);
      await service.saveSession(result);
    });
  }
}

// 使用例（Widget内）
ref.listen(sessionSaverProvider, (previous, next) {
  next.when(
    data: (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('トレーニングデータを保存しました')),
      );
    },
    error: (error, stack) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('保存に失敗しました: $error'),
          action: SnackBarAction(
            label: '再試行',
            onPressed: () => _retrySave(),
          ),
        ),
      );
    },
    loading: () {},
  );
});
```

### カロリー推定計算

```dart
// lib/utils/calorie_calculator.dart
class CalorieCalculator {
  // METs（Metabolic Equivalents）定数
  static const Map<ExerciseType, double> mets = {
    ExerciseType.squat: 5.0,
    ExerciseType.pushup: 3.8,
    ExerciseType.armCurl: 3.5,
    ExerciseType.sideRaise: 3.5,
    ExerciseType.shoulderPress: 4.0,
  };

  /// カロリー消費量を推定
  /// 計算式: METs × 体重(kg) × 時間(h)
  static int estimateCalories({
    required ExerciseType exerciseType,
    required double userWeightKg,
    required Duration duration,
  }) {
    final met = mets[exerciseType] ?? 4.0;
    final hours = duration.inSeconds / 3600.0;
    final calories = met * userWeightKg * hours;

    return calories.round();
  }
}
```

### アクションボタン

```dart
Widget _buildActionButtons(BuildContext context, WidgetRef ref) {
  return Column(
    children: [
      ElevatedButton.icon(
        onPressed: () {
          context.go('/history');
        },
        icon: Icon(Icons.history),
        label: Text('履歴を見る'),
        style: ElevatedButton.styleFrom(
          minimumSize: Size(double.infinity, 48),
        ),
      ),

      SizedBox(height: 12),

      OutlinedButton.icon(
        onPressed: () {
          context.go('/');
        },
        icon: Icon(Icons.home),
        label: Text('ホームに戻る'),
        style: OutlinedButton.styleFrom(
          minimumSize: Size(double.infinity, 48),
        ),
      ),
    ],
  );
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

- トレーニングデータは021で収集済み
- Firestoreのセキュリティルールで本人のみ書き込み可能
- BigQueryへの同期はcommon側のCloud Functionで自動実行
- ユーザーの体重情報はプロフィール画面（009）から取得

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
