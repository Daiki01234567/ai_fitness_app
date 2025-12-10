# 016 プッシュアップ評価ロジック

## 概要

プッシュアップ種目のフォーム評価ロジックを実装するチケットです。肘の角度が80-100度になっているか、体のラインが真っ直ぐ（肩-腰-足首が一直線）かの2つのチェックを行い、0-100点のスコアを算出します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **014**: フォーム評価エンジン

## 要件

### 機能要件

- FR-014: フォーム評価機能（プッシュアップ）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [x] 肘の角度（80-100度）をチェックする`checkElbowAngle`関数を実装
- [x] 体のライン（肩-腰-足首が170度以上）をチェックする`checkBodyLine`関数を実装
- [x] プッシュアップの状態マシン（Up → Descending → Down → Ascending）を実装
- [x] レップカウンター（1レップの完了を検出）を実装
- [x] フレーム単位のスコア（0-100点）を計算
- [x] セッション終了時に総合スコアを計算
- [ ] 実機でプッシュアップを行い、正しくレップがカウントされることを確認
- [ ] スコアが妥当な値になることを確認（良いフォーム: 80-100点、悪いフォーム: 50点以下）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - プッシュアップ評価基準

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    └── exercises/
        ├── PushupEvaluator.ts         # プッシュアップ評価ロジック
        └── PushupStateMachine.ts      # プッシュアップの状態マシン
```

### チェック関数

```typescript
/**
 * 肘の角度をチェック
 * @param shoulder 肩の関節点
 * @param elbow 肘の関節点
 * @param wrist 手首の関節点
 * @returns チェック結果と角度
 */
function checkElbowAngle(
  shoulder: Landmark,
  elbow: Landmark,
  wrist: Landmark
): { passed: boolean; angle: number } {
  const angle = calculateAngle(shoulder, elbow, wrist);
  const passed = angle >= 80 && angle <= 100;

  return { passed, angle };
}

/**
 * 体のラインをチェック
 * @param shoulder 肩の関節点
 * @param hip 腰の関節点
 * @param ankle 足首の関節点
 * @returns チェック結果と角度
 */
function checkBodyLine(
  shoulder: Landmark,
  hip: Landmark,
  ankle: Landmark
): { passed: boolean; angle: number } {
  const angle = calculateAngle(shoulder, hip, ankle);
  const passed = angle >= 170;

  return { passed, angle };
}
```

### 状態マシン

```typescript
enum PushupPhase {
  UP = 'up',
  DESCENDING = 'descending',
  DOWN = 'down',
  ASCENDING = 'ascending'
}

class PushupStateMachine extends BaseExerciseStateMachine<PushupPhase> {
  constructor() {
    super(PushupPhase.UP);
  }

  processFrame(landmarks: Landmark[]): void {
    const elbowAngle = this.calculateElbowAngle(landmarks);

    switch (this.currentPhase) {
      case PushupPhase.UP:
        if (elbowAngle < 140) {
          this.currentPhase = PushupPhase.DESCENDING;
        }
        break;

      case PushupPhase.DESCENDING:
        if (elbowAngle <= 100) {
          this.currentPhase = PushupPhase.DOWN;
        }
        break;

      case PushupPhase.DOWN:
        if (elbowAngle > 100) {
          this.currentPhase = PushupPhase.ASCENDING;
        }
        break;

      case PushupPhase.ASCENDING:
        if (elbowAngle >= 160) {
          this.repCount++;
          this.currentPhase = PushupPhase.UP;
        }
        break;
    }
  }
}
```

### プッシュアップ評価器

```typescript
export class PushupEvaluator {
  private stateMachine: PushupStateMachine;
  private frameScores: number[] = [];

  constructor() {
    this.stateMachine = new PushupStateMachine();
  }

  evaluateFrame(landmarks: Landmark[]): {
    score: number;
    repCount: number;
    feedback: string[];
  } {
    const checks: boolean[] = [];
    const feedback: string[] = [];

    // チェック1: 肘の角度
    const elbowAngleResult = checkElbowAngle(
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_ELBOW],
      landmarks[LandmarkIndex.LEFT_WRIST]
    );
    checks.push(elbowAngleResult.passed);
    if (!elbowAngleResult.passed) {
      feedback.push('肘の角度を90度にしましょう');
    }

    // チェック2: 体のライン
    const bodyLineResult = checkBodyLine(
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_HIP],
      landmarks[LandmarkIndex.LEFT_ANKLE]
    );
    checks.push(bodyLineResult.passed);
    if (!bodyLineResult.passed) {
      feedback.push('体のラインを真っ直ぐに保ちましょう');
    }

    const score = calculateFrameScore(checks);
    this.frameScores.push(score);
    this.stateMachine.processFrame(landmarks);

    return {
      score,
      repCount: this.stateMachine.getRepCount(),
      feedback,
    };
  }

  getOverallScore(): number {
    return calculateOverallScore(this.frameScores);
  }
}
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] コード実装完了（2025-12-11）
- [ ] 実機テスト待ち

## 完了日

未定（実機テスト完了後に更新）

## 実装済みファイル

- `expo_app/services/evaluation/exercises/PushupEvaluator.ts` - プッシュアップ評価ロジック

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（React Native/Expo）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → MediaPipe → 骨格座標取得（33関節点）
2. フロントエンド: プッシュアップ評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

## 備考

- **推奨カメラ位置**: 横（side）から撮影すると精度が高い
- **膝つきプッシュアップ**: 初心者向けに膝つきプッシュアップもサポート予定（Phase 3）
- **左右対称**: 左右どちらの腕でも検出できるようにする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | コード実装完了（PushupEvaluator）、実機テスト待ち |
