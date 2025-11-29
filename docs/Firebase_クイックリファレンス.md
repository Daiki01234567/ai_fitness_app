# Firebase クイックリファレンス

**プロジェクト名**: AIフィットネスアプリ
**対象Firebase プロジェクト**: `tokyo-list-478804-e5`
**作成日**: 2025年11月29日
**用途**: よく使用するコマンド・設定の素早い参照

---

## Firebase CLI コマンド一覧

### ログイン・認証

```bash
# Firebase にログイン
firebase login

# ログイン状態を確認
firebase login:list

# ログアウト
firebase logout

# デフォルトプロジェクトを設定
firebase use tokyo-list-478804-e5

# 現在のプロジェクトを確認
firebase projects:list
firebase use
```

### エミュレータ

```bash
# すべてのエミュレータを起動
firebase emulators:start

# 特定のエミュレータのみ起動
firebase emulators:start --only auth,firestore

# UI を有効にして起動
firebase emulators:start --ui

# Emulator UI の URL
# http://localhost:4000

# テストを実行して自動停止
firebase emulators:exec "npm test"

# エミュレータデータをクリア
firebase emulators:start --import=./emulator-data
firebase emulators:export ./emulator-data
```

### デプロイ

```bash
# すべてをデプロイ
firebase deploy --project=tokyo-list-478804-e5

# Functions のみデプロイ
firebase deploy --only functions

# Firestore ルールのみデプロイ
firebase deploy --only firestore:rules

# Firestore インデックスのみデプロイ
firebase deploy --only firestore:indexes

# Storage ルールのみデプロイ
firebase deploy --only storage:rules

# デプロイ予定の内容を確認（実行しない）
firebase deploy --dry-run
```

### ログ・監視

```bash
# Cloud Functions ログを表示
firebase functions:log

# リアルタイムログを表示
firebase functions:log --tail

# 特定の関数のログを表示
firebase functions:log --only=myFunction

# 過去 1 時間のログを表示
firebase functions:log --tail --limit=1000
```

### Firestore

```bash
# Firestore のバックアップを取得
gcloud firestore export gs://tokyo-list-478804-e5-backups/backup-$(date +%Y%m%d-%H%M%S)

# Firestore をリストア
gcloud firestore import gs://tokyo-list-478804-e5-backups/backup-TIMESTAMP

# Firestore のルールをチェック（構文エラー確認）
firebase deploy --dry-run --only firestore:rules
```

### その他

```bash
# Firebase プロジェクト情報を表示
firebase projects:describe tokyo-list-478804-e5

# 利用可能な関数を一覧
firebase functions:list

# デプロイ履歴を表示
firebase deploy:log

# キャッシュをクリア
firebase cache:clear
```

---

## Flutter/Dart コマンド一覧

### セットアップ・初期化

```bash
# 依存関係をインストール
flutter pub get

# 依存関係をアップグレード（メジャーバージョン含む）
flutter pub upgrade --major-versions

# 依存関係をロック
flutter pub freeze

# 古いファイルをクリーン
flutter clean

# Dart コード生成（Freezed, Riverpod）
dart run build_runner build

# コード生成（変更ファイルのみ）
dart run build_runner build --delete-conflicting-outputs

# ウォッチモード（自動再実行）
dart run build_runner watch
```

### 開発・実行

```bash
# アプリを実行
flutter run

# 特定のデバイスで実行
flutter devices          # 利用可能なデバイス一覧
flutter run -d iPhone15  # 特定デバイスで実行

# ホットリロード付きで実行
flutter run

# 本番モード（最適化）で実行
flutter run --release

# プロファイルモード（パフォーマンス測定）で実行
flutter run --profile
```

### テスト

```bash
# すべてのテストを実行
flutter test

# 特定ディレクトリのテストを実行
flutter test test/screens/auth/

# 特定のテストファイルを実行
flutter test test/screens/auth/login_screen_test.dart

# ウォッチモード（変更検出時に再実行）
flutter test --watch

# コンテナ内でテスト実行
flutter test --verbose

# テスト結果を JSON 形式で出力
flutter test --machine
```

### 分析・品質管理

```bash
# 静的解析（Lint）を実行
flutter analyze

# フォーマット（自動整形）を実行
dart format lib/ test/

# 不要な import をチェック
dart run bin/unused_deps.dart

# 依存関係のセキュリティをチェック
dart pub outdated
```

### iOS 開発

```bash
# iOS 依存関係をインストール
cd flutter_app/ios
pod install
cd ..

# iOS を Xcode で開く
open ios/Runner.xcworkspace

# iOS シミュレータのスクリーンショット
xcrun simctl io booted screenshot
```

### Android 開発

