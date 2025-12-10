# 021 トレーニング実行画面

## 概要

実際にトレーニングを行う画面を実装します。カメラプレビュー上に骨格をリアルタイムでオーバーレイ表示し、フォーム評価のフィードバックをリアルタイムで提供します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/012: カメラ機能実装
- expo/013: 骨格検出基盤
- expo/020: メニュー選択画面

## 要件

### 機能要件

- FR-004: リアルタイムフォーム評価機能
- FR-005: 音声フィードバック機能（expo/023で実装、本チケットでは準備のみ）

### 非機能要件

- NFR-024: MediaPipe処理を30fps以上で実行
- NFR-025: 低スペックデバイスでは15fps以上を保証

## 受け入れ条件（Todo）

- [ ] カメラプレビューが正しく表示される
- [ ] 骨格がリアルタイムでカメラ映像上にオーバーレイ表示される
- [ ] リアルタイムフォーム評価が画面上部に表示される（「参考: 良いフォームです」など）
- [ ] レップカウント（回数）が正確に表示される
- [ ] 経過時間が表示される
- [ ] 進捗バー（YouTube風）が表示される
- [ ] 一時停止・再開ボタンが機能する
- [ ] 終了ボタンで結果画面（expo/022）に遷移する
- [ ] 体認識が中断した場合、自動的に一時停止する
- [ ] 30秒以上認識できない場合、確認ダイアログを表示する
- [ ] 薬機法に準拠した表現（「参考:」プレフィックス）を使用する

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-004, FR-005
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-024, NFR-025
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - MediaPipe統合詳細
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - トレーニング実行画面UI設計

## 技術詳細

### 画面構成

```
+----------------------------------+
| [<戻る] トレーニング実行  [終了] |
+----------------------------------+
| 参考: 良いフォームです           | ← フィードバック表示エリア
+----------------------------------+
|                                  |
|     カメラプレビュー              |
|     + 骨格オーバーレイ            | ← MediaPipe姿勢検出
|                                  |
|                                  |
+----------------------------------+
| レップ: 5回 | 時間: 01:23         | ← 進捗情報
| ███████░░░░░ 60%                 | ← 進捗バー
+----------------------------------+
| [一時停止] [終了]                 | ← 操作ボタン
+----------------------------------+
```

### 使用ライブラリ

- **react-native-vision-camera**: カメラプレビュー
- **MediaPipe Pose（ネイティブモジュール）**: 骨格検出（expo/013で実装済み）
- **React Native Paper**: UIコンポーネント
- **Zustand**: 状態管理（トレーニング状態）

### 主要コンポーネント

```typescript
// components/training/TrainingExecutionScreen.tsx

import { Camera } from 'react-native-vision-camera';
import { useTrainingStore } from '@/store/trainingStore';
import { usePoseDetection } from '@/services/mediapipe/usePoseDetection';

export function TrainingExecutionScreen() {
  const { sessionData, updateReps, pauseSession, endSession } = useTrainingStore();
  const { landmarks, frameRate } = usePoseDetection();

  // リアルタイムフォーム評価
  const formFeedback = evaluateForm(landmarks, sessionData.exerciseType);

  // レップカウント
  useEffect(() => {
    if (isRepCompleted(landmarks)) {
      updateReps(sessionData.reps + 1);
    }
  }, [landmarks]);

  // 体認識中断検知
  useEffect(() => {
    if (!landmarks && isTrainingActive) {
      setUnrecognizedDuration(prev => prev + 1);
      if (unrecognizedDuration > 30) {
        showConfirmDialog();
      }
    }
  }, [landmarks]);

  return (
    <View style={styles.container}>
      <Header onBack={handleBack} onEnd={handleEnd} />
      <FeedbackBar message={formFeedback} />
      <CameraPreview>
        <SkeletonOverlay landmarks={landmarks} />
      </CameraPreview>
      <ProgressInfo
        reps={sessionData.reps}
        duration={sessionData.duration}
        progress={sessionData.progress}
      />
      <ControlButtons
        onPause={pauseSession}
        onEnd={endSession}
      />
    </View>
  );
}
```

### フィードバック表示

薬機法対応のため、すべてのフィードバックに「参考:」プレフィックスを付けます。

```typescript
const feedbackMessages = {
  good: "参考: 良いフォームです",
  kneesForward: "参考: 膝が前に出すぎているかもしれません",
  backStraight: "参考: 背中をまっすぐにしてみましょう",
  elbowPosition: "参考: 肘の位置を確認してみてください",
  // ...
};
```

### パフォーマンス最適化

- MediaPipe処理を30fps目標で実行（NFR-024）
- 低スペックデバイス検出時は15fpsにフォールバック（NFR-025）
- フレームスキップによる処理負荷軽減
- `React.memo`によるコンポーネント再レンダリング抑制

### 状態管理（Zustand）

```typescript
// store/trainingStore.ts

interface TrainingState {
  sessionData: {
    exerciseType: string;
    reps: number;
    duration: number;
    progress: number;
    isActive: boolean;
    isPaused: boolean;
  };
  updateReps: (reps: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
}

export const useTrainingStore = create<TrainingState>((set) => ({
  // 実装...
}));
```

## テスト項目

### 単体テスト（Jest）

- [ ] フォーム評価ロジックが正しく動作する
- [ ] レップカウントが正確にインクリメントされる
- [ ] 一時停止・再開が正しく機能する

### 統合テスト

- [ ] 骨格検出とフォーム評価が連携する
- [ ] 体認識中断時に自動一時停止する
- [ ] 30秒経過後に確認ダイアログが表示される

### 実機テスト

- [ ] iPhone（iOS）で30fps以上で動作する
- [ ] Android端末で30fps以上で動作する
- [ ] 低スペックデバイスで15fps以上で動作する

## 見積もり

- 工数: 5日
- 難易度: 高（MediaPipe統合、リアルタイム処理）

## 進捗

- [ ] 未着手

## 完了日



## 備考

- カメラ映像はデバイス外に送信されない（プライバシー優先処理）
- スケルトンデータ（33関節×4値）のみをFirestoreに保存
- 音声フィードバック機能は別チケット（expo/023）で実装
- 低スペックデバイスの判定基準は expo/012 で実装済み

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
