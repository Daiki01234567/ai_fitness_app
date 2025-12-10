# MediaPipe Development Build セットアップガイド

このガイドでは、MediaPipeによる姿勢検出機能をテストするためのDevelopment Buildの作成方法を説明します。

**対象読者**: 中学生〜高校生レベル
**所要時間**: 約30分〜1時間

---

## 目次

1. [事前準備](#1-事前準備)
2. [なぜDevelopment Buildが必要？](#2-なぜdevelopment-buildが必要)
3. [パッケージのインストール](#3-パッケージのインストール)
4. [iOSでのビルド](#4-iosでのビルド)
5. [Androidでのビルド](#5-androidでのビルド)
6. [動作確認](#6-動作確認)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. 事前準備

### 必要なもの

| 項目 | iOS | Android |
|------|-----|---------|
| パソコン | Mac必須 | Windows/Mac/Linux |
| 開発ツール | Xcode 15以上 | Android Studio |
| 実機 | iPhone（推奨） | Androidスマホ |
| ケーブル | Lightning/USB-C | USB |

### 開発環境の確認

ターミナル（コマンドプロンプト）で以下を実行して、環境を確認します：

```bash
# Node.jsのバージョン確認（20.x以上が必要）
node -v

# npmのバージョン確認
npm -v

# Expoのバージョン確認
npx expo --version
```

---

## 2. なぜDevelopment Buildが必要？

### Expo Goの限界

普段のテストで使う「Expo Go」アプリには、カメラやAI処理に必要な機能が入っていません。

| 機能 | Expo Go | Development Build |
|------|---------|-------------------|
| 画面表示 | OK | OK |
| ボタン操作 | OK | OK |
| カメラ（高速） | NG | OK |
| MediaPipe（AI） | NG | OK |

### Development Buildとは？

「Development Build」は、あなたのアプリ専用にカスタマイズされたテストアプリです。
MediaPipeやカメラなど、特別な機能も使えるようになります。

---

## 3. パッケージのインストール

### ステップ1: プロジェクトフォルダに移動

```bash
cd expo_app
```

### ステップ2: 依存パッケージの確認

`package.json`に以下のパッケージが含まれていることを確認してください：

```json
{
  "dependencies": {
    "react-native-vision-camera": "^4.7.3",
    "react-native-mediapipe": "^0.6.0",
    "react-native-worklets-core": "^1.6.2",
    "expo-dev-client": "~6.0.20"
  }
}
```

### ステップ3: パッケージインストール

```bash
npm install
```

成功すると、こんな感じの出力が表示されます：

```
added 50 packages, and audited 1200 packages in 30s
found 0 vulnerabilities
```

---

## 4. iOSでのビルド

**必要なもの**: Mac + Xcode

### ステップ1: Xcodeのインストール

1. Mac App Storeを開く
2. 「Xcode」を検索してインストール（約10GB、時間がかかります）
3. インストール後、Xcodeを一度開いて利用規約に同意

### ステップ2: CocoaPodsのインストール

ターミナルで以下を実行：

```bash
sudo gem install cocoapods
```

パスワードを聞かれたら、Macのログインパスワードを入力してください。

### ステップ3: ネイティブコードの生成

```bash
cd expo_app
npx expo prebuild --platform ios
```

これにより、`ios/`フォルダが作成されます。

### ステップ4: iPhoneを接続

1. iPhoneをMacにケーブルで接続
2. iPhone側で「このコンピュータを信頼しますか？」と表示されたら「信頼」をタップ

### ステップ5: ビルドして実行

```bash
npx expo run:ios --device
```

初回は時間がかかります（5〜15分）。

成功すると、iPhoneにアプリがインストールされます！

### シミュレータで実行する場合

実機がない場合は、シミュレータでも試せます（ただしカメラは動きません）：

```bash
npx expo run:ios
```

---

## 5. Androidでのビルド

**必要なもの**: Android Studio

### ステップ1: Android Studioのインストール

1. https://developer.android.com/studio からダウンロード
2. インストーラーを実行
3. 初回起動時に「Standard」セットアップを選択

### ステップ2: 環境変数の設定

#### Windows

1. スタートメニューで「環境変数」と検索
2. 「システム環境変数の編集」をクリック
3. 「環境変数」ボタンをクリック
4. 「ユーザー環境変数」の「新規」をクリック
   - 変数名: `ANDROID_HOME`
   - 変数値: `C:\Users\あなたのユーザー名\AppData\Local\Android\Sdk`
5. 「Path」を選択して「編集」
   - 以下を追加：
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\emulator`

#### Mac/Linux

`~/.bashrc` または `~/.zshrc` に以下を追加：

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

追加後、ターミナルを再起動してください。

### ステップ3: USBデバッグを有効にする

Androidスマホ側での設定：

1. 「設定」アプリを開く
2. 「端末情報」→「ソフトウェア情報」を開く
3. 「ビルド番号」を7回タップ（開発者モードが有効になります）
4. 設定に戻り、「開発者向けオプション」を開く
5. 「USBデバッグ」をONにする

### ステップ4: ネイティブコードの生成

```bash
cd expo_app
npx expo prebuild --platform android
```

これにより、`android/`フォルダが作成されます。

### ステップ5: ビルドして実行

```bash
npx expo run:android --device
```

スマホ側で「USBデバッグを許可しますか？」と表示されたら「許可」をタップ。

初回は時間がかかります（10〜20分）。

成功すると、Androidスマホにアプリがインストールされます！

### エミュレータで実行する場合

```bash
npx expo run:android
```

---

## 6. 動作確認

### カメラテスト画面

アプリが起動したら、以下のURLにアクセス：

```
/training/camera-test
```

**確認ポイント**:
- カメラのプレビューが表示されるか
- 権限リクエストが正しく動作するか

### 姿勢検出テスト画面

```
/training/pose-detection-test
```

**確認ポイント**:
- FPS表示が30fps前後か（最低15fps以上）
- 33関節点が検出されるか
- 推論時間が33ms以下か

### FPSの目安

| FPS | 状態 |
|-----|------|
| 30以上 | 最高（目標達成） |
| 24〜29 | 良好 |
| 15〜23 | 許容範囲 |
| 15未満 | 要改善 |

---

## 7. トラブルシューティング

### Q: ビルドエラーが出る

**解決策**: クリーンビルドを試す

```bash
# iOSの場合
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
npx expo run:ios --device

# Androidの場合
cd android && ./gradlew clean && cd ..
npx expo run:android --device
```

### Q: カメラが起動しない

**確認ポイント**:
1. スマホの設定でアプリにカメラ権限を付与しているか
2. `app.json`にカメラ権限の設定があるか

**iOS設定確認（app.json）**:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "トレーニング中のフォームをチェックするためにカメラを使用します"
      }
    }
  }
}
```

### Q: MediaPipeが動作しない

**確認ポイント**:
1. Development Build（Expo Goではない）を使用しているか
2. `react-native-mediapipe`がインストールされているか

**確認コマンド**:
```bash
npm list react-native-mediapipe
```

### Q: FPSが低い

**対策**:
1. 他のアプリを閉じる
2. デバイスを再起動する
3. 解像度を下げる設定を試す

### Q: 「No device found」エラー

**iOS**:
- iPhoneがMacに正しく接続されているか確認
- Xcodeで「Window」→「Devices and Simulators」を開き、デバイスが認識されているか確認

**Android**:
- USBデバッグが有効になっているか確認
- `adb devices`コマンドでデバイスが表示されるか確認

```bash
adb devices
```

表示例：
```
List of devices attached
ABC123DEF456    device
```

### Q: prebuildで失敗する

**解決策**: キャッシュをクリアして再実行

```bash
# 既存のネイティブフォルダを削除
rm -rf ios android

# キャッシュをクリア
npx expo prebuild --clean
```

---

## まとめ

1. Development BuildはMediaPipe使用に必須
2. iOS: Mac + Xcode + 実機
3. Android: Android Studio + 実機
4. ビルド後、`/training/pose-detection-test`で動作確認
5. 困ったらクリーンビルドを試す

**次のステップ**:
実機でFPS 15fps以上、33関節点の検出ができることを確認できたら、チケット011は完了です！

---

**作成日**: 2025年12月10日
**対象チケット**: 011 MediaPipe PoC（技術検証）
