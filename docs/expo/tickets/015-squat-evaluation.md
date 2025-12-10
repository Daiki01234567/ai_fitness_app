# 015 スクワット評価ロジック

## 概要

スクワット種目のフォーム評価ロジックを実装するチケットです。膝の角度が90-110度になっているか、膝がつま先を越えていないか、背中が真っ直ぐかの3つのチェックを行い、0-100点のスコアを算出します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **014**: フォーム評価エンジン

## 要件

### 機能要件

- FR-014: フォーム評価機能（スクワット）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [x] 膝の角度（90-110度）をチェックする`checkKneeAngle`関数を実装
- [x] 膝がつま先を越えていないかをチェックする`checkKneeOverToe`関数を実装
- [x] 背中が真っ直ぐかをチェックする`checkBackStraight`関数を実装
- [x] スクワットの状態マシン（Standing → Descending → Bottom → Ascending）を実装
- [x] レップカウンター（1レップの完了を検出）を実装
- [x] フレーム単位のスコア（0-100点）を計算
- [x] セッション終了時に総合スコアを計算
- [ ] 実機でスクワットを行い、正しくレップがカウントされることを確認
- [ ] スコアが妥当な値になることを確認（良いフォーム: 80-100点、悪いフォーム: 50点以下）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - スクワット評価基準、レップカウントロジック

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    └── exercises/
        ├── SquatEvaluator.ts         # スクワット評価ロジック
        └── SquatStateMachine.ts      # スクワットの状態マシン
```

### チェック関数

```typescript
/**
 * 膝の角度をチェック
 * @param shoulder 肩の関節点
 * @param hip 腰の関節点
 * @param knee 膝の関節点
 * @returns チェック結果と角度
 */
function checkKneeAngle(
  shoulder: Landmark,
  hip: Landmark,
  knee: Landmark
): { passed: boolean; angle: number } {
  const angle = calculateAngle(shoulder, hip, knee);
  const passed = angle >= 90 && angle <= 110;

  return { passed, angle };
}

/**
 * 膝がつま先を越えていないかチェック
 * @param knee 膝の関節点
 * @param ankle 足首の関節点
 * @param footIndex 足先の関節点
 * @returns チェック結果
 */
function checkKneeOverToe(
  knee: Landmark,
  ankle: Landmark,
  footIndex: Landmark
): boolean {
  // カメラが横（side）の場合
  return knee.x <= footIndex.x + 0.05;  // 5%の許容誤差
}

/**
 * 背中が真っ直ぐかチェック
 * @param shoulder 肩の関節点
 * @param hip 腰の関節点
 * @param knee 膝の関節点
 * @returns チェック結果と角度
 */
function checkBackStraight(
  shoulder: Landmark,
  hip: Landmark,
  knee: Landmark
): { passed: boolean; angle: number } {
  const angle = calculateAngle(shoulder, hip, knee);
  const passed = angle >= 150;

  return { passed, angle };
}
```

### 状態マシン

```typescript
enum SquatPhase {
  STANDING = 'standing',
  DESCENDING = 'descending',
  BOTTOM = 'bottom',
  ASCENDING = 'ascending'
}

class SquatStateMachine extends BaseExerciseStateMachine<SquatPhase> {
  constructor() {
    super(SquatPhase.STANDING);
  }

  processFrame(landmarks: Landmark[]): void {
    const kneeAngle = this.calculateKneeAngle(landmarks);

    switch (this.currentPhase) {
      case SquatPhase.STANDING:
        if (kneeAngle < 140) {
          this.currentPhase = SquatPhase.DESCENDING;
        }
        break;

      case SquatPhase.DESCENDING:
        if (kneeAngle <= 110) {
          this.currentPhase = SquatPhase.BOTTOM;
        }
        break;

      case SquatPhase.BOTTOM:
        if (kneeAngle > 110) {
          this.currentPhase = SquatPhase.ASCENDING;
        }
        break;

      case SquatPhase.ASCENDING:
        if (kneeAngle >= 160) {
          this.repCount++;
          this.currentPhase = SquatPhase.STANDING;
        }
        break;
    }
  }
}
```

### スクワット評価器

```typescript
export class SquatEvaluator {
  private stateMachine: SquatStateMachine;
  private frameScores: number[] = [];

  constructor() {
    this.stateMachine = new SquatStateMachine();
  }

  evaluateFrame(landmarks: Landmark[]): {
    score: number;
    repCount: number;
    feedback: string[];
  } {
    const checks: boolean[] = [];
    const feedback: string[] = [];

    // チェック1: 膝の角度
    const kneeAngleResult = checkKneeAngle(
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_HIP],
      landmarks[LandmarkIndex.LEFT_KNEE]
    );
    checks.push(kneeAngleResult.passed);
    if (!kneeAngleResult.passed) {
      feedback.push('膝の角度を90-110度にしましょう');
    }

    // チェック2: 膝がつま先を越えていないか
    const kneeOverToeResult = checkKneeOverToe(
      landmarks[LandmarkIndex.LEFT_KNEE],
      landmarks[LandmarkIndex.LEFT_ANKLE],
      landmarks[LandmarkIndex.LEFT_FOOT_INDEX]
    );
    checks.push(kneeOverToeResult);
    if (!kneeOverToeResult) {
      feedback.push('膝がつま先を越えています');
    }

    // チェック3: 背中が真っ直ぐか
    const backStraightResult = checkBackStraight(
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_HIP],
      landmarks[LandmarkIndex.LEFT_KNEE]
    );
    checks.push(backStraightResult.passed);
    if (!backStraightResult.passed) {
      feedback.push('背中を真っ直ぐに保ちましょう');
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

- `expo_app/services/evaluation/exercises/SquatEvaluator.ts` - スクワット評価ロジック

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（React Native/Expo）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → MediaPipe → 骨格座標取得（33関節点）
2. フロントエンド: スクワット評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

## 備考

- **推奨カメラ位置**: 横（side）から撮影すると精度が高い
- **左右対称**: 左右どちらの足でも検出できるようにする
- **フィードバックメッセージ**: 日本語でわかりやすく表示

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | コード実装完了（SquatEvaluator）、実機テスト待ち |
