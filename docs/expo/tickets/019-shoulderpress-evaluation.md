# 019 ショルダープレス評価ロジック

## 概要

ショルダープレス種目のフォーム評価ロジックを実装するチケットです。最高点で肘の角度が160-180度（ほぼ真っ直ぐ）になっているか、手首の高さが頭より上にあるかの2つのチェックを行い、0-100点のスコアを算出します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **014**: フォーム評価エンジン

## 要件

### 機能要件

- FR-014: フォーム評価機能（ショルダープレス）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [ ] 肘の角度（160-180度）をチェックする`checkElbowAngle`関数を実装
- [ ] 手首の高さ（頭より上）をチェックする`checkWristHeight`関数を実装
- [ ] ショルダープレスの状態マシン（Down → Pressing → Up → Lowering）を実装
- [ ] レップカウンター（1レップの完了を検出）を実装
- [ ] フレーム単位のスコア（0-100点）を計算
- [ ] セッション終了時に総合スコアを計算
- [ ] 実機でショルダープレスを行い、正しくレップがカウントされることを確認
- [ ] スコアが妥当な値になることを確認（良いフォーム: 80-100点、悪いフォーム: 50点以下）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - ショルダープレス評価基準

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    └── exercises/
        ├── ShoulderPressEvaluator.ts         # ショルダープレス評価ロジック
        └── ShoulderPressStateMachine.ts      # ショルダープレスの状態マシン
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
  const passed = angle >= 160 && angle <= 180;

  return { passed, angle };
}

/**
 * 手首の高さをチェック
 * @param nose 鼻の関節点
 * @param wrist 手首の関節点
 * @returns チェック結果
 */
function checkWristHeight(
  nose: Landmark,
  wrist: Landmark
): boolean {
  return wrist.y < nose.y;
}
```

### 状態マシン

```typescript
enum ShoulderPressPhase {
  DOWN = 'down',
  PRESSING = 'pressing',
  UP = 'up',
  LOWERING = 'lowering'
}

class ShoulderPressStateMachine extends BaseExerciseStateMachine<ShoulderPressPhase> {
  constructor() {
    super(ShoulderPressPhase.DOWN);
  }

  processFrame(landmarks: Landmark[]): void {
    const elbowAngle = this.calculateElbowAngle(landmarks);

    switch (this.currentPhase) {
      case ShoulderPressPhase.DOWN:
        if (elbowAngle < 120) {
          this.currentPhase = ShoulderPressPhase.PRESSING;
        }
        break;

      case ShoulderPressPhase.PRESSING:
        if (elbowAngle >= 160) {
          this.currentPhase = ShoulderPressPhase.UP;
        }
        break;

      case ShoulderPressPhase.UP:
        if (elbowAngle < 160) {
          this.currentPhase = ShoulderPressPhase.LOWERING;
        }
        break;

      case ShoulderPressPhase.LOWERING:
        if (elbowAngle <= 90) {
          this.repCount++;
          this.currentPhase = ShoulderPressPhase.DOWN;
        }
        break;
    }
  }
}
```

### ショルダープレス評価器

```typescript
export class ShoulderPressEvaluator {
  private stateMachine: ShoulderPressStateMachine;
  private frameScores: number[] = [];

  constructor() {
    this.stateMachine = new ShoulderPressStateMachine();
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
      feedback.push('肘をしっかり伸ばしましょう');
    }

    // チェック2: 手首の高さ
    const wristHeightResult = checkWristHeight(
      landmarks[LandmarkIndex.NOSE],
      landmarks[LandmarkIndex.LEFT_WRIST]
    );
    checks.push(wristHeightResult);
    if (!wristHeightResult) {
      feedback.push('手首を頭より高く上げましょう');
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

- [ ] 未着手

## 完了日

未定

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（React Native/Expo）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → MediaPipe → 骨格座標取得（33関節点）
2. フロントエンド: ショルダープレス評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

## 備考

- **推奨カメラ位置**: 前（front）から撮影すると精度が高い
- **ダンベル必須**: ダンベルを持っていることを前提とした評価
- **左右対称**: 左右どちらの腕でも検出できるようにする
- **腰の反り**: 将来的には腰の反りもチェック項目に追加予定（Phase 3）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
