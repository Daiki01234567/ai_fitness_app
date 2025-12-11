# Android実機テストガイド

このガイドでは、Android実機でAIフィットネスアプリをテストする方法を説明します。
**ネットワーク接続がない環境**でも、PCとUSB接続でテストできる方法を紹介します。

**対象読者**: 中学生〜高校生レベル
**所要時間**: 約20分〜40分

---

## 目次

1. [テスト環境の選択](#1-テスト環境の選択)
2. [事前準備](#2-事前準備)
3. [方法A: Expo Go でのテスト（簡単）](#3-方法a-expo-go-でのテスト簡単)
4. [方法B: Development Build でのテスト（本格）](#4-方法b-development-build-でのテスト本格)
5. [ネット接続なしでテストする方法](#5-ネット接続なしでテストする方法)
6. [Firebaseエミュレータとの接続](#6-firebaseエミュレータとの接続)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. テスト環境の選択

### どの方法を選ぶ？

| 状況 | おすすめの方法 |
|------|---------------|
| 画面の見た目だけ確認したい | 方法A: Expo Go |
| カメラ機能もテストしたい | 方法B: Development Build |
| スマホがネットに繋がらない | [ネット接続なしでテストする方法](#5-ネット接続なしでテストする方法) |

### 各方法の比較

| 機能 | Expo Go | Development Build |
|------|---------|-------------------|
| セットアップ時間 | 5分 | 30分 |
| 画面表示・ボタン | OK | OK |
| 基本的なカメラ | OK | OK |
| MediaPipe（AI姿勢検出）| NG | OK |
| ネット不要でテスト | 設定必要 | 設定必要 |

---

## 2. 事前準備

### 2.1 必要なもの

| 項目 | 説明 |
|------|------|
| Windows PC | Mac/Linuxでも可 |
| Android スマホ | Android 8.0 (API 26) 以上 |
| USB ケーブル | スマホとPCを繋ぐ用 |

### 2.2 Android スマホの設定

#### ステップ1: 開発者オプションを有効にする

1. **設定** アプリを開く
2. **デバイス情報**（または「端末情報」）をタップ
3. **ビルド番号** を **7回連続** でタップする
4. 「開発者になりました」と表示されればOK

> 💡 **ヒント**: メーカーによって場所が違います
> - Samsung: 設定 → デバイス情報 → ソフトウェア情報 → ビルド番号
> - Pixel: 設定 → デバイス情報 → ビルド番号
> - Xiaomi: 設定 → デバイス情報 → MIUIバージョン

#### ステップ2: USBデバッグを有効にする

1. **設定** アプリを開く
2. **開発者向けオプション**（または「開発者オプション」）をタップ
3. **USBデバッグ** をONにする
4. 確認ダイアログが出たら「OK」をタップ

### 2.3 PCの設定

#### Android Studio のインストール（初回のみ）

1. [Android Studio公式サイト](https://developer.android.com/studio) にアクセス
2. 「Download Android Studio」をクリック
3. ダウンロードしたファイルを実行してインストール
4. インストール完了後、一度起動して初期設定を完了する

> 💡 **なぜ必要？**: Android Studio に含まれる `adb` コマンドが必要です

#### ADB の確認

コマンドプロンプト（またはターミナル）で以下を実行：

```bash
adb version
```

バージョンが表示されればOK。表示されない場合は、環境変数 PATH に以下を追加：
- Windows: `C:\Users\[ユーザー名]\AppData\Local\Android\Sdk\platform-tools`
- Mac: `~/Library/Android/sdk/platform-tools`

---

## 3. 方法A: Expo Go でのテスト（簡単）

### 3.1 Expo Go アプリのインストール

1. Android スマホで **Google Play ストア** を開く
2. 「Expo Go」を検索
3. インストールする

### 3.2 開発サーバーの起動

PCのコマンドプロンプトで：

```bash
# プロジェクトフォルダに移動
cd C:\Users\236149\Desktop\ai_fitness_app\expo_app

# 開発サーバー起動
npx expo start
```

### 3.3 アプリを起動

#### Wi-Fi が使える場合

1. ターミナルに表示されるQRコードを確認
2. スマホの Expo Go アプリを開く
3. 「Scan QR code」でQRコードを読み取る

#### Wi-Fi が使えない場合

→ [5. ネット接続なしでテストする方法](#5-ネット接続なしでテストする方法) を参照

---

## 4. 方法B: Development Build でのテスト（本格）

MediaPipe（AI姿勢検出）を使う場合は、こちらの方法が必要です。

### 4.1 ビルドの準備

```bash
# プロジェクトフォルダに移動
cd C:\Users\236149\Desktop\ai_fitness_app\expo_app

# 依存パッケージのインストール
npm install
```

### 4.2 ネイティブコードの生成

```bash
npx expo prebuild --platform android
```

これで `android` フォルダが生成されます。

### 4.3 実機にインストール

#### 方法1: USB接続でインストール（推奨）

```bash
# スマホをUSBで接続した状態で実行
npx expo run:android
```

自動的にビルドされ、スマホにインストールされます。

#### 方法2: APKファイルを作成してインストール

```bash
# APKファイルを生成
cd android
./gradlew assembleDebug
```

生成されるファイル: `android/app/build/outputs/apk/debug/app-debug.apk`

このAPKファイルをスマホに転送してインストール：
1. USBでスマホをPCに接続
2. スマホのストレージにAPKファイルをコピー
3. スマホのファイルマネージャーでAPKファイルを開く
4. インストールを許可する

---

## 5. ネット接続なしでテストする方法

スマホがWi-Fiやモバイルデータに接続できない場合でも、PCとUSB接続することでテストできます。

### 5.1 USB接続の確認

```bash
# スマホをUSBで接続
adb devices
```

以下のように表示されればOK：
```
List of devices attached
XXXXXXXX    device
```

「unauthorized」と表示される場合：
1. スマホの画面を確認
2. 「USBデバッグを許可しますか？」→「許可」をタップ

### 5.2 ADB リバースポートの設定

PCで動作している開発サーバーに、スマホからアクセスできるようにします。

```bash
# Expo開発サーバー用
adb reverse tcp:8081 tcp:8081

# Firebaseエミュレータ用（必要な場合）
adb reverse tcp:9099 tcp:9099    # Auth
adb reverse tcp:8080 tcp:8080    # Firestore
adb reverse tcp:5001 tcp:5001    # Functions
adb reverse tcp:9199 tcp:9199    # Storage
adb reverse tcp:4000 tcp:4000    # Emulator UI
```

> 💡 **これは何をしている？**:
> `adb reverse` は、スマホの `localhost:ポート` へのアクセスを、PC の同じポートに転送します。

### 5.3 開発サーバーの起動

```bash
cd C:\Users\236149\Desktop\ai_fitness_app\expo_app

# ローカルホストモードで起動
npx expo start --localhost
```

### 5.4 スマホでアプリを起動

1. Expo Go アプリを開く
2. 「Enter URL manually」をタップ
3. `exp://localhost:8081` と入力
4. 「Connect」をタップ

---

## 6. Firebaseエミュレータとの接続

ローカルでFirebaseの機能（認証、データベースなど）をテストする場合、エミュレータを使います。

### 6.1 エミュレータの起動

PC のコマンドプロンプトで：

```bash
cd C:\Users\236149\Desktop\ai_fitness_app

# Firebaseエミュレータを起動
firebase emulators:start
```

起動すると以下のポートで動作します：

| サービス | ポート | URL |
|----------|--------|-----|
| Auth | 9099 | http://localhost:9099 |
| Firestore | 8080 | http://localhost:8080 |
| Functions | 5001 | http://localhost:5001 |
| Storage | 9199 | http://localhost:9199 |
| Emulator UI | 4000 | http://localhost:4000 |

### 6.2 環境変数の確認

`.env.development` ファイルで以下が設定されていることを確認：

```bash
EXPO_PUBLIC_USE_EMULATOR=true
EXPO_PUBLIC_EMULATOR_HOST=localhost
```

### 6.3 ADBリバースポートの設定（スマホ用）

スマホからエミュレータにアクセスするには：

```bash
# 全ポートを一括設定
adb reverse tcp:9099 tcp:9099
adb reverse tcp:8080 tcp:8080
adb reverse tcp:5001 tcp:5001
adb reverse tcp:9199 tcp:9199
adb reverse tcp:4000 tcp:4000
```

### 6.4 接続の確認

1. PC で Firebase Emulator UI を開く: http://localhost:4000
2. スマホでアプリを起動
3. 新規登録やログインを試す
4. Emulator UI の「Authentication」タブでユーザーが作成されていればOK

---

## 7. トラブルシューティング

### Q1: `adb devices` でデバイスが表示されない

**原因と対処法**:

1. **USBケーブルを確認** - 充電専用ケーブルではなく、データ転送対応ケーブルを使う
2. **USBデバッグを再確認** - 設定 → 開発者向けオプション → USBデバッグ がON
3. **USB接続モードを確認** - スマホの通知を開き「ファイル転送（MTP）」を選択
4. **ドライバをインストール** - メーカー公式サイトから USB ドライバをダウンロード

### Q2: 「unauthorized」と表示される

**対処法**:
1. スマホの画面ロックを解除
2. 「USBデバッグを許可しますか？」ダイアログで「許可」をタップ
3. 許可しても変わらない場合：
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

### Q3: Expo Go で「Network response timed out」

**対処法**:
1. ADBリバースポートを設定し直す：
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
2. 開発サーバーを `--localhost` オプション付きで再起動：
   ```bash
   npx expo start --localhost
   ```

### Q4: Firebaseに接続できない

**対処法**:
1. エミュレータが起動しているか確認: http://localhost:4000
2. ADBリバースポートを設定：
   ```bash
   adb reverse tcp:9099 tcp:9099
   adb reverse tcp:8080 tcp:8080
   ```
3. `.env.development` の設定を確認：
   ```
   EXPO_PUBLIC_USE_EMULATOR=true
   EXPO_PUBLIC_EMULATOR_HOST=localhost
   ```

### Q5: ビルドエラー「SDK location not found」

**対処法**:
`android/local.properties` ファイルを作成し、Android SDK のパスを記載：

```properties
# Windows の場合
sdk.dir=C:\\Users\\[ユーザー名]\\AppData\\Local\\Android\\Sdk

# Mac の場合
sdk.dir=/Users/[ユーザー名]/Library/Android/sdk
```

### Q6: APKのインストール時「セキュリティ上の理由で...」

**対処法**:
1. 設定 → セキュリティ → 「提供元不明のアプリ」を許可
2. または設定 → アプリ → [ファイルマネージャー] → 「不明なアプリのインストール」を許可

---

## 補足: よく使うコマンド一覧

```bash
# === デバイス確認 ===
adb devices                     # 接続デバイス一覧

# === ADBリバースポート ===
adb reverse tcp:8081 tcp:8081   # Expo開発サーバー
adb reverse tcp:9099 tcp:9099   # Firebase Auth
adb reverse tcp:8080 tcp:8080   # Firestore
adb reverse tcp:5001 tcp:5001   # Functions
adb reverse --remove-all        # 全リバース設定を解除

# === Expo ===
npx expo start                  # 開発サーバー起動
npx expo start --localhost      # ローカルホストモード
npx expo start --clear          # キャッシュクリアして起動
npx expo run:android            # 実機に直接インストール

# === Firebase ===
firebase emulators:start        # エミュレータ起動

# === トラブル時 ===
adb kill-server                 # ADBサーバー停止
adb start-server                # ADBサーバー起動
```

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2025-12-11 | 初版作成 |
