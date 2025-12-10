# 017 アームカール評価ロジック

## 概要

アームカール種目のフォーム評価ロジックを実装するチケットです。肘の角度が最高点で30-50度になっているか、肘の位置が固定されているか（反動を使っていないか）の2つのチェックを行い、0-100点のスコアを算出します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **014**: フォーム評価エンジン

## 要件

### 機能要件

- FR-014: フォーム評価機能（アームカール）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [x] 肘の角度（30-50度）をチェックする`checkElbowAngle`関数を実装
- [x] 肘の位置固定（Y座標が肩と腰の中間）をチェックする`checkElbowFixed`関数を実装
- [x] アームカールの状態マシン（Down → Curling → Up → Lowering）を実装
- [x] レップカウンター（1レップの完了を検出）を実装
- [x] フレーム単位のスコア（0-100点）を計算
- [x] セッション終了時に総合スコアを計算
- [ ] 実機でアームカールを行い、正しくレップがカウントされることを確認
- [ ] スコアが妥当な値になることを確認（良いフォーム: 80-100点、悪いフォーム: 50点以下）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - アームカール評価基準

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    └── exercises/
        ├── ArmCurlEvaluator.ts         # アームカール評価ロジック
        └── ArmCurlStateMachine.ts      # アームカールの状態マシン
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
  const passed = angle >= 30 && angle <= 50;

  return { passed, angle };
}

/**
 * 肘の位置固定をチェック
 * @param elbow 肘の関節点
 * @param shoulder 肩の関節点
 * @param hip 腰の関節点
 * @returns チェック結果
 */
function checkElbowFixed(
  elbow: Landmark,
  shoulder: Landmark,
  hip: Landmark
): boolean {
  const midpoint = (shoulder.y + hip.y) / 2;
  const tolerance = 0.05;  // 5%の許容誤差

  return Math.abs(elbow.y - midpoint) <= tolerance;
}
```

### 状態マシン

```typescript
enum ArmCurlPhase {
  DOWN = 'down',
  CURLING = 'curling',
  UP = 'up',
  LOWERING = 'lowering'
}

class ArmCurlStateMachine extends BaseExerciseStateMachine<ArmCurlPhase> {
  constructor() {
    super(ArmCurlPhase.DOWN);
  }

  processFrame(landmarks: Landmark[]): void {
    const elbowAngle = this.calculateElbowAngle(landmarks);

    switch (this.currentPhase) {
      case ArmCurlPhase.DOWN:
        if (elbowAngle < 140) {
          this.currentPhase = ArmCurlPhase.CURLING;
        }
        break;

      case ArmCurlPhase.CURLING:
        if (elbowAngle <= 50) {
          this.currentPhase = ArmCurlPhase.UP;
        }
        break;

      case ArmCurlPhase.UP:
        if (elbowAngle > 50) {
          this.currentPhase = ArmCurlPhase.LOWERING;
        }
        break;

      case ArmCurlPhase.LOWERING:
        if (elbowAngle >= 160) {
          this.repCount++;
          this.currentPhase = ArmCurlPhase.DOWN;
        }
        break;
    }
  }
}
```

### アームカール評価器

```typescript
export class ArmCurlEvaluator {
  private stateMachine: ArmCurlStateMachine;
  private frameScores: number[] = [];

  constructor() {
    this.stateMachine = new ArmCurlStateMachine();
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
      feedback.push('肘をしっかり曲げましょう');
    }

    // チェック2: 肘の位置固定
    const elbowFixedResult = checkElbowFixed(
      landmarks[LandmarkIndex.LEFT_ELBOW],
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_HIP]
    );
    checks.push(elbowFixedResult);
    if (!elbowFixedResult) {
      feedback.push('肘を固定しましょう（反動を使わない）');
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

- `expo_app/services/evaluation/exercises/ArmCurlEvaluator.ts` - アームカール評価ロジック

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（React Native/Expo）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → MediaPipe → 骨格座標取得（33関節点）
2. フロントエンド: アームカール評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

## 備考

- **推奨カメラ位置**: 前（front）から撮影すると精度が高い
- **ダンベル必須**: ダンベルを持っていることを前提とした評価
- **左右対称**: 左右どちらの腕でも検出できるようにする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | コード実装完了（ArmCurlEvaluator）、実機テスト待ち |
