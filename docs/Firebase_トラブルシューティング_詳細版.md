# Firebase トラブルシューティング・詳細版

**プロジェクト名**: AIフィットネスアプリ
**対象Firebase プロジェクト**: `tokyo-list-478804-e5`
**作成日**: 2025年11月29日
**対象ユーザー**: 開発チーム、DevOps エンジニア

---

## 概要

「Firebase セットアップ手順書」での問題が発生した際の詳細なトラブルシューティングガイド。システム設定、ネットワーク、認証、デプロイに関わる問題を網羅します。

---

## 1. 環境セットアップの問題

### 1.1 Firebase CLI のインストール失敗

#### 症状

```bash
firebase --version
zsh: command not found: firebase
```

#### 原因と対処法

**原因1: npm がインストールされていない**

```bash
# Node.js/npm がインストール済みか確認
node --version
npm --version
```

**対処法**:

```bash
# Node.js LTS をダウンロード・インストール
# https://nodejs.org/

# インストール後、npm を再確認
npm --version  # v18.0.0 以上推奨

# Firebase CLI をインストール
npm install -g firebase-tools
```

**原因2: npm グローバルパスが PATH に含まれていない**

```bash
# npm グローバルインストール先を確認
npm config get prefix

# 出力例: /usr/local/bin （macOS）
# 出力例: C:\Users\<username>\AppData\Roaming\npm （Windows）

# これらのディレクトリが PATH に含まれていることを確認
# Windows の場合
echo %PATH% | find "AppData\Roaming\npm" >nul && echo Found || echo Not found
```

**対処法**:

```bash
# Windows: 環境変数を再設定
# 1. スタートメニュー > 環境変数 > パスの編集
# 2. C:\Users\<username>\AppData\Roaming\npm を追加
# 3. ターミナルを再起動

# macOS/Linux: シェル設定ファイルを編集
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

### 1.2 FlutterFire CLI のインストール失敗

#### 症状

```bash
flutterfire configure
zsh: command not found: flutterfire
```

#### 原因と対処法

```bash
# Pub グローバルパスを確認
dart pub global list

# FlutterFire CLI をインストール
dart pub global activate flutterfire_cli

# Pub グローバルパスが PATH に含まれていることを確認
export PATH="$PATH:$HOME/.pub-cache/bin"

# 永続的に PATH に追加（macOS/Linux）
echo 'export PATH="$PATH:$HOME/.pub-cache/bin"' >> ~/.bash_profile
source ~/.bash_profile
```

### 1.3 Java/keytool が見つからない

#### 症状

```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore ...
'keytool' is not recognized as an internal or external command
```

#### 原因と対処法

**原因**: Java Development Kit (JDK) がインストールされていない、または PATH に含まれていない

```bash
# Java がインストール済みか確認
java -version

# JDK をダウンロード・インストール
# https://www.oracle.com/java/technologies/downloads/ （Oracle JDK）
# または
# https://adoptium.net （Adoptium OpenJDK）
```

**対処法**:

```bash
# Windows: JAVA_HOME 環境変数を設定
# 1. JDK インストール先を確認（例: C:\Program Files\Java\jdk-17.0.1）
# 2. スタートメニュー > 環境変数 > 新規で JAVA_HOME を追加
# 3. 値: C:\Program Files\Java\jdk-17.0.1
# 4. PATH に %JAVA_HOME%\bin を追加
# 5. ターミナルを再起動

# macOS: JDK をインストール
brew install openjdk

# Linux: JDK をインストール
apt-get install default-jdk （Ubuntu/Debian）
yum install java-latest-openjdk （RedHat/CentOS）
```

---

## 2. Firebase プロジェクト関連の問題

### 2.1 Firebase プロジェクトが見つからない

#### 症状

```bash
firebase use
ERROR: The option 'default' is not set in /path/to/firebase.json.
```

#### 原因と対処法

**原因**: `.firebaserc` または `firebase.json` が正しく設定されていない

```bash
# .firebaserc を確認
cat .firebaserc

# 期待される内容
# {
#   "projects": {
#     "default": "tokyo-list-478804-e5"
#   }
# }
```

**対処法**:

```bash
# Firebase プロジェクトにログイン
firebase login

