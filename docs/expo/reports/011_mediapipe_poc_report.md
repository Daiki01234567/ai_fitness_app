# MediaPipe PoC 技術検証レポート

**チケット**: 011 MediaPipe PoC（技術検証）
**作成日**: 2025年12月10日
**ステータス**: 実装完了、実機テスト待ち

---

## 1. 検証概要

### 1.1 目的

Expo/React NativeでMediaPipe Poseによる姿勢検出が動作するかを技術検証する。

### 1.2 検証項目

| 項目 | 目標 | 検証方法 |
|------|------|---------|
| カメラプレビュー | 表示される | `/training/camera-test`で確認 |
| 33関節点検出 | 全て検出可能 | `/training/pose-detection-test`で確認 |
| FPS | 30fps（最低15fps） | リアルタイムFPS表示 |
| 信頼度フィルタリング | 0.5以上 | コンソールログで確認 |
| 推論時間 | 33ms以下 | パフォーマンスメトリクス表示 |

---

## 2. 実装内容

### 2.1 使用ライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| react-native-vision-camera | ^4.7.3 | カメラフレーム取得 |
| react-native-mediapipe | ^0.6.0 | MediaPipe Pose統合 |
| react-native-worklets-core | ^1.6.2 | フレーム処理高速化 |
| expo-dev-client | ~6.0.20 | Development Build |

### 2.2 作成ファイル

#### 型定義

```
expo_app/types/mediapipe.ts
- LandmarkIndex enum（33関節点）
- LANDMARK_NAMES マッピング
- Landmark, PoseDetectionResult インターフェース
- PoseDetectionConfig 設定型
- 運動種目別 LANDMARK_GROUPS
```

#### ユーティリティ

```
expo_app/lib/pose/
├── calculateAngle.ts      # 角度計算（2D/3D）
├── calculateDistance.ts   # 距離計算、対称性チェック
├── filterLandmarks.ts     # 信頼度フィルタリング
├── measureFps.ts          # FPS計測
└── index.ts               # エクスポート
```

#### テスト画面

```
expo_app/app/training/
├── _layout.tsx            # スタックレイアウト
├── camera-test.tsx        # カメラプレビューテスト
└── pose-detection-test.tsx # 姿勢検出テスト
```

### 2.3 設定変更

#### app.json

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "トレーニング中のフォームをチェックするためにカメラを使用します"
      }
    },
    "android": {
      "permissions": ["android.permission.CAMERA"]
    },
    "plugins": [
      "expo-router",
      [
        "react-native-vision-camera",
        {
          "cameraPermissionText": "トレーニング中のフォームをチェックするためにカメラを使用します"
        }
      ]
    ]
  }
}
```

---

## 3. 技術仕様

### 3.1 MediaPipe Pose出力

```typescript
interface Landmark {
  x: number;        // 0.0 - 1.0（正規化X座標）
  y: number;        // 0.0 - 1.0（正規化Y座標）
  z: number;        // 深度（腰中心を0とする相対値）
  visibility: number; // 0.0 - 1.0（信頼度）
}

interface PoseDetectionResult {
  landmarks: Landmark[];  // 33個の関節点
  timestamp: number;      // フレームタイムスタンプ
}
```

### 3.2 33関節点インデックス

```
顔（0-10）:
  0: nose, 1-2: left/right eye inner, 3-4: left/right eye,
  5-6: left/right eye outer, 7-8: left/right ear, 9-10: left/right mouth

上半身（11-22）:
  11-12: left/right shoulder, 13-14: left/right elbow,
  15-16: left/right wrist, 17-18: left/right pinky,
  19-20: left/right index, 21-22: left/right thumb

下半身（23-32）:
  23-24: left/right hip, 25-26: left/right knee,
  27-28: left/right ankle, 29-30: left/right heel,
  31-32: left/right foot index
