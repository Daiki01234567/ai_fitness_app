# Firebase セットアップ手順書

**プロジェクト名**: AIフィットネスアプリ
**対象Firebase プロジェクト**: `tokyo-list-478804-e5`
**作成日**: 2025年11月29日
**対象対象ユーザー**: 開発チーム、運用担当者

---

## 概要

このドキュメントは、Firebase プロジェクト `tokyo-list-478804-e5` を本格的に運用可能な状態にするための手順を説明します。

### 現在の状態

| 項目 | 状態 | 備考 |
|------|------|------|
| Firebase プロジェクト | 作成済み | `tokyo-list-478804-e5` |
| Firebase Core | 未有効 | 手順1で有効化が必要 |
| Firestore | 未作成 | 手順2で作成が必要 |
| Authentication | 未有効 | 手順3で有効化が必要 |
| Firebase アプリ登録 | 未完了 | 手順4で iOS/Android を登録 |
| Flutter 設定 | 異なるプロジェクト参照中 | 現在 `ai-fitness-c38f0` を参照 |

### 完了時の状態

- Firebase Core サービスが有効化されている
- Firestore データベースが本番モード（ロックされたセキュリティルール）で実行中
- Firebase Authentication が有効で、認証プロバイダが設定されている
- iOS/Android/Web アプリが Firebase プロジェクトに登録されている
- Flutter アプリが正しい Firebase プロジェクト設定を参照している
- エミュレータが正常に動作している

---

## 手順1: Firebase コンソール へのアクセス

### 1.1 ブラウザを開く

https://console.firebase.google.com にアクセスします。

### 1.2 プロジェクトの選択

Firebase コンソール の左上メニューから `tokyo-list-478804-e5` を選択します。

**期待される画面**: プロジェクトの概要ページが表示されます。

---

## 手順2: Firebase Core サービスの有効化

### 2.1 プロジェクト設定を開く

1. Firebase コンソール で、左上の歯車アイコン (⚙️) をクリック
2. 「プロジェクト設定」を選択

### 2.2 課金の確認

「課金」タブで以下を確認：
- Blaze プラン が有効になっているか
- クレジットカード情報が登録されているか

**重要**: Firebase Functions、BigQuery、Cloud Logging には課金が発生します。

---

## 手順3: Firestore データベースの作成

### 3.1 Firestore へアクセス

1. Firebase コンソール の左メニューから「Firestore Database」を選択

### 3.2 データベースの作成

1. 「データベースを作成」ボタンをクリック

2. 以下の設定で作成：

| 項目 | 値 | 備考 |
|------|------|------|
| **セキュリティルール** | 本番モード | ロックされた状態で開始 |
| **ロケーション** | `asia-northeast1`(東京) | アプリサーバーと同じリージョン |

3. 「作成」をクリック

**期待される状態**: Firestore コンソール が開き、空のデータベースが表示されます。

### 3.3 セキュリティルールの確認

1. Firestore コンソール で「ルール」タブを選択
2. 以下のようなロックされたルールが表示されていることを確認：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**備考**: 本番運用では、このルールを設計書に基づきアップデートします。

---

## 手順4: Firebase Authentication の有効化

### 4.1 Authentication へアクセス

1. Firebase コンソール の左メニューから「Authentication」を選択

### 4.2 認証プロバイダの設定

1. 「Sign-in method」タブを選択
2. 以下の認証プロバイダを有効化：

#### 4.2.1 メール/パスワード

1. 「メール/パスワード」を選択
2. 「有効にする」をオン
3. 「メールリンク（パスワードレス）」はオフのままで OK
4. 「保存」をクリック

#### 4.2.2 Google (オプション - iOS/Android 実機テスト時に必要)

1. 「Google」を選択
2. 「有効にする」をオン
3. 「プロジェクトのサポートメール」を確認
4. 「保存」をクリック

**備考**: Google Sign-In の詳細設定（OAuth スコープ等）は、後の Cloud Functions 設定時に行います。

---

## 手順5: Firebase アプリの登録

Firebase アプリケーション（iOS/Android/Web）をプロジェクトに登録します。

### 5.1 Web アプリの登録