# プロジェクトを初期化
firebase init

# 既存プロジェクトを使用する場合
firebase use tokyo-list-478804-e5

# 確認
firebase projects:list
```

### 2.2 Firestore が本番モードで作成されていない

#### 症状

```
Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;  // これは開発モード
    }
  }
}
```

#### 原因と対処法

**原因**: Firestore が開発モードで作成されており、認証なしでの読み取り/書き込みが許可されている

**対処法**:

```bash
# セキュリティルールをデプロイして本番モードに切り替え
firebase deploy --only firestore:rules

# または、Firebase コンソール で手動設定
# 1. Firestore > ルール タブ
# 2. ルール内容を以下に変更：

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

# 3. 「公開」をクリック
```

### 2.3 課金が有効になっていない

#### 症状

```
Error: Firebase project 'tokyo-list-478804-e5' is not associated with an active Cloud billing account.
```

#### 原因と対処法

**原因**: Firebase プロジェクトに課金アカウントが接続されていない

**対処法**:

```bash
# GCP コンソール で確認
# 1. https://console.cloud.google.com
# 2. プロジェクト選択: tokyo-list-478804-e5
# 3. 左メニュー: 課金
# 4. 課金アカウントを選択・接続

# または CLI で確認
gcloud beta billing projects list
gcloud beta billing projects link tokyo-list-478804-e5 --billing-account=<BILLING_ACCOUNT_ID>
```

---

## 3. Flutter Firebase 統合の問題

### 3.1 firebase_options.dart が古いプロジェクトを参照している

#### 症状

```
firebase_options.dart の projectId が 'ai-fitness-c38f0'
```

#### 原因と対処法

**原因**: FlutterFire CLI でプロジェクトが再生成されていない

**対処法**:

```bash
# FlutterFire CLI で再生成
cd flutter_app

flutterfire configure \
  --project=tokyo-list-478804-e5 \
  --ios-bundle-id=com.example.ai-fitness \
  --android-package-name=com.example.ai_fitness

# 生成ファイルを確認
grep -n 'projectId' lib/firebase_options.dart
# 出力: projectId: 'tokyo-list-478804-e5' （正しい場合）

# キャッシュをクリアして再生成
flutter clean
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

### 3.2 iOS GoogleService-Info.plist が見つからない

#### 症状

```
Terminating app due to uncaught exception 'FIRAppNotConfigured'
*** Unable to parse GoogleService-Info.plist from project.
```

#### 原因と対処法

**原因**: `GoogleService-Info.plist` が iOS ビルド設定に含まれていない

**対処法**:

```bash
# ファイルの存在確認
ls -la flutter_app/ios/Runner/GoogleService-Info.plist

# ファイルが存在しない場合、FlutterFire CLI で再生成
cd flutter_app
flutterfire configure --project=tokyo-list-478804-e5

# Xcode で手動追加（必要な場合）
# 1. Xcode を開く: open flutter_app/ios/Runner.xcworkspace
# 2. 左パネル: Runner > Runner
# 3. Target: Runner > Build Phases > Copy Bundle Resources
# 4. + をクリック > GoogleService-Info.plist を追加
```

### 3.3 Android google-services.json が見つからない

#### 症状

```
Caused by: org.gradle.api.GradleException:
  File google-services.json is missing from module root
```

#### 原因と対処法

**原因**: `google-services.json` が Android ビルド設定に含まれていない

**対処法**:

```bash
# ファイルの存在確認
ls -la flutter_app/android/app/google-services.json

# ファイルが存在しない場合、FlutterFire CLI で再生成
cd flutter_app
flutterfire configure --project=tokyo-list-478804-e5

# Android Studio で手動確認
# 1. Android Studio を開く
# 2. プロジェクト: flutter_app
# 3. android/app ディレクトリで google-services.json を確認
```

### 3.4 Firebase SDK バージョン不一致

#### 症状

```
PlatformException(firebase_auth, ...)
PlatformException(cloud_firestore, ...)
```

#### 原因と対処法

**原因**: Flutter パッケージバージョンと Firebase SDK バージョンが一致していない

**対処法**:

