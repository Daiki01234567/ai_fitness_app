# 024 スクワット評価ロジック

## 概要

スクワット（しゃがむ運動）のフォームを評価するロジックを実装します。膝の角度、膝の位置、背中の姿勢をチェックして、正しいフォームでトレーニングできているかを判定します。

## Phase

Phase 2（機能実装）

## 依存チケット

- 023: フォーム評価エンジン

## 要件

### 機能要件

1. **膝の角度チェック**
   - 目標角度: 90度〜110度
   - 深すぎる（90度未満）場合は警告
   - 浅すぎる（110度超）場合は警告

2. **膝の位置チェック**
   - 膝がつま先より前に出ていないか確認
   - 出すぎている場合は警告

3. **背中の角度チェック**
   - 背中がまっすぐかどうか確認
   - 丸まっている場合は警告

4. **レップカウント**
   - 立っている状態（膝角度160度以上）→ しゃがんだ状態（膝角度110度以下）→ 立っている状態で1回

5. **スコアリング**
   - 膝の角度: 40点
   - 膝の位置: 30点
   - 背中の姿勢: 20点
   - かかと接地: 10点

### 非機能要件

- 横向きカメラでの検出に最適化
- 左右どちらの向きでも対応

## 受け入れ条件

- [ ] 膝の角度が正しく計算される
- [ ] 膝の位置（つま先との比較）が正しく判定される
- [ ] 背中の角度が正しく計算される
- [ ] レップが正確にカウントされる
- [ ] 0-100点のスコアが計算される
- [ ] フィードバックメッセージが適切に表示される

## 参照ドキュメント

| ドキュメント | パス | 該当セクション |
|-------------|------|----------------|
| 要件定義書 Part 4 | `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` | 2.2.1 スクワット |

## 技術詳細

### 使用する関節

```
横向きで見た場合:

     [0] 鼻
        |
   [11/12] 肩
        |
   [23/24] 腰
        |
   [25/26] 膝  ←膝の角度
        |
   [27/28] 足首
        |
   [31/32] つま先
```

| 関節名 | インデックス（左） | インデックス（右） |
|--------|-------------------|-------------------|
| 肩 | 11 | 12 |
| 腰 | 23 | 24 |
| 膝 | 25 | 26 |
| 足首 | 27 | 28 |
| つま先 | 31 | 32 |

### 実装コード

