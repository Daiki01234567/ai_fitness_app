# 021 カメラ機能実装

## 概要

トレーニング中の姿勢を撮影するためのカメラ機能を実装します。react-native-vision-cameraを使用して、フロントカメラ/バックカメラの切り替え、カメラ権限の処理を行います。

## Phase

Phase 2（機能実装）

## 依存チケット

- 002: Firebase基盤構築

## 要件

### 機能要件

1. **カメラアクセス**
   - フロントカメラ（自撮り用）でのプレビュー表示
   - バックカメラ（誰かに撮ってもらう用）でのプレビュー表示
   - カメラの切り替えボタン

2. **カメラ権限処理**
   - 初回起動時にカメラ権限をリクエスト
   - 権限が拒否された場合のエラーメッセージ表示
   - 設定画面への誘導ボタン

3. **プレビュー表示**
   - 全画面でカメラプレビューを表示
   - 画面の向き（縦/横）に対応
   - アスペクト比の自動調整

### 非機能要件

- カメラ起動時間: 2秒以内
- プレビュー遅延: 100ms以下
- バッテリー消費を考慮した実装

## 受け入れ条件

- [ ] フロントカメラでプレビューが表示される
- [ ] バックカメラでプレビューが表示される
- [ ] カメラの切り替えができる
- [ ] カメラ権限がない場合、適切なメッセージが表示される
- [ ] 権限拒否時に設定画面に遷移できる
- [ ] iOSで動作確認完了
- [ ] Androidで動作確認完了

## 参照ドキュメント

| ドキュメント | パス | 該当セクション |
|-------------|------|----------------|
| 要件定義書 Part 4 | `docs/expo/specs/04_要件定義書_Expo版_v1_Part4.md` | 1.1 画面一覧（カメラ設定画面） |
| 画面遷移図 | `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` | カメラ設定画面 |

## 技術詳細

### 使用ライブラリ

```json
{
  "dependencies": {
    "react-native-vision-camera": "^4.x.x",
    "react-native-worklets-core": "^1.x.x"
  }
}
```

### インストール手順

```bash
# パッケージインストール
npx expo install react-native-vision-camera

# Development Build再作成が必要
npx expo prebuild
npx expo run:ios
npx expo run:android
```

### ディレクトリ構成

```
src/
├── features/
│   └── camera/
│       ├── components/
│       │   ├── CameraPreview.tsx    # カメラプレビュー
│       │   └── CameraSwitchButton.tsx # カメラ切替ボタン
│       ├── hooks/
│       │   ├── useCamera.ts         # カメラ制御フック
│       │   └── useCameraPermission.ts # 権限管理フック
│       └── index.ts
```

### カメラ権限の設定

**iOS (Info.plist)**:
```xml
<key>NSCameraUsageDescription</key>
<string>トレーニングフォームを確認するためにカメラを使用します</string>
```

**Android (AndroidManifest.xml)**:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### 主要コンポーネント

```typescript
// useCamera.ts の基本構造
import { useCameraDevice, useCameraFormat } from 'react-native-vision-camera';

export const useCamera = () => {
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);

  const toggleCamera = () => {
    setCameraPosition(prev => prev === 'front' ? 'back' : 'front');
  };

  return { device, cameraPosition, toggleCamera };
};
```

```typescript
// useCameraPermission.ts の基本構造
import { Camera } from 'react-native-vision-camera';
import { Linking } from 'react-native';

export const useCameraPermission = () => {
  const [hasPermission, setHasPermission] = useState(false);

  const requestPermission = async () => {
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'granted');
    return status;
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  return { hasPermission, requestPermission, openSettings };
};
```

### 権限フロー

```
アプリ起動
    ↓
権限を確認
    ↓
[権限あり] → カメラプレビュー表示
    ↓
[権限なし] → 権限リクエストダイアログ表示
    ↓
[許可] → カメラプレビュー表示
    ↓
[拒否] → エラーメッセージ + 設定画面誘導ボタン
```

## 注意事項

1. **Development Buildが必須**
   - Expo Goではカメラ機能は動作しない
   - 実機テストが必要

2. **プライバシー配慮**
   - カメラ映像は端末内でのみ処理
   - 映像データはサーバーに送信しない
   - ユーザーに明確に説明する

3. **パフォーマンス**
   - カメラプレビューは30fps以上を維持
   - メモリリークに注意（コンポーネントアンマウント時のクリーンアップ）

4. **エラーハンドリング**
   - カメラが使用できない端末への対応
   - カメラが他のアプリで使用中の場合の対応

## 見積もり

| 作業内容 | 見積もり時間 |
|----------|--------------|
| ライブラリ導入・設定 | 2時間 |
| カメラプレビュー実装 | 4時間 |
| 権限処理実装 | 3時間 |
| カメラ切り替え実装 | 2時間 |
| iOS/Androidテスト | 3時間 |
| **合計** | **14時間** |

## 進捗

### ステータス: 未着手

### Todo

- [ ] react-native-vision-cameraをインストール
- [ ] iOS設定（Info.plist）
- [ ] Android設定（AndroidManifest.xml）
- [ ] CameraPreviewコンポーネント作成
- [ ] useCameraPermissionフック作成
- [ ] useCameraフック作成
- [ ] カメラ切り替え機能実装
- [ ] 権限拒否時のUI作成
- [ ] iOSで動作確認
- [ ] Androidで動作確認

### 作業ログ

| 日付 | 作業内容 | 担当者 |
|------|----------|--------|
| - | - | - |

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| 1.0 | 2025年12月9日 | 初版作成 |
