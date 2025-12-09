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

- [ ] カメラ権限をリクエストする機能を実装
- [ ] 権限が拒否された場合、設定画面へ誘導する機能を実装
- [ ] カメラプレビューを全画面で表示する機能を実装
- [ ] フロント/リアカメラを切り替えるボタンを実装
- [ ] カメラプレビューの向き（縦/横）に対応
- [ ] フレームプロセッサ（Frame Processor）を設定し、フレームを取得できることを確認
- [ ] カメラエラーハンドリング（カメラが使用できない場合のエラー表示）
- [ ] iOSとAndroidの両方で動作することを確認
- [ ] カメラコンポーネントを作成し、再利用可能にする

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-013
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-007, NFR-024, NFR-026
- `docs/expo/specs/01_技術スタック_v1_0.md` - react-native-vision-camera
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - トレーニング実行画面

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

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **Expo Goでは動作しない**: Development Buildが必須
- **権限管理**: iOSはInfo.plist、AndroidはAndroidManifest.xmlに権限を追加する必要あり
- **パフォーマンス**: フレームプロセッサは軽量に保つこと（重い処理はワーカースレッドで実行）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