```bash
# pubspec.yaml で Firebase パッケージを確認
grep -E 'firebase_|cloud_' flutter_app/pubspec.yaml

# 最新バージョンにアップグレード
cd flutter_app
flutter pub upgrade firebase_core firebase_auth cloud_firestore

# または、システムアーキテクチャ設計書の推奨バージョンを使用
# 参照: docs/specs/01_システムアーキテクチャ設計書_v3_2.md セクション 4.1.3

# キャッシュをクリアして再実行
flutter clean
flutter pub get
flutter run
```

---

## 4. Firebase Emulator の問題

### 4.1 エミュレータのポートが既に使用されている

#### 症状

```
[error] Error starting Firestore Emulator: Error: listen EADDRINUSE: address already in use :::8080
```

#### 原因と対処法

**原因**: エミュレータを前回停止せずに再起動しようとしている、または別のプロセスがポートを使用中

**対処法**:

```bash
# 既存のプロセスを終了
# Windows
netstat -ano | findstr :8080
taskkill /F /PID <PID>

# macOS/Linux
lsof -i :8080
kill -9 <PID>

# エミュレータを再起動
firebase emulators:start

# または、別のポートを指定
firebase emulators:start --firestore-port=8081
```

### 4.2 エミュレータが接続できない

#### 症状

```
PlatformException(cloud_firestore, Failed to get document because the client is offline.)
```

#### 原因と対処法

**原因**: Flutter アプリがエミュレータに接続していない、またはエミュレータが起動していない

**対処法**:

```bash
# 1. エミュレータが起動していることを確認
firebase emulators:start

# 2. Flutter アプリがエミュレータに接続していることを確認
# main.dart で以下を確認

if (kDebugMode) {
  await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
  await FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);
  await FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001);
}

# 3. iOS シミュレータの場合、localhost の代わりに 127.0.0.1 を使用
await FirebaseFirestore.instance.useFirestoreEmulator('127.0.0.1', 8080);

# 4. アプリを再構築
flutter clean
flutter run
```

### 4.3 Emulator UI にアクセスできない

#### 症状

```
localhost:4000 にアクセスしても何も表示されない
```

#### 原因と対処法

**原因**: エミュレータの UI が無効になっているか、ポート 4000 が使用されている

**対処法**:

```bash
# firebase.json で UI が有効になっていることを確認
cat firebase.json

# 期待される内容
# "ui": {
#   "enabled": true,
#   "port": 4000,
#   "host": "127.0.0.1"
# }

# ポート 4000 が使用されているか確認
# Windows
netstat -ano | findstr :4000

# macOS/Linux
lsof -i :4000

# 別のポートで起動
firebase emulators:start --ui
```

---

## 5. Firestore セキュリティルール関連の問題

### 5.1 セキュリティルールの構文エラー

#### 症状

```
Error: Rules compile error:
/Users/username/project/firebase/firestore.rules:10:5 - Unexpected token
```

#### 原因と対処法

**原因**: セキュリティルールに構文エラーがある

**対処法**:

```bash
# ルールファイルの構文をテスト
firebase emulators:start --firestore-debug-logs

# エラーメッセージをよく読む（行番号を確認）
# 一般的なエラー:
# 1. セミコロン（;）の欠落
# 2. 括弧（{}）のバランスが取れていない
# 3. `function` キーワードの書き間違い

# ルールファイルを編集
nano firebase/firestore.rules  # または任意のエディタ

# 再度デプロイ
firebase deploy --only firestore:rules
```

### 5.2 セキュリティルールで拒否されている

#### 症状

```
PlatformException(Permission-denied, Missing or insufficient permissions.)
```

#### 原因と対処法

**原因**: セキュリティルールがそのアクセスを許可していない

**対処法**:

```bash
# セキュリティルールをテスト
# Firebase コンソール > Firestore > ルール > テストルール

# または、エミュレータでテスト
firebase emulators:exec "npm test"  # Jest テストを実行

# ルールをデバッグモード（全許可）に一時的に変更
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // 開発用：本番環境では使用禁止
    }
  }
}

firebase deploy --only firestore:rules

# ルールが問題でなければ、認証状態を確認
// Flutter コード
final authState = FirebaseAuth.instance.authStateChanges();
authState.listen((user) {
  if (user == null) {
    print("ユーザーが認証されていません");
  } else {
    print("ユーザーID: ${user.uid}");
  }
});
```