```

### 3.3 運動種目別必要ランドマーク

| 種目 | 必要ランドマーク |
|------|-----------------|
| スクワット | 肩、腰、膝、足首 |
| プッシュアップ | 肩、肘、手首、腰、足首 |
| アームカール | 肩、肘、手首、腰 |
| サイドレイズ | 肩、肘、手首 |
| ショルダープレス | 鼻、肩、肘、手首 |

### 3.4 角度計算アルゴリズム

```typescript
// 2D角度計算（度数法）
function calculateAngle2D(
  pointA: Point2D,
  pointB: Point2D,  // 頂点
  pointC: Point2D
): number {
  const radians =
    Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);

  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;

  return angle;
}
```

---

## 4. パフォーマンス要件

### 4.1 FPS要件

| デバイスクラス | 目標FPS | 最低FPS |
|--------------|---------|---------|
| 高スペック | 30fps | 24fps |
| 中スペック | 24fps | 18fps |
| 低スペック | 15fps | 15fps |

### 4.2 推論時間要件

| 指標 | 目標値 | 警告値 |
|------|--------|--------|
| 平均推論時間 | 33ms以下 | 50ms以上 |
| 最大推論時間 | 50ms以下 | 100ms以上 |

### 4.3 信頼度閾値

| 用途 | 推奨値 | 最低値 |
|------|--------|--------|
| 通常検出 | 0.7 | 0.5 |
| 低照度環境 | 0.5 | 0.3 |

---

## 5. 成功条件

### 5.1 必須条件（チケット完了要件）

- [ ] カメラプレビューが表示される
- [ ] 33関節点が検出される
- [ ] 信頼度0.5以上の関節点がフィルタリングできる
- [ ] FPS 15fps以上を達成
- [ ] 検出結果がログ出力される

### 5.2 推奨条件

- [ ] FPS 30fpsを達成
- [ ] 推論時間33ms以下
- [ ] iOS/Android両方で動作

---

## 6. 制約事項

### 6.1 技術的制約

1. **Development Build必須**
   - Expo Goでは動作しない
   - ネイティブコードのビルドが必要

2. **実機テスト必須**
   - シミュレータ/エミュレータではカメラが動作しない
   - MediaPipeのGPU処理は実機でのみ有効

3. **プラットフォーム依存**
   - iOSはMac必須
   - AndroidはUSBデバッグ有効化必須

### 6.2 パフォーマンス制約

1. **デバイス依存**
   - 低スペックデバイスではFPSが低下する可能性
   - フレームスキップが必要な場合あり

2. **バッテリー消費**
   - カメラ+AI処理はバッテリーを多く消費
   - 長時間使用時は警告が必要

### 6.3 既知の問題

1. **Web非対応**
   - Webではカメラ+MediaPipeは動作しない
   - フォールバック表示を実装済み

---

## 7. 推奨設定

### 7.1 カメラ設定

```typescript
const cameraConfig = {
  device: 'back',           // 背面カメラ
  isActive: true,
  photo: false,             // 写真不要
  video: false,             // 動画録画不要
  audio: false,             // 音声不要
  frameProcessorFps: 30,    // フレームレート
};
```

### 7.2 MediaPipe設定

```typescript
const poseConfig = {
  modelType: 'lite',        // Lite版（高速）
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  numPoses: 1,              // 1人のみ検出
};
```

### 7.3 パフォーマンス最適化

1. **解像度調整**
   - 基準: 640x480（VGA）
   - 低スペック: 480x360

2. **フレームスキップ**
   - 処理時間 > 40ms: 1フレームスキップ
   - 処理時間 > 50ms: 2フレームスキップ

---

## 8. 次のステップ

### 8.1 チケット012（カメラ設定画面）

- カメラ切り替え機能
- 解像度選択
- FPS表示オプション

### 8.2 チケット013（フォーム評価実装）

- スクワットフォーム評価
- 角度計算の適用
- リアルタイムフィードバック

---

## 9. 検証結果（実機テスト後に記入）

### 9.1 テスト環境

| 項目 | iOS | Android |
|------|-----|---------|
| デバイス | - | - |
| OSバージョン | - | - |
| ビルド日時 | - | - |

### 9.2 テスト結果

| 項目 | iOS結果 | Android結果 |
|------|---------|-------------|
| カメラプレビュー | - | - |
| 33関節点検出 | - | - |
| 平均FPS | - | - |
| 平均推論時間 | - | - |
| 信頼度フィルタ | - | - |

### 9.3 スクリーンショット

（テスト後に追加）

---

## 10. 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、実装完了 |

---

**作成者**: Claude (React Specialist Agent)
**レビュー待ち**: 実機テスト結果の追記が必要
