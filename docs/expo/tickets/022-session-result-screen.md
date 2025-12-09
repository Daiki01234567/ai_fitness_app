# 022 セッション結果画面

## 概要

トレーニング終了後の結果を表示する画面を実装します。スコア、レップ数、時間などの詳細情報を表示し、メモ入力や次のアクションを選択できるようにします。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/021: トレーニング実行画面

## 要件

### 機能要件

- FR-007: トレーニング記録保存機能（バックエンドはcommon/011で実装）

### 非機能要件

- NFR-019: レスポンシブデザイン対応

## 受け入れ条件（Todo）

- [ ] トレーニング結果が正しく表示される（種目名、回数、時間、スコア）
- [ ] 平均スコア（0-100点）が視覚的に表示される
- [ ] メモ入力フィールドが機能する
- [ ] 保存ボタンでFirestoreに記録が保存される
- [ ] もう1セットボタンでメニュー選択画面（expo/020）に戻る
- [ ] ホームボタンでホーム画面（expo/008）に戻る
- [ ] 保存中はローディング表示が出る
- [ ] 保存失敗時はエラーメッセージが表示される
- [ ] 各フィードバックが一覧表示される

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-007
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Sessionsコレクション
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - セッション結果画面UI設計

## 技術詳細

### 画面構成

```
+----------------------------------+
| [<戻る] トレーニング結果          |
+----------------------------------+
| 種目: スクワット                  |
| 回数: 10回                        |
| 時間: 02:15                       |
+----------------------------------+
|        スコア: 85点               |
|     ███████████░░░░              | ← プログレスバー
+----------------------------------+
| フィードバック詳細:               |
| • 参考: 膝の角度が良好です        |
| • 参考: 背中の姿勢を確認しましょう |
| • 参考: 良いテンポです            |
+----------------------------------+
| メモ:                            |
| [テキスト入力エリア]              |
+----------------------------------+
| [保存] [もう1セット] [ホームへ]   |
+----------------------------------+
```

### 使用ライブラリ

- **React Native Paper**: UIコンポーネント（Button, Card, TextInput, ProgressBar）
- **Zustand**: 状態管理（トレーニング結果）
- **Firebase SDK**: Firestore保存（`@react-native-firebase/firestore`）
- **Expo Router**: 画面遷移

### 主要コンポーネント

```typescript
// components/training/SessionResultScreen.tsx

import { router } from 'expo-router';
import { Button, Card, TextInput, ProgressBar } from 'react-native-paper';
import { useTrainingStore } from '@/store/trainingStore';
import { saveSession } from '@/services/training/sessionService';

export function SessionResultScreen() {
  const { sessionData } = useTrainingStore();
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSession({
        ...sessionData,
        memo,
        timestamp: new Date(),
      });
      Alert.alert('保存完了', 'トレーニング記録を保存しました');
      router.push('/home');
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnotherSet = () => {
    router.push('/menu-selection');
  };

  const handleGoHome = () => {
    router.push('/home');
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.resultCard}>
        <Card.Content>
          <Text variant="headlineSmall">トレーニング結果</Text>
          <Text>種目: {sessionData.exerciseType}</Text>
          <Text>回数: {sessionData.reps}回</Text>
          <Text>時間: {formatDuration(sessionData.duration)}</Text>

          <Text variant="titleLarge" style={styles.score}>
            スコア: {sessionData.averageScore}点
          </Text>
          <ProgressBar
            progress={sessionData.averageScore / 100}
            color={getScoreColor(sessionData.averageScore)}
          />
        </Card.Content>
      </Card>

      <Card style={styles.feedbackCard}>
        <Card.Content>
          <Text variant="titleMedium">フィードバック詳細</Text>
          {sessionData.feedbacks.map((feedback, index) => (
            <Text key={index}>• {feedback}</Text>
          ))}
        </Card.Content>
      </Card>

      <TextInput
        label="メモ"
        value={memo}
        onChangeText={setMemo}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="今日のトレーニングについて記録しておきましょう"
      />

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
        >
          保存
        </Button>
        <Button
          mode="outlined"
          onPress={handleAnotherSet}
        >
          もう1セット
        </Button>
        <Button
          mode="text"
          onPress={handleGoHome}
        >
          ホームへ戻る
        </Button>
      </View>
    </ScrollView>
  );
}
```

### スコア表示の色分け

```typescript
function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50'; // 緑（良好）
  if (score >= 60) return '#FFC107'; // 黄（普通）
  return '#F44336'; // 赤（改善の余地あり）
}
```

### Firestoreへの保存

```typescript
// services/training/sessionService.ts

import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

export async function saveSession(sessionData: SessionData) {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');

  await firestore()
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .add({
      exerciseType: sessionData.exerciseType,
      reps: sessionData.reps,
      duration: sessionData.duration,
      averageScore: sessionData.averageScore,
      feedbacks: sessionData.feedbacks,
      poseData: sessionData.poseData, // 33関節×4値
      memo: sessionData.memo,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}
```

### データ構造

```typescript
interface SessionData {
  exerciseType: string; // "squat", "pushup", "armcurl", "sideraise", "shoulderpress"
  reps: number;
  duration: number; // 秒
  averageScore: number; // 0-100
  feedbacks: string[];
  poseData: number[][]; // 33関節×4値（x, y, z, visibility）
  memo?: string;
  timestamp: Date;
}
```

## テスト項目

### 単体テスト（Jest）

- [ ] スコア表示が正しく色分けされる
- [ ] 時間フォーマットが正しい（MM:SS形式）
- [ ] メモ入力が正しく保存される

### 統合テスト

- [ ] Firestore保存が成功する
- [ ] 保存失敗時にエラーメッセージが表示される
- [ ] 画面遷移が正しく動作する

### 実機テスト

- [ ] iPhone（iOS）で正しく表示される
- [ ] Android端末で正しく表示される
- [ ] メモ入力のキーボード表示が正しい

## 見積もり

- 工数: 2日
- 難易度: 中（Firestore連携、UI実装）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- 保存されたセッションデータは履歴画面（expo/024）で表示される
- スケルトンデータ（poseData）は将来のフォーム改善分析に使用
- バックエンドのセッション保存API（common/011）が完了している必要あり

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
