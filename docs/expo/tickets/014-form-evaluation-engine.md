# 014 フォーム評価エンジン

## 概要

骨格データ（33関節点）を入力として、角度計算、距離計算、状態マシン、スコアリングなどの共通機能を提供するフォーム評価エンジンを実装するチケットです。このエンジンが、5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）の評価ロジックの基盤になります。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **013**: 骨格検出基盤

## 要件

### 機能要件

- FR-014: フォーム評価機能（角度計算、スコアリング）
- FR-015: リアルタイムフィードバック

### 非機能要件

- NFR-025: 姿勢検出精度（信頼度閾値0.7推奨）
- NFR-026: ユーザビリティ（リアルタイムフィードバック）

## 受け入れ条件（Todo）

- [x] 3点から角度を計算する`calculateAngle`関数を実装
- [x] 2点間の距離を計算する`calculateDistance`関数を実装
- [x] 関節点の信頼度をチェックする`isLandmarkVisible`関数を実装
- [x] フレーム単位のスコアを計算する`calculateFrameScore`関数を実装
- [x] セッション全体のスコアを計算する`calculateOverallScore`関数を実装
- [x] 状態マシン（State Machine）の基底クラス`BaseExerciseStateMachine`を実装
- [x] レップカウンターの基底クラス`BaseRepCounter`を実装
- [x] ユニットテストを作成し、全てのヘルパー関数が正しく動作することを確認
- [x] 各関数にJSDocコメントを追加

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-014, FR-015
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-025, NFR-026
- `docs/common/specs/06_フォーム評価ロジック_v1_0.md` - 共通定義、角度計算、スコアリング
- `docs/expo/specs/01_技術スタック_v1_0.md` - フォーム評価アルゴリズム

## 技術詳細

### ファイル構成

```
services/
└── evaluation/
    ├── helpers.ts             # 角度・距離計算などのヘルパー関数
    ├── scoring.ts             # スコアリングロジック
    ├── BaseStateMachine.ts    # 状態マシンの基底クラス
    ├── BaseRepCounter.ts      # レップカウンターの基底クラス
    └── types.ts               # 評価関連の型定義
```

### ヘルパー関数（helpers.ts）

```typescript
/**
 * 3点から角度を計算（度数法）
 * @param pointA 始点
 * @param pointB 頂点（角度を測定する点）
 * @param pointC 終点
 * @returns 角度（0-180度）
 */
export function calculateAngle(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  pointC: { x: number; y: number }
): number {
  const radians =
    Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);

  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

/**
 * 2点間の距離を計算
 */
export function calculateDistance(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number }
): number {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
  );
}

/**
 * 関節点の信頼度をチェック
 */
export function isLandmarkVisible(
  landmark: { visibility: number },
  threshold: number = 0.5
): boolean {
  return landmark.visibility >= threshold;
}
```

### スコアリング（scoring.ts）

```typescript
/**
 * フレーム単位のスコア計算
 * @param checks 各チェック項目の結果（true = 正しい、false = 誤り）
 * @returns 0-100のスコア
 */
export function calculateFrameScore(checks: boolean[]): number {
  const passedChecks = checks.filter((check) => check).length;
  const totalChecks = checks.length;

  return Math.round((passedChecks / totalChecks) * 100);
}

/**
 * セッション全体のスコア計算
 * @param frameScores 各フレームのスコア配列
 * @returns 0-100の総合スコア
 */
export function calculateOverallScore(frameScores: number[]): number {
  if (frameScores.length === 0) return 0;

  const sum = frameScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / frameScores.length);
}
```

### 状態マシン基底クラス

```typescript
export abstract class BaseExerciseStateMachine<T extends string> {
  protected currentPhase: T;
  protected repCount: number = 0;

  constructor(initialPhase: T) {
    this.currentPhase = initialPhase;
  }

  abstract processFrame(landmarks: Landmark[]): void;

  getRepCount(): number {
    return this.repCount;
  }

  getCurrentPhase(): T {
    return this.currentPhase;
  }

  reset(): void {
    this.repCount = 0;
  }
}
```

### ユニットテストの例

```typescript
describe('calculateAngle', () => {
  it('直角（90度）を正しく計算する', () => {
    const pointA = { x: 0, y: 0 };
    const pointB = { x: 1, y: 0 };
    const pointC = { x: 1, y: 1 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(90, 1);
  });

  it('直線（180度）を正しく計算する', () => {
    const pointA = { x: 0, y: 0 };
    const pointB = { x: 1, y: 0 };
    const pointC = { x: 2, y: 0 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(180, 1);
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 実装完了

## 完了日

2025-12-11

## 実装ファイル

```
expo_app/services/evaluation/
├── types.ts                # 評価関連型定義
├── helpers.ts              # 角度・距離計算ヘルパー関数
├── scoring.ts              # スコアリングロジック
├── BaseStateMachine.ts     # 状態マシン基底クラス
├── BaseRepCounter.ts       # レップカウンター基底クラス
├── index.ts                # エクスポート
└── __tests__/
    ├── helpers.test.ts     # ヘルパー関数ユニットテスト
    └── scoring.test.ts     # スコアリングユニットテスト
```

## 実装アーキテクチャ

### フォーム評価ロジックの実行場所
- **実行場所**: フロントエンド（React Native/Expo）
- **理由**: プライバシー保護のため、カメラ映像と骨格検出はオンデバイスで完結
- **バックエンドの役割**: トレーニング結果（スコア・レップ数など）の保存のみ

### データフロー
1. フロントエンド: カメラ → MediaPipe → 骨格座標取得（33関節点）
2. フロントエンド: フォーム評価ロジック実行（TypeScript/JavaScript）
3. フロントエンド: スコア・フィードバックをリアルタイム表示
4. フロントエンド: セッション終了時に結果をCloud Functionsに送信
5. バックエンド: 結果をFirestoreに保存、BigQueryに匿名化データを送信

### 重要な設計原則
- **プライバシーファースト**: カメラ映像は絶対にサーバーに送信しない
- **リアルタイム処理**: 30fps（最低15fps）でフレーム単位の評価を実行
- **オフライン対応**: ネットワーク不要でトレーニング可能（結果保存時のみオンライン）

## 備考

- **単体テスト重視**: 角度計算などは正確性が重要なので、テストを充実させる
- **型安全性**: TypeScriptの型を活用し、コンパイル時にエラーを検出
- **パフォーマンス**: フレーム単位で実行されるため、ヘルパー関数は高速に動作する必要あり

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了 - ヘルパー関数、スコアリング、BaseStateMachine、BaseRepCounter、ユニットテスト完了 |
