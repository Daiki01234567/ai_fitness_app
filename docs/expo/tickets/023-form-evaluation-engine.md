# 023 フォーム評価エンジン

## 概要

骨格検出データを使って、トレーニングフォームを評価するためのエンジン（基盤）を実装します。角度計算、スコアリング、レップカウント（回数計測）の共通機能を提供します。

## Phase

Phase 2（機能実装）

## 依存チケット

- 022: 骨格検出基盤

## 要件

### 機能要件

1. **角度計算ユーティリティ**
   - 3点の関節から角度を計算（例: 肩-肘-手首で肘の角度）
   - 2点の関節から傾きを計算（例: 左肩-右肩の傾き）
   - ラジアン/度の変換

2. **スコアリング基盤**
   - 0-100点のスコア計算
   - 複数の評価項目を重み付けして合計
   - フレームごとのスコアと平均スコア

3. **状態マシン（レップカウント）**
   - トレーニングの状態を管理（待機/開始/上昇/下降/完了）
   - 正確な回数カウント
   - 種目ごとに異なる状態遷移をサポート

4. **評価インターフェース**
   - 各種目が実装する共通インターフェース
   - 新しい種目の追加が容易な設計

### 非機能要件

- 計算処理は1ms以下で完了
- メモリ効率の良い実装
- TypeScript型安全

## 受け入れ条件

- [ ] 3点から角度を計算できる
- [ ] 2点から傾きを計算できる
- [ ] 0-100点のスコアを計算できる
- [ ] レップカウント用の状態マシンが動作する
- [ ] 共通インターフェースが定義されている
- [ ] 単体テストが作成されている

## 参照ドキュメント

| ドキュメント | パス | 該当セクション |
|-------------|------|----------------|
| 要件定義書 Part 4 | `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` | 2.2 5種目の評価ポイント、2.3 スコアリング基準 |

## 技術詳細

### ディレクトリ構成

```
src/
├── features/
│   └── form-evaluation/
│       ├── types/
│       │   ├── evaluation.ts     # 評価結果の型
│       │   └── state-machine.ts  # 状態マシンの型
│       ├── utils/
│       │   ├── angle.ts          # 角度計算
│       │   └── scoring.ts        # スコア計算
│       ├── core/
│       │   ├── StateMachine.ts   # 状態マシン
│       │   └── Evaluator.ts      # 評価基底クラス
│       ├── exercises/
│       │   ├── index.ts          # 種目エクスポート
│       │   ├── squat.ts          # 024で実装
│       │   ├── pushup.ts         # 025で実装
│       │   ├── armcurl.ts        # 026で実装
│       │   ├── sideraise.ts      # 027で実装
│       │   └── shoulderpress.ts  # 028で実装
│       └── index.ts
```

### 角度計算ユーティリティ

```typescript
// angle.ts
import { Landmark } from '../pose-detection/types/landmark';

/**
 * 3点から角度を計算する（度）
 * @param a 点A（例: 肩）
 * @param b 点B（角度を求める点、例: 肘）
 * @param c 点C（例: 手首）
 * @returns 角度（0-180度）
 */
export const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180 / Math.PI));

  if (angle > 180) {
    angle = 360 - angle;
  }

  return angle;
};

/**
 * 2点の傾き角度を計算する（度）
 * @param a 点A
 * @param b 点B
 * @returns 角度（-90から90度、水平が0度）
 */
export const calculateSlope = (a: Landmark, b: Landmark): number => {
  const radians = Math.atan2(b.y - a.y, b.x - a.x);
  return radians * (180 / Math.PI);
};

/**
 * 2点間の距離を計算する
 */
export const calculateDistance = (a: Landmark, b: Landmark): number => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};
```

### スコアリング基盤

```typescript
// scoring.ts

/**
 * 評価項目
 */
export interface EvaluationCriteria {
  name: string;           // 項目名（例: "膝の角度"）
  weight: number;         // 重み（合計100）
  score: number;          // このフレームのスコア（0-100）
  feedback?: string;      // フィードバックメッセージ
}

/**
 * フレームスコアを計算する
 * @param criteria 評価項目の配列
 * @returns 加重平均スコア（0-100）
 */
export const calculateFrameScore = (criteria: EvaluationCriteria[]): number => {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = criteria.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(weightedSum / totalWeight);
};

/**
 * 範囲内のスコアを計算する
 * @param value 実際の値
 * @param optimal 最適な値
 * @param tolerance 許容範囲
 * @returns スコア（0-100）
 */
export const calculateRangeScore = (
  value: number,
  optimal: number,
  tolerance: number
): number => {
  const diff = Math.abs(value - optimal);

  if (diff <= tolerance) {
    return 100;
  } else if (diff <= tolerance * 2) {
    return 70;
  } else if (diff <= tolerance * 3) {
    return 40;
  }
  return 0;
};
```

### 状態マシン

