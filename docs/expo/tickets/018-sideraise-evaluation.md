# 018 サイドレイズ評価ロジック

## 概要

サイドレイズ種目のフォーム評価ロジックを実装するチケットです。腕の挙上角度が70-90度（肩-肘が水平）になっているか、左右対称にできているかの2つのチェックを行い、0-100点のスコアを算出します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **014**: フォーム評価エンジン

## 要件

### 機能要件

- FR-014: フォーム評価機能（サイドレイズ）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [ ] 腕の挙上角度（肩-肘が水平）をチェックする`checkArmElevation`関数を実装
- [ ] 左右対称性（左右の肘の高さがほぼ同じ）をチェックする`checkSymmetry`関数を実装
- [ ] サイドレイズの状態マシン（Down → Raising → Up → Lowering）を実装
- [ ] レップカウンター（1レップの完了を検出）を実装
- [ ] フレーム単位のスコア（0-100点）を計算
- [ ] セッション終了時に総合スコアを計算
- [ ] 実機でサイドレイズを行い、正しくレップがカウントされることを確認
- [ ] スコアが妥当な値になることを確認（良いフォーム: 80-100点、悪いフォーム: 50点以下）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - サイドレイズ評価基準

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    └── exercises/
        ├── SideRaiseEvaluator.ts         # サイドレイズ評価ロジック
        └── SideRaiseStateMachine.ts      # サイドレイズの状態マシン
```

### チェック関数

```typescript
/**
 * 腕の挙上角度をチェック
 * @param shoulder 肩の関節点
 * @param elbow 肘の関節点
 * @returns チェック結果と差分
 */
function checkArmElevation(
  shoulder: Landmark,
  elbow: Landmark
): { passed: boolean; diff: number } {
  const diff = Math.abs(shoulder.y - elbow.y);
  const passed = diff <= 0.05;  // 5%の許容誤差

  return { passed, diff };
}

/**
 * 左右対称性をチェック
 * @param leftElbow 左肘の関節点
 * @param rightElbow 右肘の関節点
 * @returns チェック結果と差分
 */
function checkSymmetry(
  leftElbow: Landmark,
  rightElbow: Landmark
): { passed: boolean; diff: number } {
  const diff = Math.abs(leftElbow.y - rightElbow.y);
  const passed = diff <= 0.1;  // 10%の許容誤差

  return { passed, diff };
}
```

### 状態マシン

```typescript
enum SideRaisePhase {
  DOWN = 'down',
  RAISING = 'raising',
  UP = 'up',
  LOWERING = 'lowering'
}

class SideRaiseStateMachine extends BaseExerciseStateMachine<SideRaisePhase> {
  constructor() {
    super(SideRaisePhase.DOWN);
  }

  processFrame(landmarks: Landmark[]): void {
    const leftElbowY = landmarks[LandmarkIndex.LEFT_ELBOW].y;
    const leftShoulderY = landmarks[LandmarkIndex.LEFT_SHOULDER].y;

    switch (this.currentPhase) {
      case SideRaisePhase.DOWN:
        if (leftElbowY < leftShoulderY + 0.2) {
          this.currentPhase = SideRaisePhase.RAISING;
        }
        break;

      case SideRaisePhase.RAISING:
        if (Math.abs(leftElbowY - leftShoulderY) <= 0.05) {
          this.currentPhase = SideRaisePhase.UP;
        }
        break;

      case SideRaisePhase.UP:
        if (leftElbowY > leftShoulderY + 0.05) {
          this.currentPhase = SideRaisePhase.LOWERING;
        }
        break;

      case SideRaisePhase.LOWERING:
        if (leftElbowY > leftShoulderY + 0.3) {
          this.repCount++;
          this.currentPhase = SideRaisePhase.DOWN;
        }
        break;
    }
  }
}
```

### サイドレイズ評価器

```typescript
export class SideRaiseEvaluator {
  private stateMachine: SideRaiseStateMachine;
  private frameScores: number[] = [];

  constructor() {
    this.stateMachine = new SideRaiseStateMachine();
  }

  evaluateFrame(landmarks: Landmark[]): {
    score: number;
    repCount: number;
    feedback: string[];
  } {
    const checks: boolean[] = [];
    const feedback: string[] = [];

    // チェック1: 腕の挙上角度
    const armElevationResult = checkArmElevation(
      landmarks[LandmarkIndex.LEFT_SHOULDER],
      landmarks[LandmarkIndex.LEFT_ELBOW]
    );
    checks.push(armElevationResult.passed);
    if (!armElevationResult.passed) {
      feedback.push('肘を肩の高さまで上げましょう');
    }

    // チェック2: 左右対称性
    const symmetryResult = checkSymmetry(
      landmarks[LandmarkIndex.LEFT_ELBOW],
      landmarks[LandmarkIndex.RIGHT_ELBOW]
    );
    checks.push(symmetryResult.passed);
    if (!symmetryResult.passed) {
      feedback.push('左右対称に上げましょう');
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
2. フロントエンド: サイドレイズ評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

## 備考

- **推奨カメラ位置**: 前（front）から撮影すると精度が高い
- **ダンベル必須**: ダンベルを持っていることを前提とした評価
- **左右対称性**: 左右対称性のチェックは、初心者にとって重要なフィードバック

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