### 5.3 ルール内の request.auth が null

#### 症状

```
セキュリティルールが `request.auth != null` をチェックしているのに拒否される
```

#### 原因と対処法

**原因**: 認証トークンが有効でない、または期限切れ

**対処法**:

```dart
// Flutter コード：認証状態を確認
final user = FirebaseAuth.instance.currentUser;
if (user != null) {
  print("認証済み。UID: ${user.uid}");
  final idToken = await user.getIdToken();
  print("ID トークン: $idToken");
} else {
  print("認証されていません。ログインしてください。");
}

// Firestore へのアクセステスト
try {
  final doc = await FirebaseFirestore.instance
      .collection('users')
      .doc(user!.uid)
      .get();
  print("ドキュメント: ${doc.data()}");
} catch (e) {
  print("Firestore エラー: $e");
}
```

---

## 6. Cloud Functions のデプロイ問題

### 6.1 Functions がデプロイできない

#### 症状

```
Error: Failed to build or deploy functions.
```

#### 原因と対処法

**原因**: TypeScript コンパイルエラー、依存関係エラー、または権限エラー

**対処法**:

```bash
# 1. TypeScript をコンパイル
cd functions
npm run build

# エラーメッセージを確認（例: `Type 'unknown' is not assignable to type 'string'`）

# 2. 依存関係をインストール
npm install

# 3. ESLint でコードをチェック
npm run lint

# 4. テストを実行
npm test

# 5. Firebase にログインして権限を確認
firebase login

# 6. デプロイ
firebase deploy --only functions
```

### 6.2 Functions がメモリ不足で失敗

#### 症状

```
Error: Cloud Functions for Firebase deployment failed.
Exceeded timeout of 540000ms while executing functions
```

#### 原因と対処法

**原因**: 関数のメモリ上限を超過、または処理時間が長すぎる

**対処法**:

```typescript
// functions/src/index.ts で設定を確認
setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
  memory: "256MiB",          // メモリを増やす必要があるか？
  timeoutSeconds: 60,         // タイムアウトを延長する必要があるか？
});

// または、個別関数で設定
export const largeProcessing = functions
  .runWith({
    memory: "512MiB",
    timeoutSeconds: 540,
  })
  .https.onCall(async (data, context) => {
    // 処理
  });
```

### 6.3 Functions でログが出力されない

#### 症状

```
Firebase コンソール > Functions > ログ に何も表示されない
```

#### 原因と対処法

**原因**: ログレベルが正しく設定されていない、またはエラーが記録されていない

**対処法**:

```typescript
import { logger } from "firebase-functions";

export const myFunction = functions.https.onCall(async (data, context) => {
  logger.info("関数が呼び出されました", { userId: context.auth?.uid });

  try {
    const result = await someAsyncOperation();
    logger.info("処理成功", { result });
    return result;
  } catch (error) {
    logger.error("処理エラー", error);
    throw new functions.https.HttpsError(
      "internal",
      "処理中にエラーが発生しました"
    );
  }
});

// ログレベルの確認
// logger.debug() - デバッグ情報（本番環境では非表示の場合あり）
// logger.info() - 情報（推奨）
// logger.warn() - 警告
// logger.error() - エラー（推奨）
```

---

## 7. 認証・セキュリティ関連の問題

### 7.1 Google Sign-In が失敗する

#### 症状

```
PlatformException(sign_in_failed, com.google.android.gms.common.api.ApiException: 10:)
```

#### 原因と対処法

**原因**: Android 署名証明書の SHA-1 が Firebase コンソール に登録されていない

**対処法**:

```bash
# デバッグ署名証明書の SHA-1 を取得
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android | grep SHA1

# 出力例:
# SHA1: 8E:0E:8C:95:...

# Firebase コンソール で登録
# 1. プロジェクト設定 > アプリ > Android アプリ
# 2. SHA 署名証明書（デバッグ）に上記の SHA-1 を追加
```

### 7.2 カスタムクレーム が反映されない

#### 症状

```
const customClaims = context.auth?.token.customClaims;
// customClaims が undefined
```