1. Firebase コンソール で左メニューの「プロジェクト設定」を選択
2. 「アプリ」タブをクリック
3. 「アプリを追加」 > 「Web」を選択

設定例：

| 項目 | 値 | 備考 |
|------|------|------|
| **アプリの名前** | `ai-fitness-web` | 識別可能な名前を付与 |
| **Firebase SDK の初期化** | コピーして保存 | 後の Flutter 設定で使用 |

### 5.2 Android アプリの登録

1. Firebase コンソール で「プロジェクト設定」> 「アプリ」タブ
2. 「アプリを追加」 > 「Android」を選択

設定例：

| 項目 | 値 | 備考 |
|------|------|------|
| **Android パッケージ名** | `com.example.ai_fitness` | 後で変更可（開発用） |
| **デバッグ署名証明書 SHA-1** | 手順5.3で取得 | Google Sign-In で必要 |
| **アプリの昵称** | `AI Fitness (Android)` | |

**Android 署名証明書の取得**:

```bash
# ローカル開発機上で実行（Windows）
# keytool は Java に含まれています

# デバッグ署名証明書の SHA-1 を取得
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

または

```bash
# macOS / Linux の場合
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

出力結果から **SHA1** の行をコピーし、Firebase コンソール に入力します。

### 5.3 iOS アプリの登録

1. Firebase コンソール で「プロジェクト設定」> 「アプリ」タブ
2. 「アプリを追加」 > 「iOS」を選択

設定例：

| 項目 | 値 | 備考 |
|------|------|------|
| **iOS バンドル ID** | `com.example.ai-fitness` | 後で変更可（開発用） |
| **アプリの昵称** | `AI Fitness (iOS)` | |

`GoogleService-Info.plist` がダウンロードされます。このファイルは手順6で使用します。

---

## 手順6: Flutter アプリの Firebase 設定を再生成

現在、Flutter アプリは異なる Firebase プロジェクト `ai-fitness-c38f0` を参照しています。このステップで、正しい `tokyo-list-478804-e5` プロジェクトを参照するよう設定を再生成します。

### 前提条件

以下がインストールされていることを確認：

```bash
# Flutter SDK の確認
flutter doctor

# Firebase CLI の確認（バージョン 13.0.0 以上推奨）
firebase --version

# FlutterFire CLI のインストール
dart pub global activate flutterfire_cli
```

### 6.1 FlutterFire CLI で Firebase 設定を再生成

プロジェクトのルートディレクトリで以下を実行：

```bash
# プロジェクトルートに移動
cd C:\Users\katos\Desktop\ai_fitness_app

# Firebase プロジェクト設定を再生成
flutterfire configure \
  --project=tokyo-list-478804-e5 \
  --ios-bundle-id=com.example.ai-fitness \
  --android-package-name=com.example.ai_fitness
```

**何が起きるのか**:
1. Firebase プロジェクトのメタデータが取得される
2. `flutter_app/lib/firebase_options.dart` が自動生成される
3. iOS の `GoogleService-Info.plist` が配置される
4. Android の `google-services.json` が配置される

### 6.2 生成ファイルの確認

#### 6.2.1 firebase_options.dart

```bash
# ファイルの存在確認
ls flutter_app/lib/firebase_options.dart
```

**確認内容**:

```dart
projectId: 'tokyo-list-478804-e5',  // 東京プロジェクトを参照していることを確認
```

#### 6.2.2 iOS 設定

```bash
# GoogleService-Info.plist の確認
ls flutter_app/ios/Runner/GoogleService-Info.plist
```

#### 6.2.3 Android 設定

```bash
# google-services.json の確認
ls flutter_app/android/app/google-services.json
```

### 6.3 Flutter パッケージの更新

```bash
cd flutter_app
flutter pub get
```

---

## 手順7: Firebase Functions の設定

### 7.1 環境セットアップ

```bash
# プロジェクトルートに移動
cd C:\Users\katos\Desktop\ai_fitness_app

# Cloud Functions の依存パッケージをインストール
cd functions
npm install
```

### 7.2 Cloud Functions の初期化（必要に応じて）