```typescript
// exercises/squat.ts
import { ExerciseEvaluator, EvaluationCriteria } from '../core/Evaluator';
import { ExerciseStateMachine, StateTransition } from '../core/StateMachine';
import { calculateAngle, calculateSlope } from '../utils/angle';
import { calculateRangeScore } from '../utils/scoring';
import { PoseData } from '../../pose-detection/types/pose';
import { PoseLandmark } from '../../pose-detection/types/landmark';

export class SquatEvaluator extends ExerciseEvaluator {
  // 定数
  private static readonly KNEE_ANGLE_OPTIMAL = 100;  // 最適な膝角度
  private static readonly KNEE_ANGLE_TOLERANCE = 10; // 許容範囲
  private static readonly STANDING_ANGLE = 160;      // 立っている状態の膝角度
  private static readonly SQUAT_ANGLE = 110;         // しゃがんだ状態の膝角度

  protected createStateMachine(): ExerciseStateMachine {
    const transitions: StateTransition[] = [
      // 待機 → 準備完了（立っている状態を検出）
      {
        from: 'idle',
        to: 'ready',
        condition: (data) => this.getKneeAngle(data) >= SquatEvaluator.STANDING_ANGLE,
      },
      // 準備完了 → 下降中
      {
        from: 'ready',
        to: 'down',
        condition: (data) => this.getKneeAngle(data) < SquatEvaluator.STANDING_ANGLE,
      },
      // 下降中 → 最下点
      {
        from: 'down',
        to: 'bottom',
        condition: (data) => this.getKneeAngle(data) <= SquatEvaluator.SQUAT_ANGLE,
      },
      // 最下点 → 上昇中
      {
        from: 'bottom',
        to: 'up',
        condition: (data) => this.getKneeAngle(data) > SquatEvaluator.SQUAT_ANGLE,
      },
      // 上昇中 → 準備完了（1レップ完了）
      {
        from: 'up',
        to: 'ready',
        condition: (data) => this.getKneeAngle(data) >= SquatEvaluator.STANDING_ANGLE,
      },
    ];

    return new ExerciseStateMachine(transitions);
  }

  /**
   * 膝の角度を取得（左右で見えている方を使用）
   */
  private getKneeAngle(data: PoseData): number {
    const leftAngle = this.calculateKneeAngle(data, 'left');
    const rightAngle = this.calculateKneeAngle(data, 'right');

    // 両方見えている場合は平均、片方だけならその値
    if (!isNaN(leftAngle) && !isNaN(rightAngle)) {
      return (leftAngle + rightAngle) / 2;
    }
    return isNaN(leftAngle) ? rightAngle : leftAngle;
  }

  /**
   * 片側の膝角度を計算
   */
  private calculateKneeAngle(data: PoseData, side: 'left' | 'right'): number {
    const hip = data.landmarks[side === 'left' ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP];
    const knee = data.landmarks[side === 'left' ? PoseLandmark.LEFT_KNEE : PoseLandmark.RIGHT_KNEE];
    const ankle = data.landmarks[side === 'left' ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE];

    return calculateAngle(hip, knee, ankle);
  }

  protected evaluateForm(data: PoseData): EvaluationCriteria[] {
    const criteria: EvaluationCriteria[] = [];

    // 1. 膝の角度評価（40点）
    const kneeAngle = this.getKneeAngle(data);
    const kneeScore = calculateRangeScore(
      kneeAngle,
      SquatEvaluator.KNEE_ANGLE_OPTIMAL,
      SquatEvaluator.KNEE_ANGLE_TOLERANCE
    );

    criteria.push({
      name: '膝の角度',
      weight: 40,
      score: kneeScore,
      feedback: kneeScore < 70
        ? (kneeAngle < 90 ? '参考: 少し深くしゃがみすぎかもしれません' : '参考: もう少し深くしゃがんでみましょう')
        : undefined,
    });

    // 2. 膝の位置評価（30点）
    const kneePositionScore = this.evaluateKneePosition(data);
    criteria.push({
      name: '膝の位置',
      weight: 30,
      score: kneePositionScore.score,
      feedback: kneePositionScore.feedback,
    });

    // 3. 背中の姿勢評価（20点）
    const backScore = this.evaluateBackPosture(data);
    criteria.push({
      name: '背中の姿勢',
      weight: 20,
      score: backScore.score,
      feedback: backScore.feedback,
    });

    // 4. かかと接地評価（10点）
    // Note: MediaPipeではかかとの浮きは直接検出しにくいため、簡易評価
    criteria.push({
      name: 'かかと',
      weight: 10,
      score: 100, // 実装が難しいため暫定で満点
    });

    return criteria;
  }

  /**
   * 膝の位置を評価（つま先より前に出ていないか）
   */
  private evaluateKneePosition(data: PoseData): { score: number; feedback?: string } {
    // 左右の膝とつま先の位置を比較
    const leftKnee = data.landmarks[PoseLandmark.LEFT_KNEE];
    const leftToe = data.landmarks[PoseLandmark.LEFT_FOOT_INDEX];
    const rightKnee = data.landmarks[PoseLandmark.RIGHT_KNEE];
    const rightToe = data.landmarks[PoseLandmark.RIGHT_FOOT_INDEX];

    // x座標で比較（横向きカメラの場合）
    const leftDiff = leftKnee.x - leftToe.x;
    const rightDiff = rightKnee.x - rightToe.x;

    // 膝がつま先より前に出ている量を計算
    const maxDiff = Math.max(Math.abs(leftDiff), Math.abs(rightDiff));

    if (maxDiff < 0.02) { // 許容範囲内
      return { score: 100 };
    } else if (maxDiff < 0.05) {
      return { score: 70, feedback: '参考: 膝がつま先より少し前に出ています' };
    } else {
      return { score: 40, feedback: '参考: 膝がつま先より前に出すぎています' };
    }
  }

  /**
   * 背中の姿勢を評価
   */
  private evaluateBackPosture(data: PoseData): { score: number; feedback?: string } {
    // 肩と腰の傾きを計算
    const leftShoulder = data.landmarks[PoseLandmark.LEFT_SHOULDER];
    const leftHip = data.landmarks[PoseLandmark.LEFT_HIP];
    const rightShoulder = data.landmarks[PoseLandmark.RIGHT_SHOULDER];
    const rightHip = data.landmarks[PoseLandmark.RIGHT_HIP];

    // 背中の傾きを計算（理想は垂直に近い）
    const leftSlope = calculateSlope(leftHip, leftShoulder);
    const rightSlope = calculateSlope(rightHip, rightShoulder);
    const avgSlope = (Math.abs(leftSlope) + Math.abs(rightSlope)) / 2;

    // 垂直（90度または-90度）からの差
    const deviation = Math.abs(90 - avgSlope);

    if (deviation < 20) {
      return { score: 100 };
    } else if (deviation < 35) {
      return { score: 70, feedback: '参考: 背中が少し丸まっているかもしれません' };
    } else {
      return { score: 40, feedback: '参考: 背中をまっすぐにしてみましょう' };
    }
  }
}
```