#### 原因と対処法

**原因**: カスタムクレームが設定されていない、またはトークンが更新されていない

**対処法**:

```typescript
// Cloud Functions でカスタムクレームを設定
import * as admin from "firebase-admin";

export const setAdminRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
  }

  try {
    await admin.auth().setCustomUserClaims(data.uid, {
      admin: true,
      role: "moderator",
    });
    return { message: "クレームを設定しました" };
  } catch (error) {
    logger.error("クレーム設定エラー", error);
    throw new functions.https.HttpsError("internal", "エラーが発生しました");
  }
});
```

```dart
// Flutter でトークンを更新
final user = FirebaseAuth.instance.currentUser;
await user?.getIdTokenResult(forceRefresh: true);

// 更新後にクレームを確認
final claims = user?.getIdTokenResultSync().claims;
print("カスタムクレーム: $claims");
```

---

## 8. ネットワーク・ファイアウォール関連の問題

### 8.1 Firebase に接続できない（オンプレミス/VPN 環境）

#### 症状

```
PlatformException(network-error, ...)
PlatformException(unavailable, ...)
```

#### 原因と対処法

**原因**: ファイアウォール/プロキシが Firebase API へのアクセスをブロック

**対処法**:

```bash
# Firebase API の疎通をテスト
ping firebaseio.com
curl https://firebaseio.com

# ファイアウォール設定で以下を許可：
# - ドメイン: *.firebaseio.com
# - ドメイン: *.firebase.google.com
# - ポート: 443 (HTTPS)

# プロキシを設定（必要な場合）
firebase login --no-localhost
```

### 8.2 エミュレータに localhost で接続できない（Docker 環境）

#### 症状

```
Failed to connect to emulator at localhost:8080
```

#### 原因と対処法

**原因**: Docker コンテナ内から localhost は親マシンを指していない

**対処法**:

```bash
# Docker ホストの IP を確認
# macOS/Linux
docker-compose exec app bash
cat /etc/hosts  # host.docker.internal を確認

# または
# Windows/macOS Docker Desktop
# host.docker.internal を使用

# Flutter コード で修正
if (kDebugMode) {
  const String emulatorHost = 'host.docker.internal';  // Docker 環境
  // const String emulatorHost = 'localhost';  // ローカル環境

  await FirebaseFirestore.instance.useFirestoreEmulator(emulatorHost, 8080);
}
```

---

## 9. 本番環境固有の問題

### 9.1 本番環境でセキュリティエラーが多発

#### 症状

```
Cloud Logging に多数の Permission-denied エラー
```

#### 原因と対処法

**原因**: 本番環境のセキュリティルールが必要以上に制限的、または正しく設定されていない

**対処法**:

```bash
# Firestore セキュリティルールを見直す
# docs/specs/02_Firestoreデータベース設計書_v3_3.md を参照

# Cloud Logging でエラーをフィルタ
# 1. Cloud Logging コンソール
# 2. ログフィルタ: resource.type="cloud_firestore" severity="ERROR"
# 3. エラーの詳細を確認

# ルールをテスト
firebase emulators:start
# テストを実行してルールを検証

# ステージング環境でテスト後、本番にデプロイ
firebase deploy --only firestore:rules --project=tokyo-list-478804-e5
```

### 9.2 本番環境での BigQuery 同期失敗

#### 症状

```
Cloud Logging に BigQuery INSERT エラー
```

#### 原因と対処法

**原因**: BigQuery テーブルスキーマが一致していない、または権限がない

**対処法**:

```bash
# BigQuery テーブルスキーマを確認
bq show --schema --format=json tokyo-list-478804-e5:ai_fitness_analytics.sessions

# Cloud Functions のログを確認
firebase functions:log --project=tokyo-list-478804-e5

# Dead Letter Queue（DLQ）を確認
# Firestore > BigQuerySyncFailures コレクション

# 関数のテスト（ステージング環境）
npm test

# 本番環境で再デプロイ
firebase deploy --only functions --project=tokyo-list-478804-e5
```

---

## 10. パフォーマンス・リソース関連の問題

### 10.1 Firestore の読み取り費用が多すぎる

#### 症状