```bash
# Android ビルドをクリーン
flutter clean && flutter pub get

# Android エミュレータを一覧
flutter emulators

# Android エミュレータを起動
flutter emulators --launch <EMULATOR_ID>

# Android Studio を開く
open -a "Android Studio" .
```

---

## FlutterFire CLI

### Firebase 設定の再生成

```bash
# インタラクティブに設定を再生成
flutterfire configure

# プロジェクトを明示的に指定
flutterfire configure --project=tokyo-list-478804-e5

# iOS/Android パッケージ名を明示的に指定
flutterfire configure \
  --project=tokyo-list-478804-e5 \
  --ios-bundle-id=com.example.ai-fitness \
  --android-package-name=com.example.ai_fitness

# Web アプリのみ設定
flutterfire configure --web-only

# iOS のみ設定
flutterfire configure --ios-only

# Android のみ設定
flutterfire configure --android-only
```

---

## Firestore セキュリティルール：テンプレート

### 基本的なルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 認証済みユーザーが読み取り可能
    match /publicData/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // すべてをロック（本番モード）
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### ヘルパー関数

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ヘルパー関数
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    function isAdmin() {
      return request.auth.token.admin == true;
    }

    function isNotDeleting() {
      return !resource.data.get('deletionScheduled', false);
    }

    // ルール
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId) && isNotDeleting();
    }
  }
}
```

### フィールドレベルアクセス制御

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
          'tosAccepted', 'ppAccepted', 'deletionScheduled'
        ]);
    }
  }
}
```

---

## Cloud Functions：テンプレート

### HTTP callable 関数

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const updateUserProfile = functions.https.onCall(
  async (data, context) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "認証が必要です"
      );
    }

    // 権限チェック
    if (context.auth.uid !== data.userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "権限がありません"
      );
    }

    // バリデーション
    if (!data.name || typeof data.name !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "name は文字列で必須です"
      );
    }

    try {
      // Firestore に書き込み
      await admin
        .firestore()
        .collection("users")
        .doc(context.auth.uid)
        .update({
          name: data.name,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return { message: "プロフィールを更新しました" };
    } catch (error) {
      functions.logger.error("エラー", error);
      throw new functions.https.HttpsError(
        "internal",
        "内部エラーが発生しました"
      );
    }
  }
);
```

### Firestore トリガー関数

```typescript
export const onUserCreated = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    functions.logger.info("ユーザーが作成されました", {
      userId: context.params.userId,
      email: userData.email,
    });

    // 初期化処理
    // 例: BigQuery に記録、メール送信など
  });
