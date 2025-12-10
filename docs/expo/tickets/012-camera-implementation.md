# 012 カメラ機能実装

## 概要

react-native-vision-cameraを使用して、カメラプレビュー、権限管理、フロント/リアカメラ切り替え機能を実装するチケットです。MediaPipe統合の基盤となるカメラ機能を完成させます。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **011**: MediaPipe PoC（技術検証）

## 要件

### 機能要件

- FR-012: カメラ映像のリアルタイム処理
- FR-013: 姿勢検出機能の基盤

### 非機能要件

- NFR-007: データ最小化（動画保存せず、フレームのみ処理）
- NFR-024: FPS要件（30fps目標）
- NFR-026: ユーザビリティ（直感的な操作）

## 受け入れ条件（Todo）

- [x] カメラ権限をリクエストする機能を実装
- [x] 権限が拒否された場合、設定画面へ誘導する機能を実装
- [x] カメラプレビューを全画面で表示する機能を実装
- [x] フロント/リアカメラを切り替えるボタンを実装
- [x] カメラプレビューの向き（縦/横）に対応
- [x] フレームプロセッサ（Frame Processor）を設定し、フレームを取得できることを確認
- [x] カメラエラーハンドリング（カメラが使用できない場合のエラー表示）
- [ ] iOSとAndroidの両方で動作することを確認（実機テスト未実施）
- [x] カメラコンポーネントを作成し、再利用可能にする

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-013
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-007, NFR-024, NFR-026
- `docs/expo/specs/01_技術スタック_v1_0.md` - react-native-vision-camera
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - トレーニング実行画面

## 技術詳細

### コンポーネント配置

```
components/
└── training/
    └── CameraView.tsx     # カメラプレビューコンポーネント
```

### カメラ権限の確認

```typescript
import { Camera } from 'react-native-vision-camera';

async function requestCameraPermission(): Promise<boolean> {
  const permission = await Camera.requestCameraPermission();

  if (permission === 'denied') {
    // 設定画面へ誘導
    Alert.alert(
      'カメラ権限が必要です',
      'トレーニング機能を使用するには、カメラへのアクセスを許可してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return permission === 'granted';
}
```

### カメラプレビューの実装

```typescript
import { Camera, useCameraDevice } from 'react-native-vision-camera';

export function CameraView() {
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);

  if (!device) {
    return <Text>カメラが利用できません</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={processFrame}
      />
      <Button
        title="カメラ切り替え"
        onPress={() => setCameraPosition(cameraPosition === 'front' ? 'back' : 'front')}
      />
    </View>
  );
}
```

### フレームプロセッサ

```typescript
import { useFrameProcessor } from 'react-native-vision-camera';

const processFrame = useFrameProcessor((frame) => {
  'worklet';

  // フレーム情報をログ出力（後でMediaPipeに渡す）
  console.log(`Frame: ${frame.width}x${frame.height}`);
}, []);
```

## フレームスキップ制御

### アルゴリズム概要

フレームスキップ制御により、デバイスの処理能力に応じて動的にFPSを調整し、安定したパフォーマンスを実現します。

#### 基本アルゴリズム