### 状態遷移図

```
[idle] 待機
   ↓ 膝角度 >= 160度
[ready] 準備完了（立っている）
   ↓ 膝角度 < 160度
[down] 下降中
   ↓ 膝角度 <= 110度
[bottom] 最下点（しゃがんでいる）
   ↓ 膝角度 > 110度
[up] 上昇中
   ↓ 膝角度 >= 160度
[ready] 準備完了 ← 1レップ完了！
```

### スコアリング配点

| 評価項目 | 配点 | 説明 |
|----------|------|------|
| 膝の角度 | 40点 | 90-110度が理想 |
| 膝の位置 | 30点 | つま先より前に出ない |
| 背中の姿勢 | 20点 | まっすぐを維持 |
| かかと接地 | 10点 | かかとが浮かない |

## 注意事項

1. **カメラの向き**
   - 横向き推奨（体の側面が見える）
   - 左向き/右向きどちらでも対応

2. **膝の角度計算**
   - 腰-膝-足首の3点で計算
   - 左右の平均を使用

3. **フィードバック**
   - すべて「参考:」で始める（薬機法対応）
   - 否定的すぎない表現を使用

4. **精度の限界**
   - かかとの接地は直接検出が難しい
   - 深度情報（z座標）の精度は低い

## 見積もり

| 作業内容 | 見積もり時間 |
|----------|--------------|
| 状態マシン実装 | 3時間 |
| 膝角度評価実装 | 2時間 |
| 膝位置評価実装 | 2時間 |
| 背中姿勢評価実装 | 2時間 |
| フィードバックメッセージ作成 | 1時間 |
| 単体テスト | 3時間 |
| 統合テスト | 2時間 |
| **合計** | **15時間** |

## 進捗

### ステータス: 未着手

### Todo

- [ ] SquatEvaluatorクラス作成
- [ ] createStateMachine実装
- [ ] getKneeAngle実装
- [ ] evaluateKneePosition実装
- [ ] evaluateBackPosture実装
- [ ] フィードバックメッセージ定義
- [ ] 単体テスト作成
- [ ] 実機での動作確認
- [ ] パラメータ調整

### 作業ログ

| 日付 | 作業内容 | 担当者 |
|------|----------|--------|
| - | - | - |

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| 1.0 | 2025年12月9日 | 初版作成 |