```bash
# Firebase でログイン
firebase login

# 現在のプロジェクト設定を確認
firebase use tokyo-list-478804-e5
```

### 7.3 Cloud Functions の組み込み設定を確認

`functions/src/index.ts` で以下のグローバル設定が存在することを確認：

```typescript
setGlobalOptions({
  region: "asia-northeast1",  // 東京リージョン
  maxInstances: 10,           // コスト制御
  memory: "256MiB",
  timeoutSeconds: 60,
});
```

---

## 手順8: Firebase エミュレータのセットアップ

ローカル開発時に Firebase サービスをシミュレートするエミュレータをセットアップします。

### 8.1 Firebase Emulator Suite のインストール確認

```bash
# Firebase CLI がインストールされていることを確認
firebase --version

# エミュレータが利用可能か確認
firebase emulators:exec --help
```

### 8.2 エミュレータの起動

```bash
# プロジェクトルートに移動
cd C:\Users\katos\Desktop\ai_fitness_app

# エミュレータを起動（すべてのサービス）
firebase emulators:start
```

**期待される出力**:

```
Emulator Suite started, it is now safe to connect your apps.

Auth Emulator running on http://127.0.0.1:9099
Firestore Emulator running on http://127.0.0.1:8080
Functions Emulator running on http://127.0.0.1:5001
Storage Emulator running on http://127.0.0.1:9199
Emulator UI available at http://localhost:4000
```

### 8.3 Emulator UI にアクセス

ブラウザで http://localhost:4000 を開き、エミュレータの UI を確認します。

**確認内容**:
- Firestore コレクション表示
- Authentication ユーザー登録
- Cloud Functions ログ

### 8.4 エミュレータの停止

```bash
# Ctrl+C を押す（ターミナルで）
```

---

## 手順9: Flutter アプリの起動テスト

### 9.1 エミュレータモード での起動

Flutter アプリをエミュレータで実行して、Firebase 接続をテストします。

#### 9.1.1 iOS シミュレータで実行

```bash
cd flutter_app

# iOS 依存関係のセットアップ
flutter pub get
cd ios
pod install
cd ..

# iOS シミュレータで実行
flutter run -d all
```

または特定のシミュレータを指定：

```bash
# 利用可能なデバイスを確認
flutter devices

# 特定のシミュレータで実行
flutter run -d "iPhone 15"
```

#### 9.1.2 Android エミュレータで実行

```bash
cd flutter_app

# Android 依存関係のセットアップ
flutter pub get

# Android エミュレータを起動（Android Studio の Device Manager で）
# その後、以下を実行
flutter run
```

### 9.2 実行時に Firebase エミュレータに接続

`flutter_app/lib/main.dart` で Firebase 初期化時にエミュレータ接続を設定します。

**現在のコード例**:

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 開発環境でエミュレータを使用
  if (kDebugMode) {
    await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
    await FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);
    await FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001);
  }

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const MyApp());
}
```

### 9.3 ログイン画面でのテスト

アプリが起動したら：

1. 「新規登録」をクリック
2. テストメール（例：`test@example.com`）と パスワードを入力
3. 登録が成功したら Firebase Auth が接続されている状態です

**期待される結果**: ログイン画面 > ホーム画面への遷移

---

## 手順10: GitHub Actions/CI パイプラインの更新

CI パイプライン (GitHub Actions) が正しい Firebase プロジェクトにデプロイするよう設定を確認します。

### 10.1 GitHub Secrets の確認

リポジトリの GitHub > Settings > Secrets に以下の値が設定されていることを確認：

| Secret 名 | 用途 | 例 |
|-----------|------|-----|
| `FIREBASE_PROJECT_ID` | デプロイ先プロジェクト | `tokyo-list-478804-e5` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK 認証キー | JSON（秘密） |
| `GCP_PROJECT_ID` | GCP プロジェクト ID | `tokyo-list-478804-e5` |

### 10.2 Firebase Service Account キーの生成

Firebase プロジェクト設定 > 「サービスアカウント」タブ から：

1. 「新しい秘密鍵を生成」をクリック
2. JSON ファイルがダウンロードされます
3. ファイル内容全体を `FIREBASE_SERVICE_ACCOUNT_KEY` Secret に設定

**警告**: このキーは秘密です。Git リポジトリに追加しないでください。

### 10.3 デプロイパイプラインの確認

`.github/workflows/deploy.yml` など に以下が含まれていることを確認：

```yaml
- name: Deploy to Firebase
  env:
    FIREBASE_PROJECT_ID: tokyo-list-478804-e5
  run: |
    npm install -g firebase-tools
    firebase deploy --project $FIREBASE_PROJECT_ID --token ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