```typescript
/**
 * フレームスキップ制御クラス
 * デバイスの処理能力に応じて動的にFPSを調整
 */
class FrameSkipController {
  private lastProcessedTime: number = 0;
  private targetInterval: number = 1000 / 30; // 30fps = 33.3ms間隔
  private consecutiveSkips: number = 0;
  private readonly MAX_CONSECUTIVE_SKIPS = 3;

  /**
   * フレームを処理すべきかどうかを判定
   * @param currentTime 現在のタイムスタンプ（ミリ秒）
   * @returns true: 処理する、false: スキップする
   */
  shouldProcessFrame(currentTime: number): boolean {
    const elapsed = currentTime - this.lastProcessedTime;

    // 目標インターバルを超えた場合、または連続スキップが上限に達した場合
    if (elapsed >= this.targetInterval || this.consecutiveSkips >= this.MAX_CONSECUTIVE_SKIPS) {
      this.lastProcessedTime = currentTime;
      this.consecutiveSkips = 0;
      return true;
    }

    // スキップ
    this.consecutiveSkips++;
    return false;
  }

  /**
   * 動的FPS調整
   * MediaPipe処理時間に応じてターゲットFPSを調整
   * @param processingTime MediaPipe処理にかかった時間（ミリ秒）
   */
  adjustTargetFPS(processingTime: number): void {
    if (processingTime > 50) {
      // 処理が重い場合は15fpsに落とす
      this.targetInterval = 1000 / 15; // 66.7ms
      console.log('[FrameSkip] FPS調整: 15fps（処理時間: ${processingTime}ms）');
    } else if (processingTime > 33) {
      // やや重い場合は24fpsに
      this.targetInterval = 1000 / 24; // 41.7ms
      console.log('[FrameSkip] FPS調整: 24fps（処理時間: ${processingTime}ms）');
    } else {
      // 正常時は30fps
      this.targetInterval = 1000 / 30; // 33.3ms
    }
  }

  /**
   * スキップ率の取得（デバッグ用）
   */
  getSkipRate(): number {
    // 実装は省略（フレーム総数とスキップ数から計算）
    return 0;
  }
}
```

#### 使用例

```typescript
const frameSkipController = new FrameSkipController();

const processFrame = useFrameProcessor((frame) => {
  'worklet';

  const currentTime = Date.now();

  // フレームをスキップすべきかチェック
  if (!frameSkipController.shouldProcessFrame(currentTime)) {
    return; // このフレームはスキップ
  }

  // MediaPipe処理（時間計測）
  const startTime = performance.now();
  const poseResult = detectPose(frame);
  const processingTime = performance.now() - startTime;

  // 処理時間に応じてFPSを動的調整
  frameSkipController.adjustTargetFPS(processingTime);

  // 結果をストアに保存
  updatePoseStore(poseResult);
}, []);
```

### 実装上の注意点

1. **フレームドロップ時のUI更新**
   - フレームをスキップしても、UI（カメラプレビュー、FPS表示など）は継続して更新すること
   - ユーザーにはカメラが停止しているように見えないようにする

2. **連続フレームスキップの制限**
   - 最大3フレーム連続スキップまで（約100ms）
   - それ以上スキップすると、フォーム評価の精度が低下する
   - 3フレームスキップ後は、必ず次のフレームを処理する

3. **スキップ率のログ記録**
   - 品質監視のため、スキップ率をログに記録
   - 1分ごとに集計し、以下の情報を記録:
     ```typescript
     interface FrameSkipMetrics {
       totalFrames: number;        // 総フレーム数
       skippedFrames: number;      // スキップしたフレーム数
       skipRate: number;           // スキップ率（0.0 - 1.0）
       averageFPS: number;         // 平均FPS
       currentTargetFPS: number;   // 現在のターゲットFPS
       deviceModel: string;        // デバイスモデル
       timestamp: number;          // タイムスタンプ
     }
     ```

4. **パフォーマンスモニタリング**
   - FPS低下の原因を特定するため、以下を記録:
     - MediaPipe処理時間
     - フレーム解像度
     - メモリ使用量
     - CPU使用率（可能な場合）

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 実装完了（実機テスト未実施）

## 完了日

2025-12-11（実機テスト除く）

## 実装ファイル

```
expo_app/components/training/
├── CameraView.tsx              # 再利用可能なカメラコンポーネント
├── CameraPermissionView.tsx    # カメラ権限リクエスト画面
├── FrameSkipController.ts      # フレームスキップ制御
├── hooks/
│   └── useCamera.ts            # カメラ関連カスタムフック
└── index.ts                    # エクスポート
```

## 備考

- **Expo Goでは動作しない**: Development Buildが必須
- **権限管理**: iOSはInfo.plist、AndroidはAndroidManifest.xmlに権限を追加する必要あり
- **パフォーマンス**: フレームプロセッサは軽量に保つこと（重い処理はワーカースレッドで実行）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | コード実装完了 - CameraView、CameraPermissionView、useCamera hook、FrameSkipController実装（実機テスト待ち） |