```

### Auth トリガー関数

```typescript
export const onAuthUserCreated = functions.auth.user().onCreate((user) => {
  functions.logger.info("Firebase Auth ユーザーが作成されました", {
    uid: user.uid,
    email: user.email,
  });

  // Firestore に ユーザードキュメントを作成
  return admin.firestore().collection("users").doc(user.uid).set({
    uid: user.uid,
    email: user.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
```

---

## Firebase Functions npm スクリプト

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "firebase emulators:start",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "deploy": "firebase deploy --only functions",
    "deploy:prod": "firebase deploy --only functions --project=tokyo-list-478804-e5"
  }
}
```

コマンド実行例：

```bash
cd functions

npm run lint           # ESLint チェック
npm run lint:fix       # 自動修正
npm run format         # Prettier フォーマット
npm run build          # TypeScript コンパイル
npm run build:watch    # ウォッチモード
npm run serve          # エミュレータ起動
npm test               # テスト実行
npm test:coverage      # カバレッジ表示
npm run deploy         # Functions デプロイ
```

---

## Flutter firebase_options.dart：確認ポイント

```dart
// 正しい設定例：tokyo-list-478804-e5
static const FirebaseOptions android = FirebaseOptions(
  apiKey: 'AIzaSyAnIXQRxE5f...',                    // Android キー
  appId: '1:123456789012:android:815923c1eaeb7c25...', // Android アプリ ID
  messagingSenderId: '123456789012',
  projectId: 'tokyo-list-478804-e5',  // ← これが重要
  storageBucket: 'tokyo-list-478804-e5.appspot.com',
);

// 確認チェック：
// ✓ projectId が 'tokyo-list-478804-e5'
// ✓ storageBucket が 'tokyo-list-478804-e5.appspot.com'
// ✓ messagingSenderId が正しい数値
// ✓ 古いプロジェクト ID ('ai-fitness-c38f0') が含まれていない
```

---

## エミュレータポート一覧

| サービス | ポート | URL | 説明 |
|---------|--------|-----|------|
| Auth | 9099 | http://localhost:9099 | Firebase Authentication |
| Firestore | 8080 | http://localhost:8080 | Cloud Firestore |
| Functions | 5001 | http://localhost:5001 | Cloud Functions |
| Storage | 9199 | http://localhost:9199 | Firebase Storage |
| Pub/Sub | 8085 | http://localhost:8085 | Cloud Pub/Sub (オプション) |
| **Emulator UI** | **4000** | **http://localhost:4000** | **エミュレータ管理画面** |

ポート競合の場合：

```bash
# ポート 8080 が既に使用されている
firebase emulators:start --firestore-port=8081
```

---

## GCP CLI コマンド（参考）

```bash
# GCP にログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project tokyo-list-478804-e5

# 現在のプロジェクトを確認
gcloud config get-value project

# BigQuery でクエリを実行
bq query --use_legacy_sql=false "SELECT * FROM tokyo-list-478804-e5.ai_fitness_analytics.sessions LIMIT 10"

# Cloud Logging を表示
gcloud logging read "resource.type=cloud_function" --limit 50 --format json

# Cloud Monitoring アラートを一覧
gcloud monitoring policies list
```

---

## 環境変数・設定ファイル

### .env.local（Git に追加しない）

```bash
# Firebase
FIREBASE_PROJECT_ID=tokyo-list-478804-e5
FIREBASE_API_KEY=AIzaSy...

# GCP
GCP_PROJECT_ID=tokyo-list-478804-e5

# アプリケーション
APP_ENV=development
APP_DEBUG=true
```

### .gitignore に追加すべきファイル

```
# Firebase
firebase-debug.log
firebase-debug.*.log

# Functions
functions/node_modules/
functions/lib/

# Dart/Flutter
flutter_app/.dart_tool/
flutter_app/.flutter-plugins
flutter_app/build/

# エミュレータ
emulator-data/

# 環境変数
.env
.env.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo
```

---

## よくある作業フロー

### ローカル開発の開始

```bash
# 1. プロジェクトルートに移動
cd /path/to/ai_fitness_app

# 2. Firebase Emulator を起動
firebase emulators:start

# 3. 別のターミナルで Flutter アプリを起動
cd flutter_app
flutter run

# 4. Emulator UI を開く（ブラウザ）
# http://localhost:4000
```

### Firebase Functions を開発

```bash
# 1. Functions ディレクトリに移動
cd functions

# 2. 依存関係をインストール
npm install

# 3. コードを編集
# src/ ディレクトリ内のファイルを修正

# 4. TypeScript をコンパイル
npm run build

# 5. テストを実行
npm test

# 6. エミュレータで動作確認
cd ..
firebase emulators:start

# 7. デプロイ（本番環境）
firebase deploy --only functions
```

### Firestore ルールを更新

```bash
# 1. ルールファイルを編集
nano firebase/firestore.rules

# 2. 構文チェック
firebase deploy --dry-run --only firestore:rules

# 3. エミュレータでテスト
firebase emulators:start

# 4. デプロイ
firebase deploy --only firestore:rules
```

### セキュリティルールをテスト

```bash
# 1. テストファイルを作成/編集
# firestore.rules.test.js

# 2. エミュレータで実行
firebase emulators:exec "npm test"

# または、Jest でテスト
npm test firebase.rules
```

---

## トラブル時の確認順序

1. **環境確認**: `firebase --version`, `flutter --version`
2. **ログインステータス**: `firebase login:list`
3. **プロジェクト確認**: `firebase projects:list`, `firebase use`
4. **エミュレータ起動**: `firebase emulators:start`
5. **Emulator UI**: http://localhost:4000
6. **Cloud Logging**: Firebase Console > Logs Router
7. **詳細版トラブルシューティング**: `docs/Firebase_トラブルシューティング_詳細版.md`

---

## リンク・参考資料

| リソース | URL |
|---------|-----|
| Firebase セットアップ手順書 | `docs/Firebase_セットアップ手順書.md` |
| Firebase トラブルシューティング詳細版 | `docs/Firebase_トラブルシューティング_詳細版.md` |
| システムアーキテクチャ設計書 | `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` |
| Firestore データベース設計書 | `docs/specs/02_Firestoreデータベース設計書_v3_3.md` |
| API 設計書 | `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` |
| Firebase 公式ドキュメント | https://firebase.google.com/docs |
| FlutterFire 公式ドキュメント | https://firebase.flutter.dev |
| Cloud Firestore セキュリティルール | https://firebase.google.com/docs/firestore/security/get-started |

---

## ドキュメント管理

| 項目 | 値 |
|------|-----|
| **作成者** | Cloud Architect |
| **作成日** | 2025年11月29日 |
| **最終更新日** | 2025年11月29日 |
| **ステータス** | 初版 |
| **用途** | よく使用するコマンド・設定の素早い参照 |

**Tips**: このドキュメントをブックマークすると、開発効率が向上します。

---