```

---

## 手順11: セキュリティルールのデプロイ

Firestore と Firebase Storage のセキュリティルールを本番運用向けにデプロイします。

### 11.1 セキュリティルールファイルの確認

```bash
# Firestore ルール
cat firebase/firestore.rules

# Storage ルール
cat firebase/storage.rules
```

### 11.2 セキュリティルールのデプロイ

```bash
# プロジェクトルートで実行
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

**出力例**:

```
i  deploying firestore
i  firestore: checking firestore.rules for compilation errors...
✔  firestore: rules file compiled successfully
i  firestore: uploading rules...
✔  firestore: released new rules to cloud.firestore
```

### 11.3 ルールの検証

Firebase コンソール > Firestore > ルール タブで、デプロイされたルールが表示されていることを確認します。

---

## 手順12: BigQuery の初期セットアップ（オプション）

BigQuery データウェアハウスをセットアップします（Phase 1 では使用していませんが、Phase 2 で必要）。

### 12.1 BigQuery データセットの作成

```bash
# Google Cloud SDK がインストール済みであることを確認
gcloud --version

# BigQuery データセットを作成
gcloud bq datasets create \
  --location=asia-northeast1 \
  --description="AI Fitness App Analytics" \
  ai_fitness_analytics
```

### 12.2 テーブル構造の確認

分析テーブルスキーマは `docs/specs/04_BigQuery設計書_v3_3.md` を参照してください。

---

## 手順13: Cloud Logging と Cloud Monitoring のセットアップ

本番環境の問題検出と監視を実現します。

### 13.1 ログビューアの確認

Firebase コンソール > Logs Router で以下が表示されることを確認：

```
resource.type="cloud_function"
resource.labels.function_name="*"
```

### 13.2 ロギングの設定確認

`functions/src/utils/logger.ts` で正しくロギングが設定されていることを確認：

```typescript
import { logger } from "firebase-functions";

// 情報ログ
logger.info("Session created", { userId, sessionId });

// エラーログ
logger.error("Database error", error);
```

### 13.3 アラート設定（オプション）

本番運用時には、以下をお勧めします：

- Cloud Functions エラー率が 5% を超えたときのアラート
- Firestore の読み取り/書き込みの遅延が 100ms を超えたときのアラート

---

## チェックリスト: 全セットアップ完了確認

セットアップが完了したことを確認するためのチェックリスト：

### インフラストラクチャ層

- [ ] Firebase プロジェクト `tokyo-list-478804-e5` が GCP コンソールで表示されている
- [ ] Firestore データベースが本番モードで実行中（asia-northeast1）
- [ ] Firebase Authentication が有効で、メール/パスワード認証が設定されている
- [ ] Firebase Storage が有効（ファイルアップロード用）
- [ ] BigQuery データセット `ai_fitness_analytics` が作成されている（オプション）

### アプリケーション層

- [ ] `flutter_app/lib/firebase_options.dart` が `tokyo-list-478804-e5` を参照している
- [ ] iOS の `GoogleService-Info.plist` が配置されている
- [ ] Android の `google-services.json` が配置されている
- [ ] `functions/src/index.ts` にグローバル設定が含まれている

### ローカル開発環境

- [ ] Firebase Emulator Suite が起動でき、すべてのサービスが利用可能（ポート 8080, 5001, 9099, 9199）
- [ ] Emulator UI (localhost:4000) にアクセスできる
- [ ] Flutter アプリがシミュレータ/エミュレータで起動できる
- [ ] ログイン/新規登録テストが成功する

### CI/CD パイプライン

