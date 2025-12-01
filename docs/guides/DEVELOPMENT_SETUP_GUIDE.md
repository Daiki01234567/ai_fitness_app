# 開発環境セットアップガイド

**プロジェクト名**: AI Fitness App
**対象読者**: 初学者〜中級者の開発者
**所要時間**: 3〜5時間（初回セットアップ）
**最終更新日**: 2025-12-01

---

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [Node.js環境構築](#nodejs環境構築)
4. [Flutter環境構築](#flutter環境構築)
5. [Firebase CLI環境構築](#firebase-cli環境構築)
6. [プロジェクトセットアップ](#プロジェクトセットアップ)
7. [Firebaseエミュレーター起動](#firebaseエミュレーター起動)
8. [テスト実行](#テスト実行)
9. [開発サーバー起動](#開発サーバー起動)
10. [iOS実機テストセットアップ](#ios実機テストセットアップ)
11. [トラブルシューティング](#トラブルシューティング)
12. [次のステップ](#次のステップ)

---

## 概要

### このガイドの目的

このガイドは、AI Fitness Appの開発に必要な環境を初めてセットアップする開発者向けの手順書です。専門用語には説明を付けており、各手順で「なぜこの作業が必要か」を理解しながら進められます。

### 対象OS

- Windows 10/11
- macOS 12以降
- Ubuntu 20.04以降

※ 本ガイドではWindows/macOSの手順を中心に記載します。

### セットアップ完了後にできること

- Flutterアプリのローカル実行（エミュレーター/実機）
- Firebase Functionsのローカルテスト
- Firestoreのローカルデータベース操作
- 単体テスト・統合テストの実行
- コードの静的解析とフォーマット

---

## 前提条件

### 必要なもの

- [ ] インターネット接続（各種ツールのダウンロード用）
- [ ] Googleアカウント（Firebase利用のため）
- [ ] テキストエディタまたはIDE（推奨: VS Code, Android Studio）
- [ ] 管理者権限（ツールインストール時に必要）
- [ ] 最低8GB RAM（推奨: 16GB以上）
- [ ] 空きディスク容量: 20GB以上

### 推奨する事前知識

- Git / GitHubの基本操作
- コマンドライン（ターミナル）の基本操作
- JavaScriptまたはTypeScriptの基礎
- Dartまたは他のプログラミング言語の基礎

> **初心者向けアドバイス**: 上記の知識がなくても本ガイドに沿って進めることはできますが、躓いた際は各技術の公式ドキュメントを併せて参照することをおすすめします。

---

## Node.js環境構築

### Node.jsとは

**Node.js**は、JavaScript/TypeScriptをサーバーサイドで実行するための実行環境です。本プロジェクトではFirebase Functionsのバックエンド処理に使用します。

### なぜ必要か

- Firebase FunctionsはNode.js上で動作します
- プロジェクトの依存パッケージ管理に`npm`（Node Package Manager）を使用します

### バージョン要件

- **Node.js 24 LTS** （本プロジェクトの要件）
- npm 10以降（Node.jsに同梱）

---

### インストール方法

#### オプション1: 公式インストーラー（推奨・初学者向け）

**Windows/macOS共通**:

1. [Node.js公式サイト](https://nodejs.org/)にアクセス
2. 「LTS（Long Term Support）」版をダウンロード
   - ※ 現在の最新LTSが24.xでない場合、[過去バージョン](https://nodejs.org/en/download/releases/)からNode.js 24.xを選択
3. ダウンロードしたインストーラーを実行
4. デフォルト設定のまま「次へ」をクリックしてインストール

---

#### オプション2: nvm（Node Version Manager）を使用（推奨・上級者向け）

**nvmとは**: 複数のNode.jsバージョンを切り替えて使用できるツールです。プロジェクトごとに異なるバージョンが必要な場合に便利です。

##### Windows向け: nvm-windows

1. [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases)から最新版の`nvm-setup.exe`をダウンロード
2. インストーラーを実行
3. PowerShellまたはコマンドプロンプトを**管理者権限**で開く
4. 以下のコマンドを実行:

```powershell
# Node.js 24 LTSのインストール
nvm install 24

# Node.js 24を使用
nvm use 24
```

##### macOS/Linux向け: nvm

1. ターミナルを開き、以下のコマンドを実行:

```bash
# nvmのインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# シェルの再読み込み（またはターミナルを再起動）
source ~/.bashrc  # bashの場合
# または
source ~/.zshrc   # zshの場合
```

2. Node.js 24のインストール:

```bash
# Node.js 24 LTSのインストール
nvm install 24

# Node.js 24を使用
nvm use 24

# デフォルトバージョンに設定
nvm alias default 24
```

---

### インストール確認

ターミナルまたはコマンドプロンプトで以下を実行:

```bash
# Node.jsのバージョン確認
node --version
# 出力例: v24.x.x

# npmのバージョン確認
npm --version
# 出力例: 10.x.x
```

> **トラブルシューティング**: コマンドが認識されない場合、ターミナルを再起動してください。それでも解決しない場合は、環境変数PATHにNode.jsのインストールパスが追加されているか確認してください。

---

## Flutter環境構築

### Flutterとは

**Flutter**は、Googleが開発したクロスプラットフォームのモバイルアプリ開発フレームワークです。1つのコードベースでiOS/Androidアプリを開発できます。

### なぜ必要か

本プロジェクトのモバイルアプリケーションはFlutterで開発されています。カメラを使ったMediaPipeによる姿勢検出機能やUI全般を実装します。

### バージョン要件

- **Flutter 3.x以降**
- **Dart 3.10以降**（Flutterに同梱）

---

### インストール方法

#### Windows

1. [Flutter公式サイト（Windows）](https://docs.flutter.dev/get-started/install/windows)にアクセス
2. 「Get the Flutter SDK」から最新安定版のZIPファイルをダウンロード
3. ZIPファイルを展開（例: `C:\src\flutter`）
4. 環境変数PATHに`C:\src\flutter\bin`を追加:
   - Windowsキー → 「環境変数」で検索
   - 「システム環境変数の編集」→「環境変数」ボタン
   - ユーザー環境変数の`Path`を選択 → 「編集」
   - 「新規」ボタンをクリックし、`C:\src\flutter\bin`を追加
   - OKで閉じる

5. **Android Studio**のインストール（Androidアプリ開発に必要）:
   - [Android Studio公式サイト](https://developer.android.com/studio)からダウンロード
   - インストーラーを実行し、デフォルト設定でインストール
   - 初回起動時に「Standard」セットアップを選択
   - Android SDK、Android SDK Platform、Android Virtual Deviceが自動インストールされます

6. コマンドプロンプトまたはPowerShellを**新しく開いて**以下を実行:

```powershell
flutter doctor
```

#### macOS

1. [Flutter公式サイト（macOS）](https://docs.flutter.dev/get-started/install/macos)にアクセス
2. 「Get the Flutter SDK」から最新安定版をダウンロード
3. ターミナルで以下を実行:

```bash
# ダウンロードしたZIPを展開
cd ~/Development  # 任意のディレクトリ
unzip ~/Downloads/flutter_macos_*.zip

# PATHを追加（zshの場合）
echo 'export PATH="$PATH:$HOME/Development/flutter/bin"' >> ~/.zshrc
source ~/.zshrc

# またはbashの場合
echo 'export PATH="$PATH:$HOME/Development/flutter/bin"' >> ~/.bash_profile
source ~/.bash_profile
```

4. **Xcode**のインストール（iOSアプリ開発に必要）:

```bash
# Xcodeのインストール（App Storeから）
# インストール後、以下を実行:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch

# CocoaPodsのインストール（iOSの依存関係管理ツール）
sudo gem install cocoapods
```

5. **Android Studio**のインストール（Android開発にも対応する場合）:
   - [Android Studio公式サイト](https://developer.android.com/studio)からダウンロード
   - .dmgファイルを開き、アプリケーションフォルダにドラッグ
   - 初回起動時に「Standard」セットアップを選択

6. Flutterの依存関係チェック:

```bash
flutter doctor
```

---

### flutter doctorの解釈

`flutter doctor`は、Flutter開発に必要な環境が整っているかをチェックするコマンドです。

**出力例**:
```
Doctor summary (to see all details, run flutter doctor -v):
[✓] Flutter (Channel stable, 3.x.x, on macOS 14.x.x)
[✓] Android toolchain - develop for Android devices (Android SDK version 34.x.x)
[✓] Xcode - develop for iOS and macOS (Xcode 15.x)
[✓] Chrome - develop for the web
[✓] Android Studio (version 2024.x)
[✓] VS Code (version 1.x.x)
[✓] Connected device (1 available)
[✓] Network resources

• No issues found!
```

**記号の意味**:
- `[✓]` : 問題なし
- `[!]` : 警告（開発は可能だが推奨設定ではない）
- `[✗]` : エラー（修正が必要）

**よくある警告と対処**:

1. **Android licenses not accepted**:
   ```bash
   flutter doctor --android-licenses
   ```
   すべてのライセンスに対して`y`（yes）を入力

2. **VS Code not found**:
   - [VS Code公式サイト](https://code.visualstudio.com/)からインストール
   - FlutterおよびDart拡張機能をインストール

3. **cmdline-tools component is missing**:
   - Android Studioを開く → Settings（Preferences） → Appearance & Behavior → System Settings → Android SDK
   - 「SDK Tools」タブ → 「Android SDK Command-line Tools」をチェックしてインストール

---

### VS Codeのセットアップ（推奨）

軽量で高機能なエディタとしてVS Codeを推奨します。

1. [VS Code公式サイト](https://code.visualstudio.com/)からダウンロード・インストール
2. VS Codeを起動し、拡張機能をインストール:
   - 左サイドバーの拡張機能アイコン（□が4つ）をクリック
   - 以下を検索してインストール:
     - **Flutter**（Dart拡張も自動でインストールされます）
     - **ESLint**（TypeScript/JavaScriptのリンター）
     - **Prettier - Code formatter**（コードフォーマッター）
     - **Firebase**（Firebase関連の補完）

---

## Firebase CLI環境構築

### Firebase CLIとは

**Firebase CLI**（Command Line Interface）は、Firebaseプロジェクトをコマンドラインから管理するツールです。

### なぜ必要か

- ローカル開発用のFirebaseエミュレーターを起動
- Cloud Functionsのデプロイ
- Firestoreセキュリティルールのデプロイ
- プロジェクトの初期化と設定

---

### インストール方法

**前提**: Node.jsがインストール済みであること（前述のセクション参照）

#### Windows/macOS/Linux共通

ターミナルまたはコマンドプロンプトで以下を実行:

```bash
# Firebase CLIのグローバルインストール
npm install -g firebase-tools
```

> **説明**: `-g`フラグは「グローバルインストール」を意味し、システム全体でfirebaseコマンドが使用できるようになります。

---

### Firebaseログイン

Firebase CLIを使用するには、Googleアカウントでログインが必要です。

```bash
# Firebaseにログイン
firebase login
```

**実行すると**:
1. ブラウザが自動で開きます
2. Googleアカウントを選択してログイン
3. Firebase CLIへのアクセスを許可
4. ターミナルに「Success! Logged in as your-email@gmail.com」と表示されれば成功

**オフライン環境やCI/CD環境の場合**:
```bash
# トークンを使用したログイン
firebase login:ci
```

---

### インストール確認

```bash
# Firebase CLIのバージョン確認
firebase --version
# 出力例: 13.x.x

# ログイン状態の確認
firebase projects:list
# 自分がアクセスできるFirebaseプロジェクト一覧が表示される
```

---

## プロジェクトセットアップ

### リポジトリのクローン

**前提**: Gitがインストールされていること

```bash
# プロジェクトのクローン
git clone https://github.com/your-organization/ai_fitness_app.git

# プロジェクトディレクトリに移動
cd ai_fitness_app
```

> **注意**: 上記のリポジトリURLは例です。実際のプロジェクトURLに置き換えてください。

---

### Firebaseプロジェクトの選択

本プロジェクトでは、既存のFirebaseプロジェクト `tokyo-list-478804-e5` を使用します。

```bash
# プロジェクトの確認
firebase projects:list

# プロジェクトを選択（プロジェクトルートで実行）
firebase use tokyo-list-478804-e5
```

**出力例**:
```
Now using alias default (tokyo-list-478804-e5)
```

---

### Firebase Functionsの依存関係インストール

```bash
# functionsディレクトリに移動
cd functions

# 依存パッケージのインストール
npm install
```

**何が起きているか**:
- `package.json`に記載された依存パッケージ（firebase-admin、firebase-functionsなど）がインストールされます
- `node_modules`ディレクトリに各パッケージが保存されます

**所要時間**: 2〜5分（ネットワーク速度による）

---

### Flutterアプリの依存関係インストール

```bash
# プロジェクトルートに戻る
cd ..

# flutter_appディレクトリに移動
cd flutter_app

# Flutter依存パッケージのインストール
flutter pub get
```

**何が起きているか**:
- `pubspec.yaml`に記載された依存パッケージ（firebase_core、riverpodなど）がダウンロードされます
- `.dart_tool`および`pubspec.lock`が生成されます

---

### Freezed/Riverpodコード生成

本プロジェクトでは、**Freezed**（不変データクラス生成）と**Riverpod**（状態管理）のコード生成を使用しています。

```bash
# flutter_appディレクトリで実行
dart run build_runner build --delete-conflicting-outputs
```

**オプション説明**:
- `--delete-conflicting-outputs`: 既存の生成ファイルと競合する場合、自動で削除して再生成

**所要時間**: 1〜3分

**何が生成されるか**:
- `*.freezed.dart`: Freezedによる不変クラス
- `*.g.dart`: Riverpod Providerのコード生成

> **エラーが出た場合**: `pubspec.yaml`の依存関係が正しいか確認し、`flutter clean && flutter pub get`を実行後、再度試してください。

---

### 環境変数の設定（必要に応じて）

本プロジェクトでは、ほとんどの設定がFirebaseプロジェクト経由で行われますが、ローカル開発で独自の設定が必要な場合は`.env`ファイルを使用します。

**現在は特に設定不要ですが、将来的にAPI キーなどを追加する場合**:

```bash
# プロジェクトルートに.envファイルを作成
# .env.exampleがある場合はコピー
cp .env.example .env

# エディタで編集
code .env  # VS Codeの場合
```

---

## Firebaseエミュレーター起動

### Firebaseエミュレーターとは

**Firebaseエミュレーター**は、Firebase各サービス（Firestore、Authentication、Cloud Functionsなど）をローカル環境でシミュレートするツールです。

### なぜ必要か

- **本番環境を汚染せずに開発・テストができる**
- **インターネット接続なしでも動作する（一部機能）**
- **データのリセットが簡単**
- **無料で無制限に使用できる**

---

### エミュレーター設定の確認

プロジェクトルートの`firebase.json`に以下のようなエミュレーター設定があります:

```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "storage": {
      "port": 9199
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

**各ポートの役割**:

| サービス | ポート | 用途 |
|---------|--------|------|
| Emulator UI | 4000 | エミュレーター全体の管理画面 |
| Firestore | 8080 | ローカルデータベース |
| Authentication | 9099 | ローカル認証サービス |
| Functions | 5001 | Cloud Functionsのローカル実行 |
| Storage | 9199 | ファイルストレージ |

---

### エミュレーターの起動

プロジェクトルートで以下を実行:

```bash
# すべてのエミュレーターを起動
firebase emulators:start
```

**初回起動時**:
- Java JDKが必要です（エミュレーターがJavaで動作するため）
- インストールされていない場合、自動でダウンロードが始まります

**成功時の出力例**:
```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000                │
└─────────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬─────────────────────────────────┐
│ Emulator   │ Host:Port      │ View in Emulator UI             │
├────────────┼────────────────┼─────────────────────────────────┤
│ Auth       │ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth      │
│ Firestore  │ 127.0.0.1:8080 │ http://127.0.0.1:4000/firestore │
│ Functions  │ 127.0.0.1:5001 │ http://127.0.0.1:4000/functions │
│ Storage    │ 127.0.0.1:9199 │ http://127.0.0.1:4000/storage   │
└────────────┴────────────────┴─────────────────────────────────┘
```

---

### Emulator UIへのアクセス

ブラウザで以下にアクセス:

```
http://localhost:4000
```

**Emulator UIでできること**:
- Firestoreのデータを直接閲覧・編集
- Authenticationのユーザー一覧表示・追加
- Cloud Functionsのログ表示
- データのエクスポート/インポート

---

### エミュレーターの停止

ターミナルで `Ctrl + C` を押すとエミュレーターが停止します。

**注意**: エミュレーターを停止すると、メモリ上のデータは消失します（永続化設定をしていない場合）。

---

### データの永続化（オプション）

エミュレーターを再起動してもデータを保持したい場合:

```bash
# エクスポート
firebase emulators:export ./emulator-data

# 次回起動時にインポート
firebase emulators:start --import=./emulator-data
```

---

## テスト実行

### Firebase Functionsのテスト

```bash
# functionsディレクトリで実行
cd functions

# すべてのテストを実行
npm test

# ウォッチモード（ファイル変更を検知して自動再実行）
npm run test:watch

# カバレッジレポート付きテスト
npm run test:coverage
```

**テスト成功例**:
```
PASS  tests/services/auditLog.test.ts
PASS  tests/middleware/csrf.test.ts
PASS  tests/auth/onCreate.test.ts

Test Suites: 15 passed, 15 total
Tests:       87 passed, 87 total
Snapshots:   0 total
Time:        12.345 s
```

**カバレッジレポート**:
- `functions/coverage/lcov-report/index.html`をブラウザで開くと、視覚的なカバレッジレポートが確認できます

---

### Flutterアプリのテスト

```bash
# flutter_appディレクトリで実行
cd flutter_app

# すべてのテストを実行
flutter test

# 特定ディレクトリのテストのみ実行
flutter test test/screens/auth/

# カバレッジ付きテスト
flutter test --coverage
```

**テスト成功例**:
```
00:03 +42: All tests passed!
```

**カバレッジレポート**:
```bash
# LCOVファイルからHTMLレポートを生成（要genhtml）
genhtml coverage/lcov.info -o coverage/html
```

---

### 静的解析とコードフォーマット

#### TypeScript（Firebase Functions）

```bash
cd functions

# ESLintによる静的解析
npm run lint

# 自動修正
npm run lint:fix

# Prettierによるフォーマット確認
npm run format:check

# フォーマット適用
npm run format
```

#### Dart（Flutter）

```bash
cd flutter_app

# Dart analyzerによる静的解析
flutter analyze

# Dart formatterによるフォーマット
dart format lib/ test/
```

---

## 開発サーバー起動

### Flutterアプリの実行

#### エミュレーター/シミュレーターで実行

**Android Emulator起動**（Android Studio経由）:
1. Android Studioを起動
2. 「Device Manager」を開く
3. 仮想デバイスを選択して起動

**iOS Simulator起動**（macOSのみ）:
```bash
open -a Simulator
```

**Flutter実行**:
```bash
cd flutter_app

# 接続デバイス一覧確認
flutter devices

# 実行
flutter run
```

**ホットリロード**:
- アプリ実行中に`r`キーを押すと、コード変更が即座に反映されます（**ホットリロード**）
- `R`キーを押すと、アプリ全体が再起動されます（**ホットリスタート**）
- `q`キーでアプリを終了

---

#### 実機で実行（オプション）

**Android実機**:
1. スマートフォンで「開発者オプション」を有効化
2. 「USBデバッグ」をONにする
3. USBケーブルでPCと接続
4. `flutter devices`でデバイスが認識されていることを確認
5. `flutter run`で実行

**iOS実機**（macOSのみ）:
1. Apple Developer Programへの登録が必要
2. Xcodeで署名設定を行う
3. Lightning/USB-CケーブルでMacと接続
4. `flutter run`で実行

---

### Firebase Functionsのローカル実行

Firebase Functionsはエミュレーター起動時に自動でデプロイされます。

```bash
# エミュレーターを起動（functionsが含まれる）
firebase emulators:start

# または、functionsのみを起動
firebase emulators:start --only functions
```

**Cloud Functionsの呼び出しテスト**:

Emulator UI（http://localhost:4000/functions）から、デプロイされた関数を確認できます。

**コマンドラインからHTTP Callable関数を呼び出す例**:
```bash
curl -X POST \
  http://127.0.0.1:5001/tokyo-list-478804-e5/asia-northeast1/getUserProfile \
  -H 'Content-Type: application/json' \
  -d '{"data": {"userId": "test-user-id"}}'
```

---

### 開発ワークフローの例

**典型的な開発フロー**:

1. **ターミナル1**: Firebaseエミュレーター起動
   ```bash
   firebase emulators:start
   ```

2. **ターミナル2**: Flutterアプリ実行
   ```bash
   cd flutter_app
   flutter run
   ```

3. **ターミナル3**: TypeScriptビルドウォッチ（Functions開発時）
   ```bash
   cd functions
   npm run build:watch
   ```

4. **ブラウザ**: Emulator UI（http://localhost:4000）でデータ確認

---

## iOS実機テストセットアップ

このセクションでは、iPhoneやiPadの実機でFlutterアプリをテストする方法を説明します。特にMediaPipeを使用したカメラ機能のテストには、実機でのテストが必須です。

> **重要**: iOS実機テストは **macOSでのみ** 可能です。WindowsやLinuxではiOS実機テストを行うことはできません。

### なぜiOS実機テストが必要か

- **カメラ機能のテスト**: iOS Simulatorはカメラをサポートしていないため、MediaPipeによる姿勢検出機能は実機でのみテストできます
- **パフォーマンス検証**: 実際のデバイスでの処理速度（30fps目標）を確認できます
- **センサーの動作確認**: 加速度センサーやジャイロスコープの動作確認ができます
- **本番環境に近い検証**: App Store配布前の最終確認ができます

---

### 前提条件

#### 必要なハードウェア・ソフトウェア

- [ ] **macOS搭載のMac**（Intel/Apple Silicon）
- [ ] **iPhoneまたはiPad**（iOS 12以降、推奨iOS 16以降）
- [ ] **Lightning または USB-C ケーブル**（データ転送対応のもの）
- [ ] **空きストレージ**: Xcodeに最低30GB必要

#### Apple Developer Programについて

iOS実機テストには2つの方法があります:

| 項目 | 無料Apple ID | Apple Developer Program（有料） |
|------|-------------|--------------------------------|
| **費用** | 無料 | 年間99ドル（約15,000円） |
| **アプリの有効期限** | 7日間 | 1年間 |
| **テスト可能デバイス数** | 3台まで | 100台まで |
| **App Store配布** | 不可 | 可能 |
| **TestFlight利用** | 不可 | 可能 |
| **プッシュ通知** | 不可 | 可能 |

> **推奨**: 開発初期段階では無料Apple IDで十分です。App Store配布が近づいたらApple Developer Programへの登録を検討してください。

---

### Xcodeセットアップ

**推定所要時間**: 30分〜2時間（ダウンロード速度による）

#### ステップ1: Xcodeのインストール

1. **Mac App Store** を開く
2. 検索バーで「Xcode」を検索
3. 「入手」または「インストール」ボタンをクリック
4. インストール完了まで待つ（約12GB以上のダウンロード）

> **注意**: Xcodeのダウンロードは非常に大きいため、安定したWi-Fi環境で行うことを推奨します。

**インストール確認**:
```bash
# Xcodeのバージョン確認
xcode-select --version
# 出力例: xcode-select version 2397

# Xcodeのパス確認
xcode-select -p
# 出力例: /Applications/Xcode.app/Contents/Developer
```

---

#### ステップ2: Command Line Toolsのインストール

**推定所要時間**: 5〜10分

Xcodeを初めてインストールした後、または新しいバージョンにアップデートした後に必要です。

```bash
# Command Line Toolsのインストール
xcode-select --install
```

**実行すると**:
- ダイアログが表示されます
- 「インストール」をクリック
- ライセンス同意後、自動でインストールが始まります

**既にインストール済みの場合**:
```
xcode-select: error: command line tools are already installed, use "Software Update" to install updates
```
このメッセージが表示されれば、既にインストールされています。

---

#### ステップ3: Xcodeライセンス同意

**推定所要時間**: 1分

```bash
# Xcodeのライセンスに同意
sudo xcodebuild -license accept
```

管理者パスワードの入力が求められます。

---

#### ステップ4: CocoaPodsのインストール

**推定所要時間**: 5〜15分

**CocoaPods** は、iOSプロジェクトの依存関係を管理するツールです。FlutterのiOSビルドに必要です。

```bash
# CocoaPodsのインストール
sudo gem install cocoapods

# インストール確認
pod --version
# 出力例: 1.15.2
```

**Apple Silicon Mac（M1/M2/M3）で問題が発生する場合**:
```bash
# Rosetta経由でインストール
sudo arch -x86_64 gem install ffi
sudo gem install cocoapods
```

**Homebrew経由でインストールする方法（代替）**:
```bash
brew install cocoapods
```

---

#### ステップ5: Xcodeの初期設定

**推定所要時間**: 10〜30分

Xcodeを初めて起動すると、追加コンポーネントのインストールが求められます。

1. **Xcodeアプリケーションを起動**
   - Launchpadまたは`/Applications/Xcode.app`から起動

2. **追加コンポーネントのインストール**
   - ダイアログが表示されたら「Install」をクリック
   - 管理者パスワードを入力

3. **iOS Simulatorのダウンロード**（オプション）
   - Xcode → Settings（設定）→ Platforms
   - 使用したいiOSバージョンの横にある「Get」をクリック

---

### Apple ID / Developer Account設定

**推定所要時間**: 10〜15分

#### ステップ1: Xcodeにアカウントを追加

1. **Xcodeを起動**
2. メニューバーから **Xcode → Settings**（または`Cmd + ,`）
3. **Accounts** タブをクリック
4. 左下の **+** ボタンをクリック
5. **Apple ID** を選択して「Continue」
6. Apple IDとパスワードを入力してサインイン

**2ファクタ認証が有効な場合**:
- 信頼済みデバイスに送信された確認コードを入力

**成功時**:
- アカウント一覧にあなたのApple IDが表示されます
- 「Personal Team」または登録済みのチーム名が表示されます

---

#### ステップ2: チーム設定の確認

アカウント追加後、以下を確認します:

1. **Accounts**タブで追加したApple IDを選択
2. 「Manage Certificates...」をクリック
3. 左下の **+** ボタンをクリック
4. **Apple Development** を選択

**何が起きているか**:
- Appleの開発用証明書が自動的に作成されます
- この証明書により、あなたのデバイスでアプリを実行できるようになります

---

### iOSデバイスの準備

**推定所要時間**: 5〜10分

#### ステップ1: デバイスの開発者モード有効化（iOS 16以降）

iOS 16以降では、開発者モードを明示的に有効にする必要があります。

**iPhoneでの操作**:

1. **設定** アプリを開く
2. **プライバシーとセキュリティ** をタップ
3. 画面下部にスクロールして **デベロッパモード** をタップ
4. トグルを **オン** にする
5. 確認ダイアログで **再起動** をタップ
6. デバイスが再起動後、再度確認ダイアログが表示されたら **オンにする** をタップ

> **注意**: iOS 15以前では、この設定は不要です。自動的に開発者モードが有効になります。

---

#### ステップ2: Macとの接続

1. **LightningまたはUSB-Cケーブル** でiPhoneとMacを接続
2. iPhone画面に「このコンピュータを信頼しますか？」というダイアログが表示されます
3. **信頼** をタップ
4. デバイスのパスコードを入力

**接続確認（ターミナル）**:
```bash
# 接続されたiOSデバイスの一覧表示
flutter devices

# 出力例:
# 2 connected devices:
#
# iPhone 15 Pro (mobile) • 00008110-xxxxxxxxxxxx • ios • iOS 17.x.x
# macOS (desktop)        • macos                 • darwin-arm64 • macOS 14.x.x
```

**デバイスが表示されない場合**:
- ケーブルがデータ転送対応か確認（充電専用ケーブルでは不可）
- 「信頼」ダイアログを見逃していないか確認
- ケーブルを抜き差しして再試行
- 別のUSBポートを試す

---

### Flutterプロジェクト設定

**推定所要時間**: 15〜30分

#### ステップ1: Xcodeでプロジェクトを開く

```bash
# プロジェクトのiOSディレクトリに移動
cd flutter_app/ios

# Xcodeでワークスペースを開く
open Runner.xcworkspace
```

> **重要**: `Runner.xcodeproj`ではなく、必ず`Runner.xcworkspace`を開いてください。ワークスペースにはCocoaPodsの依存関係が含まれています。

---

#### ステップ2: Signing & Capabilitiesの設定

1. **Xcodeの左サイドバー** で「Runner」プロジェクトを選択
2. **TARGETS** セクションで「Runner」を選択
3. **Signing & Capabilities** タブをクリック
4. 以下を設定:

**Team**:
- ドロップダウンから自分のApple ID（Personal Team）またはチームを選択

**Bundle Identifier**:
- デフォルト: `com.example.flutterApp`
- ユニークな値に変更（例: `com.yourname.aifitnessapp`）

> **重要**: Bundle Identifierは世界中でユニークである必要があります。自分の名前やドメインを含めることを推奨します。

**Automatically manage signing**:
- チェックを **オン** にする（推奨）
- Xcodeが自動的にProvisioning Profileを作成・管理します

**設定画面のイメージ**:
```
┌─────────────────────────────────────────────────────────┐
│ Signing & Capabilities                                  │
├─────────────────────────────────────────────────────────┤
│ ☑ Automatically manage signing                         │
│                                                         │
│ Team:       Your Name (Personal Team)        [▼]       │
│ Bundle Identifier: com.yourname.aifitnessapp           │
│ Provisioning Profile: Xcode Managed Profile            │
│ Signing Certificate: Apple Development: your@email.com │
└─────────────────────────────────────────────────────────┘
```

---

#### ステップ3: Info.plistの確認（カメラ権限）

MediaPipeによるカメラ機能を使用するため、カメラアクセスの権限設定が必要です。

**確認方法**:
1. Xcodeの左サイドバーで `Runner → Runner → Info.plist` を開く
2. 以下のキーが存在することを確認:

```xml
<key>NSCameraUsageDescription</key>
<string>トレーニングフォームの姿勢を検出するためにカメラを使用します</string>
```

**キーがない場合は追加**:
1. `Info.plist`を右クリック → Open As → Source Code
2. `<dict>`タグ内に上記の設定を追加

---

### 実機へのデプロイ

**推定所要時間**: 5〜15分（初回）

#### ステップ1: デバイス認識確認

```bash
# flutter_appディレクトリで実行
cd flutter_app

# 接続デバイスの確認
flutter devices
```

**出力例**:
```
3 connected devices:

iPhone 15 Pro (mobile) • 00008110-xxxxxxxxxxxx • ios            • iOS 17.x.x
macOS (desktop)        • macos                 • darwin-arm64  • macOS 14.x.x
Chrome (web)           • chrome                • web-javascript • Google Chrome 120.x.x
```

---

#### ステップ2: Flutterアプリの実行

```bash
# 特定のデバイスで実行（デバイスIDを指定）
flutter run -d 00008110-xxxxxxxxxxxx

# または、デバイス名の一部で指定
flutter run -d "iPhone"
```

**初回ビルド時に表示されるメッセージ**:
```
Running pod install...
Launching lib/main.dart on iPhone 15 Pro in debug mode...
Running Xcode build...
Xcode build done.
Installing and launching...
```

**所要時間**: 初回ビルドは3〜10分程度かかります。2回目以降は高速になります。

---

#### ステップ3: 初回実行時の「信頼されていないデベロッパ」対応

**重要**: 無料Apple IDを使用している場合、初回実行時に以下のエラーが発生します:

**iPhoneに表示されるダイアログ**:
```
信頼されていないデベロッパ
iPhoneでこのAppのデベロッパを信頼するには、
「設定」>「一般」>「VPNとデバイス管理」に移動してください。
```

**解決手順**（iPhoneでの操作）:

1. **設定** アプリを開く
2. **一般** をタップ
3. **VPNとデバイス管理** をタップ
   - iOS 15以前では「プロファイルとデバイス管理」または「デバイス管理」
4. **デベロッパApp** セクションに自分のApple ID（メールアドレス）が表示されます
5. そのApple IDをタップ
6. **「[Apple ID]を信頼」** をタップ
7. 確認ダイアログで **信頼** をタップ

**信頼設定後**:
- 再度`flutter run`を実行するか、iPhone上でアプリアイコンをタップして起動

---

#### ステップ4: デバッグ実行の確認

アプリが正常に起動すると、ターミナルに以下のように表示されます:

```
Syncing files to device iPhone 15 Pro...
 8,456ms (!)

Flutter run key commands.
r Hot reload.
R Hot restart.
h List all available interactive commands.
d Detach (terminate "flutter run" but leave application running).
c Clear the screen
q Quit (terminate the application on the device).

Running with unsound null safety
For more information see https://dart.dev/null-safety/unsound-null-safety

An Observatory debugger and profiler on iPhone 15 Pro is available at: http://127.0.0.1:xxx/xxx=/
The Flutter DevTools debugger and profiler on iPhone 15 Pro is available at: http://127.0.0.1:xxx?uri=xxx
```

**ホットリロード**:
- コード変更後、ターミナルで`r`キーを押すと即座に反映されます

---

### MediaPipeテスト時の注意事項

MediaPipeを使用したフォーム評価機能をテストする際の重要なポイントです。

#### カメラパーミッション

アプリ初回起動時にカメラアクセス許可のダイアログが表示されます:

```
「AI Fitness App」がカメラへのアクセスを求めています

トレーニングフォームの姿勢を検出するためにカメラを使用します

       [許可しない]  [OK]
```

**「OK」をタップ** してカメラアクセスを許可してください。

**誤って「許可しない」をタップした場合**:
1. **設定** アプリを開く
2. 下にスクロールして **AI Fitness App**（または該当するアプリ名）をタップ
3. **カメラ** のトグルをオンにする

---

#### パフォーマンス確認ポイント

MediaPipeの姿勢検出は以下のパフォーマンス目標を満たす必要があります（NFR-024, NFR-025参照）:

| 指標 | 目標値 | 確認方法 |
|------|--------|----------|
| **フレームレート** | 30fps以上 | DevToolsのPerformanceタブ |
| **処理遅延** | 100ms以下 | ログ出力またはDevTools |
| **メモリ使用量** | 500MB以下 | DevToolsのMemoryタブ |

**パフォーマンス計測コマンド**:
```bash
# パフォーマンスプロファイルモードで実行
flutter run --profile -d "iPhone"
```

> **注意**: `--profile`モードは実機でのみ使用できます。Simulatorでは使用できません。

---

#### 低照度環境でのテスト

MediaPipeの検出精度は照明条件に影響されます。以下の環境でテストすることを推奨します:

- **十分な照明がある明るい部屋**（基準テスト）
- **窓際の逆光環境**（困難な条件）
- **夕方の薄暗い室内**（低照度条件）
- **蛍光灯のちらつきがある環境**（フリッカー条件）

---

### 無料Apple IDの制限事項

無料Apple IDで開発する場合、以下の制限があります:

1. **7日間の有効期限**
   - 7日後にアプリが起動できなくなります
   - 解決方法: `flutter clean`後に再度`flutter run`でインストールし直す

2. **同時に3つのアプリまで**
   - 4つ目のアプリをインストールすると、最も古いアプリが無効になります

3. **特定の機能が使用不可**
   - プッシュ通知
   - Apple Pay
   - iCloud
   - ゲームセンター

4. **Bundle ID の変更が必要な場合がある**
   - エラーが発生した場合、Bundle IDを新しいものに変更

---

## トラブルシューティング

### よくあるエラーと解決方法

#### 0. iOS実機テスト関連のエラー

##### "No signing certificate" エラー

**エラー例**:
```
No signing certificate "iOS Development" found
```

**原因**: 開発用証明書が作成されていない

**解決方法**:
1. Xcodeを開く
2. Xcode → Settings → Accounts
3. 自分のApple IDを選択
4. 「Manage Certificates...」をクリック
5. 左下の「+」→「Apple Development」を選択

---

##### "Could not find a valid development team" エラー

**エラー例**:
```
Could not find a valid 'Development Team' in Xcode project
```

**原因**: XcodeでTeamが選択されていない

**解決方法**:
1. `flutter_app/ios/Runner.xcworkspace`をXcodeで開く
2. Runner → TARGETS → Runner → Signing & Capabilities
3. Teamドロップダウンで自分のApple ID（Personal Team）を選択

---

##### デバイスが認識されない

**症状**: `flutter devices`でiOSデバイスが表示されない

**確認事項**:
1. ケーブルがデータ転送対応か確認
2. iPhone側で「このコンピュータを信頼」を実行したか確認
3. iOS 16以降の場合、デベロッパモードが有効か確認

**追加の解決方法**:
```bash
# Xcodeのデバイスリストを更新
xcrun devicectl list devices

# iOSデバイスのペアリングをリセット
xcrun devicectl unpair --device <device-identifier>
# ケーブルを抜き差しして再ペアリング
```

---

##### CocoaPods関連エラー

**エラー例**:
```
Error running pod install
```

**解決方法**:
```bash
cd flutter_app/ios

# CocoaPodsのキャッシュクリア
pod cache clean --all

# Podfileのロックファイルを削除
rm -rf Pods Podfile.lock

# Flutterの依存関係を再取得
cd ..
flutter clean
flutter pub get

# 再度pod install
cd ios
pod install --repo-update
```

**Apple Silicon Macで問題が発生する場合**:
```bash
# Rosetta経由でpod install
arch -x86_64 pod install
```

---

##### Provisioning Profile エラー

**エラー例**:
```
Provisioning profile "iOS Team Provisioning Profile: *" doesn't include the
currently selected device
```

**原因**: デバイスがProvisioning Profileに登録されていない

**解決方法**:
1. Xcodeで Runner.xcworkspace を開く
2. Runner → TARGETS → Runner → Signing & Capabilities
3. 「Automatically manage signing」を一度オフにして再度オンにする
4. Xcodeが自動的にデバイスを登録します

**それでも解決しない場合**:
1. Apple Developer（https://developer.apple.com）にログイン
2. Certificates, Identifiers & Profiles → Devices
3. 手動でデバイスを追加（UDID必要）

**UDIDの確認方法**:
```bash
# 接続したデバイスのUDIDを表示
xcrun devicectl list devices
```

---

##### "Unable to install" エラー

**エラー例**:
```
Unable to install "Runner"
```

**よくある原因と解決方法**:

1. **iPhone のストレージ不足**
   - 設定 → 一般 → iPhoneストレージで空き容量を確認
   - 不要なアプリやデータを削除

2. **同じBundle IDのアプリが既にインストールされている**
   - iPhone上の該当アプリを削除してから再試行

3. **Provisioning Profileの問題**
   - Xcodeで「Automatically manage signing」をオフ→オンにする

---

##### Xcodeバージョンの不一致

**エラー例**:
```
Xcode 15.0 or later is required to develop for iOS
```

**原因**: 使用しているiOSバージョンに対応したXcodeがインストールされていない

**解決方法**:
- Mac App StoreでXcodeを最新版にアップデート
- または、[Apple Developer](https://developer.apple.com/download/more/)から特定バージョンをダウンロード

**iOSバージョンとXcodeの対応表（参考）**:
| iOS | 必要なXcode |
|-----|-------------|
| iOS 17.x | Xcode 15.x以上 |
| iOS 16.x | Xcode 14.x以上 |
| iOS 15.x | Xcode 13.x以上 |

---

#### 1. Node.jsのバージョンが古い

**エラー例**:
```
Error: The engines field in the functions/package.json states that you need node 24 but you are using node 18.x.x
```

**原因**: Node.jsのバージョンが要件を満たしていない

**解決方法**:
```bash
# nvmを使用している場合
nvm install 24
nvm use 24

# 公式インストーラーの場合、Node.js 24をダウンロードして再インストール
```

---

#### 2. Flutterのバージョンが合わない

**エラー例**:
```
The current Dart SDK version is 3.x.x.
Because flutter_app requires SDK version ^3.10.0, version solving failed.
```

**原因**: Flutter/Dartのバージョンが古い

**解決方法**:
```bash
# Flutterを最新に更新
flutter upgrade

# バージョン確認
flutter --version
```

---

#### 3. firebase loginが失敗する

**エラー例**:
```
Error: Cannot run login in non-interactive mode.
```

**原因**: ターミナルが対話モードに対応していない、またはブラウザが起動できない

**解決方法**:
```bash
# CI/CD環境やリモート接続の場合
firebase login:ci

# 生成されたトークンを環境変数に設定
export FIREBASE_TOKEN=your-token-here
```

---

#### 4. Firebaseエミュレーターのポートが既に使用されている

**エラー例**:
```
Port 4000 is not open on 127.0.0.1, could not start Emulator Hub
```

**原因**: 別のプロセスが同じポートを使用している

**解決方法**:

**Windows**:
```powershell
# ポート4000を使用しているプロセスを確認
netstat -ano | findstr :4000

# プロセスIDを確認し、タスクマネージャーで終了
# または
taskkill /PID [プロセスID] /F
```

**macOS/Linux**:
```bash
# ポート4000を使用しているプロセスを確認
lsof -i :4000

# プロセスを終了
kill -9 [プロセスID]
```

**または、firebase.jsonでポートを変更**:
```json
{
  "emulators": {
    "ui": {
      "port": 4001  // 別のポートに変更
    }
  }
}
```

---

#### 5. flutter pub getが失敗する

**エラー例**:
```
Git error: Command 'git' not found
```

**原因**: Gitがインストールされていない、またはPATHに追加されていない

**解決方法**:
1. [Git公式サイト](https://git-scm.com/)からGitをダウンロード・インストール
2. ターミナルを再起動
3. `git --version`で確認

---

#### 6. Android Emulatorが起動しない

**エラー例**:
```
HAXM is not installed
```

**原因**: Intel HAXMまたはAMD仮想化が有効化されていない

**解決方法**:

**Windows（Intel CPU）**:
1. BIOSで「Intel Virtualization Technology (VT-x)」を有効化
2. Windows機能で「Hyper-V」を無効化（競合するため）
3. Android Studio → SDK Manager → SDK Tools → 「Intel x86 Emulator Accelerator (HAXM installer)」をインストール

**macOS**:
- 通常は自動で有効。M1/M2 Macの場合はARMエミュレーターを使用

**代替案**: 実機を使用する

---

#### 7. iOS Simulatorが起動しない（macOSのみ）

**エラー例**:
```
Unable to boot device in current state: Booted
```

**原因**: Simulatorが異常な状態

**解決方法**:
```bash
# すべてのシミュレーターをシャットダウン
xcrun simctl shutdown all

# Simulatorキャッシュのクリア
xcrun simctl erase all

# Xcodeを再起動
```

---

#### 8. Firebase Functionsのビルドが失敗する

**エラー例**:
```
Error: Cannot find module 'firebase-admin'
```

**原因**: 依存パッケージがインストールされていない

**解決方法**:
```bash
cd functions

# node_modulesとpackage-lock.jsonを削除
rm -rf node_modules package-lock.json

# 再インストール
npm install
```

---

#### 9. dart run build_runnerが失敗する

**エラー例**:
```
[SEVERE] build_runner:entrypoint on lib/main.dart:
Conflicting outputs were detected
```

**原因**: 既存の生成ファイルと競合

**解決方法**:
```bash
cd flutter_app

# 競合する出力を自動削除して再生成
dart run build_runner build --delete-conflicting-outputs

# または、Flutterプロジェクト全体をクリーン
flutter clean
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

---

#### 10. Firestoreエミュレーターのデータが消える

**原因**: エミュレーター停止時にデータが揮発する（デフォルト動作）

**解決方法**: データを永続化する

```bash
# エミュレーター停止前にエクスポート
firebase emulators:export ./emulator-data

# 次回起動時にインポート
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

`--export-on-exit`オプションにより、エミュレーター停止時に自動でエクスポートされます。

---

### その他のトラブルシューティングリソース

- [Firebase公式ドキュメント](https://firebase.google.com/docs)
- [Flutter公式ドキュメント](https://docs.flutter.dev/)
- [プロジェクト内の詳細トラブルシューティング](C:\Users\katos\Desktop\ai_fitness_app\docs\Firebase_トラブルシューティング_詳細版.md)

---

## 次のステップ

開発環境のセットアップが完了したら、以下のドキュメントを参照して開発を進めてください。

### 必読ドキュメント

1. **[CLAUDE.md](C:\Users\katos\Desktop\ai_fitness_app\CLAUDE.md)**
   - プロジェクトの開発ルール、制約事項、コーディング規約

2. **[要件定義書](C:\Users\katos\Desktop\ai_fitness_app\docs\specs\00_要件定義書_v3_3.md)**
   - 38の機能要件（FR-001〜FR-038）
   - 37の非機能要件（NFR-001〜NFR-037）

3. **[システムアーキテクチャ設計書](C:\Users\katos\Desktop\ai_fitness_app\docs\specs\01_システムアーキテクチャ設計書_v3_2.md)**
   - 全体のシステム構成とデータフロー

---

### 開発タスク

開発タスクは`docs/tickets/`ディレクトリに番号付きで管理されています。

**Phase 1（0-2ヶ月）のタスク例**:
- `001_firebase_project_setup.md` - Firebaseプロジェクトセットアップ（完了済み）
- `002_firestore_security_rules.md` - Firestoreセキュリティルール実装
- `003_firebase_authentication.md` - Firebase認証機能実装（完了済み）
- `004_cloud_functions_infrastructure.md` - Cloud Functions基盤構築（完了済み）

現在は**Phase 1-2**の実装段階です。

---

### よく使うコマンドのクイックリファレンス

詳細は[Firebase クイックリファレンス](C:\Users\katos\Desktop\ai_fitness_app\docs\Firebase_クイックリファレンス.md)を参照してください。

**Firebase**:
```bash
firebase emulators:start           # エミュレーター起動
firebase deploy --only functions   # Functionsのみデプロイ
firebase projects:list             # プロジェクト一覧
```

**Flutter**:
```bash
flutter run                        # アプリ実行
flutter test                       # テスト実行
flutter analyze                    # 静的解析
flutter clean                      # ビルドキャッシュクリア
```

**Firebase Functions**:
```bash
npm test                           # テスト実行
npm run lint                       # 静的解析
npm run build                      # TypeScriptビルド
```

---

### コミュニティとサポート

**質問・相談先**:
- プロジェクトのIssueトラッカー
- チームのSlack/Discordチャンネル

**公式リソース**:
- [Flutter公式Discord](https://discord.gg/flutter)
- [Firebase公式サポート](https://firebase.google.com/support)
- [Stack Overflow（flutter/firebase タグ）](https://stackoverflow.com/questions/tagged/flutter+firebase)

---

## まとめ

このガイドに従って、以下の環境が整いました:

- [x] Node.js 24のインストール
- [x] Flutter 3.xのインストール
- [x] Firebase CLIのインストール
- [x] プロジェクトの依存関係インストール
- [x] Firebaseエミュレーターの起動
- [x] テストの実行
- [x] Flutterアプリのローカル実行

**これでAI Fitness Appの開発が開始できます！**

不明な点があれば、本ガイドのトラブルシューティングセクションや、プロジェクトの他のドキュメントを参照してください。

Happy Coding!

---

**ドキュメント履歴**:
- 2025-12-01: iOS実機テストセットアップセクション追加
- 2025-12-01: 初版作成