```
GCP コンソール > 課金 で Firestore 読み取り費用が予想の 10 倍
```

#### 原因と対処法

**原因**: 不要な読み取りクエリ、または大量のドキュメント読み取り

**対処法**:

```bash
# Firestore の使用統計を確認
# Firebase コンソール > Firestore > インサイト

# Cloud Logging でクエリをフィルタ
resource.type="cloud_firestore"
protoPayload.methodName="google.firestore.admin.v1.Firestore.BatchGetDocuments"

# Flutter コード で最適化
// 非効率的な例：全ドキュメントを読み取り
final allUsers = await FirebaseFirestore.instance.collection('users').get();

// 最適化例：必要なフィールドのみ読み取り
final users = await FirebaseFirestore.instance
    .collection('users')
    .select(['name', 'email'])  // 必要なフィールドのみ
    .get();
```

### 10.2 Functions のコールドスタートが遅い

#### 症状

```
初回呼び出しが 10 秒以上かかる
```

#### 原因と対処法

**原因**: 大量の依存関係、または最小インスタンス数が 0

**対処法**:

```typescript
// functions/src/index.ts で設定
setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
  minInstances: 1,  // 常に 1 インスタンスを実行（追加費用がかかります）
  memory: "256MiB",
  timeoutSeconds: 60,
});

// または、不要な依存関係を削除
// webpack でバンドルを最小化
```

---

## チェックリスト：問題診断の流れ

### ステップ1：環境確認

- [ ] Node.js/npm がインストール済みか
- [ ] Firebase CLI がインストール済みか（`firebase --version`）
- [ ] FlutterFire CLI がインストール済みか（`flutterfire --version`）
- [ ] Java がインストール済みか（`java -version`）
- [ ] 環境変数（PATH）が正しく設定されているか

### ステップ2：Firebase プロジェクト確認

- [ ] Firebase プロジェクト `tokyo-list-478804-e5` が GCP で存在するか
- [ ] 課金が有効か（Blaze プラン）
- [ ] Firestore が asia-northeast1（東京）で実行中か
- [ ] Authentication が有効か
- [ ] Cloud Functions が有効か

### ステップ3：ローカル開発環境確認

- [ ] `firebase_options.dart` が `tokyo-list-478804-e5` を参照しているか
- [ ] iOS の `GoogleService-Info.plist` が存在するか
- [ ] Android の `google-services.json` が存在するか
- [ ] Firebase Emulator Suite が起動するか（`firebase emulators:start`）
- [ ] Emulator UI (localhost:4000) にアクセスできるか

### ステップ4：アプリケーション確認

- [ ] Flutter アプリが起動するか（`flutter run`）
- [ ] ログイン/登録が成功するか
- [ ] Firestore へのデータ書き込みが成功するか
- [ ] エミュレータのログが出力されているか

### ステップ5：本番環境確認

- [ ] Firebase Project ID が正しいか（CLI: `firebase projects:list`）
- [ ] Firestore セキュリティルールが本番モードか
- [ ] Cloud Functions がデプロイできるか（`firebase deploy --only functions`）
- [ ] デプロイ後に関数が呼び出せるか

---

## 参考：よくある設定ファイルの内容

### .firebaserc

```json
{
  "projects": {
    "default": "tokyo-list-478804-e5",
    "dev": "tokyo-list-478804-e5",
    "staging": "tokyo-list-478804-e5",
    "production": "tokyo-list-478804-e5"
  }
}
```

### firebase.json （抜粋）

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  },
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  }
}
```

### firebase_options.dart （抜粋）

```dart
static const FirebaseOptions web = FirebaseOptions(
  apiKey: 'AIzaSy...',
  appId: '1:123456:web:...',
  messagingSenderId: '123456',
  projectId: 'tokyo-list-478804-e5',  // ← これが重要
  authDomain: 'tokyo-list-478804-e5.firebaseapp.com',
  storageBucket: 'tokyo-list-478804-e5.appspot.com',
);
```

---

## ドキュメント管理

| 項目 | 値 |
|------|-----|
| **作成者** | Cloud Architect |
| **作成日** | 2025年11月29日 |
| **最終更新日** | 2025年11月29日 |
| **ステータス** | 初版 |

---