- [ ] GitHub Secrets に `FIREBASE_PROJECT_ID` と `FIREBASE_SERVICE_ACCOUNT_KEY` が設定されている
- [ ] GitHub Actions デプロイワークフローが正しく設定されている

### セキュリティ・ガバナンス

- [ ] Firestore セキュリティルールが本番環境にデプロイされている
- [ ] Firebase Storage ルールが本番環境にデプロイされている
- [ ] Cloud Logging でアプリケーションログが出力されている

---

## トラブルシューティング

### Firebase Core が無効と表示される

**症状**: Firebase コンソール でプロジェクトにアクセスできない

**対処法**:
1. 課金が有効になっているか確認（手順2）
2. ブラウザキャッシュをクリア
3. 別のブラウザで再度アクセス

### Firestore 接続エラー

**症状**: Flutter アプリで `PlatformException(ERROR_UNAVAILABLE, ...)`

**対処法**:
1. Firebase コンソール で Firestore が実行中か確認
2. セキュリティルール が読み取り拒否していないか確認
3. エミュレータを使用している場合、ポート 8080 が開いているか確認

```bash
# ポート確認（Windows）
netstat -ano | findstr :8080

# ポート確認（macOS/Linux）
lsof -i :8080
```

### FlutterFire CLI の実行失敗

**症状**: `flutterfire configure` コマンドが失敗

**対処法**:

```bash
# FlutterFire CLI を再インストール
dart pub global activate --overwrite flutterfire_cli

# パスを確認
dart pub global list

# 問題が続く場合、Firebase CLI をインストール
npm install -g firebase-tools

# Firebase にログイン
firebase login
```

### Android 署名証明書が見つからない

**症状**: keytool コマンドがファイルを見つけられない

**対処法**:

```bash
# Android SDK ホームディレクトリを確認
echo %ANDROID_SDK_ROOT%

# デバッグストアの場所を確認
dir %USERPROFILE%\.android\

# keytool が見つからない場合、Java をインストール
# https://www.oracle.com/java/technologies/downloads/
```

### エミュレータのポートが既に使用されている

**症状**: `EADDRINUSE` エラー

**対処法**:

```bash
# プロセスを確認して終了
# Windows
taskkill /F /PID <PID>

# または、別のポートを使用
firebase emulators:start --port 5002
```

---

## 次のステップ

セットアップが完了した後：

1. **Phase 1 機能実装**:
   - 認証画面（ログイン・登録）
   - ホーム画面
   - Cloud Functions API スケルトン

2. **セキュリティルール実装**:
   - `docs/specs/02_Firestoreデータベース設計書_v3_3.md` のルール実装
   - ユーザーアクセス制御

3. **テスト開始**:
   - Widget テスト (Flutter)
   - Unit テスト (Firebase Functions)
   - 統合テスト（Firebase Emulator Suite）

4. **本番デプロイ準備**:
   - Firestore インデックスの最適化
   - Cloud Functions のコールドスタート対策
   - BigQuery パイプラインのセットアップ

---

## 参考資料

| リソース | URL | 用途 |
|---------|-----|------|
| Firebase コンソール | https://console.firebase.google.com | プロジェクト管理 |
| Firebase ドキュメント | https://firebase.google.com/docs | 公式リファレンス |
| FlutterFire ドキュメント | https://firebase.flutter.dev | Flutter 統合ガイド |
| GCP コンソール | https://console.cloud.google.com | GCP サービス管理 |
| システムアーキテクチャ設計書 | `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` | 技術スタック詳細 |
| Firestore 設計書 | `docs/specs/02_Firestoreデータベース設計書_v3_3.md` | データ構造・ルール詳細 |
| API 設計書 | `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` | Cloud Functions API 仕様 |

---

## ドキュメント管理

| 項目 | 値 |
|------|-----|
| **作成者** | Cloud Architect |
| **作成日** | 2025年11月29日 |
| **最終更新日** | 2025年11月29日 |
| **ステータス** | 初版 |
| **対象バージョン** | Firebase SDK 最新版、Flutter 3.10+、Firebase CLI 13.0+ |

**更新履歴**:
- 2025年11月29日: 初版作成、全セットアップ手順を統合

---