```typescript
// StateMachine.ts

/**
 * トレーニング状態
 */
export type ExerciseState =
  | 'idle'      // 待機中
  | 'ready'     // 開始位置
  | 'down'      // 下降中（スクワット等）または曲げ中（アームカール等）
  | 'bottom'    // 最下点
  | 'up'        // 上昇中
  | 'top';      // 最上点

/**
 * 状態遷移の条件
 */
export interface StateTransition {
  from: ExerciseState;
  to: ExerciseState;
  condition: (data: PoseData) => boolean;
}

/**
 * 状態マシンクラス
 */
export class ExerciseStateMachine {
  private state: ExerciseState = 'idle';
  private transitions: StateTransition[];
  private repCount: number = 0;
  private onRepComplete?: () => void;

  constructor(transitions: StateTransition[], onRepComplete?: () => void) {
    this.transitions = transitions;
    this.onRepComplete = onRepComplete;
  }

  /**
   * フレームデータを処理して状態を更新
   */
  public process(data: PoseData): void {
    for (const transition of this.transitions) {
      if (this.state === transition.from && transition.condition(data)) {
        this.state = transition.to;

        // 1レップ完了の判定
        if (this.isRepComplete()) {
          this.repCount++;
          this.onRepComplete?.();
        }
        break;
      }
    }
  }

  /**
   * 1レップ完了かどうか（種目によって異なる）
   */
  protected isRepComplete(): boolean {
    // デフォルト: top -> ready に戻ったら1レップ
    return this.state === 'ready';
  }

  public getState(): ExerciseState { return this.state; }
  public getRepCount(): number { return this.repCount; }
  public reset(): void {
    this.state = 'idle';
    this.repCount = 0;
  }
}
```

### 評価インターフェース

```typescript
// Evaluator.ts

/**
 * 評価結果
 */
export interface EvaluationResult {
  score: number;                    // 総合スコア（0-100）
  criteria: EvaluationCriteria[];   // 各項目の評価
  feedback: string[];               // フィードバックメッセージ
  repCount: number;                 // レップ数
  state: ExerciseState;             // 現在の状態
}

/**
 * 種目評価の基底クラス
 */
export abstract class ExerciseEvaluator {
  protected stateMachine: ExerciseStateMachine;
  protected scores: number[] = [];

  constructor() {
    this.stateMachine = this.createStateMachine();
  }

  /**
   * 状態マシンを作成（種目ごとに実装）
   */
  protected abstract createStateMachine(): ExerciseStateMachine;

  /**
   * フォームを評価（種目ごとに実装）
   */
  protected abstract evaluateForm(data: PoseData): EvaluationCriteria[];

  /**
   * フレームを処理して評価結果を返す
   */
  public process(data: PoseData): EvaluationResult {
    // 状態マシンを更新
    this.stateMachine.process(data);

    // フォームを評価
    const criteria = this.evaluateForm(data);
    const score = calculateFrameScore(criteria);
    this.scores.push(score);

    // フィードバックを生成
    const feedback = criteria
      .filter(c => c.feedback && c.score < 70)
      .map(c => c.feedback!);

    return {
      score,
      criteria,
      feedback,
      repCount: this.stateMachine.getRepCount(),
      state: this.stateMachine.getState(),
    };
  }

  /**
   * 平均スコアを取得
   */
  public getAverageScore(): number {
    if (this.scores.length === 0) return 0;
    return Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length);
  }

  /**
   * リセット
   */
  public reset(): void {
    this.stateMachine.reset();
    this.scores = [];
  }
}
```

## 注意事項

1. **計算精度**
   - 浮動小数点の誤差に注意
   - 角度は整数に丸める

2. **パフォーマンス**
   - 毎フレーム呼ばれるため、重い処理は避ける
   - オブジェクト生成を最小限に

3. **拡張性**
   - 新しい種目を追加しやすい設計
   - 評価項目を変更しやすい設計

4. **テスト容易性**
   - 純粋関数で実装
   - モックデータでテスト可能

## 見積もり

| 作業内容 | 見積もり時間 |
|----------|--------------|
| 型定義作成 | 2時間 |
| 角度計算ユーティリティ | 4時間 |
| スコアリング基盤 | 4時間 |
| 状態マシン実装 | 6時間 |
| Evaluator基底クラス | 4時間 |
| 単体テスト作成 | 4時間 |
| **合計** | **24時間** |

## 進捗

### ステータス: 未着手

### Todo

- [ ] 型定義ファイル作成
- [ ] calculateAngle関数実装
- [ ] calculateSlope関数実装
- [ ] calculateDistance関数実装
- [ ] EvaluationCriteria型定義
- [ ] calculateFrameScore関数実装
- [ ] calculateRangeScore関数実装
- [ ] ExerciseStateMachineクラス実装
- [ ] ExerciseEvaluator基底クラス実装
- [ ] 単体テスト（角度計算）
- [ ] 単体テスト（スコアリング）
- [ ] 単体テスト（状態マシン）

### 作業ログ

| 日付 | 作業内容 | 担当者 |
|------|----------|--------|
| - | - | - |

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| 1.0 | 2025年12月9日 | 初版作成 |
