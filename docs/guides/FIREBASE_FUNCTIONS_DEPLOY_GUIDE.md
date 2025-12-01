# Firebase Functions デプロイガイド

**プロジェクト名**: AI Fitness App
**対象読者**: 初学者〜中級者の開発者
**所要時間**: 30分〜1時間（初回デプロイ）
**最終更新日**: 2025-12-01

---

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [ローカル開発とテスト](#ローカル開発とテスト)
4. [デプロイ準備](#デプロイ準備)
5. [デプロイ実行](#デプロイ実行)
6. [デプロイ後の確認](#デプロイ後の確認)
7. [環境別デプロイ](#環境別デプロイ)
8. [トラブルシューティング](#トラブルシューティング)
9. [ロールバック手順](#ロールバック手順)
10. [セキュリティとベストプラクティス](#セキュリティとベストプラクティス)

---

## 概要

### このガイドの目的

このガイドは、AI Fitness AppのFirebase Functions（Cloud Functions）を安全にデプロイするための手順書です。初学者でも理解できるように、各手順で「なぜこの作業が必要か」を説明します。

### Firebase Functionsとは

**Firebase Functions**（Cloud Functions for Firebase）は、サーバーレスでバックエンドコードを実行できるサービスです。本プロジェクトでは以下の用途で使用しています：

- ユーザー認証時の自動処理（サインアップ、削除）
- HTTP APIエンドポイント（プロフィール更新、トレーニングセッション記録など）
- Firestoreトリガー（同意記録、データ同期）
- スケジュール処理（削除予定ユーザーのクリーンアップなど）

### デプロイ対象のリージョン

本プロジェクトでは**東京リージョン（asia-northeast1）**を使用しています。日本市場向けアプリのため、レイテンシを最小化するための設定です。

**参照仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` - システム全体設計
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` - API仕様

---

## 前提条件

### 必要なもの

- [ ] Node.js 24 LTSがインストール済み
- [ ] Firebase CLIがインストール済み（`firebase --version`で確認）
- [ ] Firebaseプロジェクトへのアクセス権限（`tokyo-list-478804-e5`）
- [ ] Firebase CLIでログイン済み（`firebase login`）
- [ ] プロジェクトのローカルクローン
- [ ] インターネット接続

### 必要な権限

以下のIAM権限が必要です：

| 権限 | 用途 |
|-----|------|
| Cloud Functions 開発者 | 関数のデプロイ・削除 |
| Service Account ユーザー | サービスアカウントの使用 |
| Firestore ルール管理者 | セキュリティルールのデプロイ（オプション） |

**権限確認方法**:
```bash
# プロジェクトの権限を確認
gcloud projects get-iam-policy tokyo-list-478804-e5 --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"
```

> **権限がない場合**: プロジェクトオーナーまたは管理者に権限付与を依頼してください。

### 推奨する事前知識

- TypeScriptの基本文法
- Firebase Authenticationの概念
- Firestoreの基本操作
- コマンドライン（ターミナル）の基本操作

---

## ローカル開発とテスト

### なぜローカルテストが重要か

デプロイ前にローカルで動作確認することで：
- **本番環境を汚染しない**
- **デバッグが容易**（ブレークポイント、詳細ログが使える）
- **高速な開発サイクル**（デプロイ時間の節約）
- **コスト削減**（本番環境での実行コストがかからない）

---

### ステップ1: 依存関係のインストール

```bash
# プロジェクトルートから functionsディレクトリに移動
cd functions

# 依存パッケージのインストール
npm install
```

**何が起きているか**: `package.json`に記載された依存パッケージ（firebase-admin、firebase-functionsなど）が`node_modules`にインストールされます。

---

### ステップ2: コードの静的解析

デプロイ前に必ずコード品質をチェックします。

```bash
# ESLintによる静的解析（コードスタイル・潜在的バグのチェック）
npm run lint

# 自動修正可能なエラーを修正
npm run lint:fix

# Prettierによるフォーマット確認
npm run format:check

# フォーマット適用
npm run format
```

**エラーが出た場合**: エラーメッセージを読み、該当箇所を修正してください。Google Style Guideに従ったコーディング規約を守ることが重要です。

---

### ステップ3: TypeScriptビルド

```bash
# TypeScriptコードをJavaScriptにコンパイル
npm run build
```

**成功時の出力**:
```
> functions@1.0.0 build
> tsc

# エラーがない場合、何も出力されません
```

**ビルド成果物**: `lib/`ディレクトリにコンパイル済みのJavaScriptファイルが生成されます。

**ウォッチモード**（開発時に便利）:
```bash
# ファイル変更を監視して自動再ビルド
npm run build:watch
```

---

### ステップ4: ユニットテストの実行

```bash
# すべてのテストを実行
npm test

# カバレッジレポート付きテスト
npm run test:coverage
```

**テスト成功例**:
```
PASS  tests/auth/onCreate.test.ts
PASS  tests/middleware/csrf.test.ts
PASS  tests/services/auditLog.test.ts

Test Suites: 15 passed, 15 total
Tests:       87 passed, 87 total
Snapshots:   0 total
Time:        12.345 s
```

**テストが失敗した場合**: デプロイを中止し、失敗の原因を修正してください。

---

### ステップ5: ローカルエミュレーターでの動作確認

```bash
# プロジェクトルートに戻る
cd ..

# Firebaseエミュレーターを起動（すべてのサービス）
firebase emulators:start

# または、Functionsのみ起動
firebase emulators:start --only functions
```

**成功時の出力**:
```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000                │
└─────────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬─────────────────────────────────┐
│ Emulator   │ Host:Port      │ View in Emulator UI             │
├────────────┼────────────────┼─────────────────────────────────┤
│ Functions  │ 127.0.0.1:5001 │ http://127.0.0.1:4000/functions │
└────────────┴────────────────┴─────────────────────────────────┘
```

**Emulator UIでの確認**:
1. ブラウザで `http://localhost:4000` を開く
2. 「Functions」タブをクリック
3. デプロイされた関数の一覧が表示される
4. 各関数のログをリアルタイムで確認できる

---

### ステップ6: ローカル関数の動作テスト

#### 方法1: Emulator UIから手動テスト

1. Emulator UI（http://localhost:4000/functions）を開く
2. テストしたい関数を選択
3. リクエストボディを入力してテスト実行

#### 方法2: curlコマンドでテスト

```bash
# HTTP Callable関数の呼び出し例（ユーザープロフィール更新）
curl -X POST \
  http://127.0.0.1:5001/tokyo-list-478804-e5/asia-northeast1/user_updateProfile \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "userId": "test-user-123",
      "displayName": "テストユーザー",
      "birthDate": "1990-01-01"
    }
  }'
```

#### 方法3: Flutterアプリから接続

Flutterアプリの`main.dart`でエミュレーターを使用する設定を追加：

```dart
// デバッグビルドの場合のみエミュレーターに接続
if (kDebugMode) {
  await FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001);
}
```

---

## デプロイ準備

### ステップ1: 現在のFirebaseプロジェクトの確認

```bash
# 現在アクティブなプロジェクトを確認
firebase use
```

**期待される出力**:
```
Active Project: tokyo-list-478804-e5 (default)
```

**異なるプロジェクトが表示された場合**:
```bash
# プロジェクトを切り替え
firebase use tokyo-list-478804-e5
```

---

### ステップ2: デプロイ対象の確認

```bash
# 現在のfunctions/src/index.tsでエクスポートされている関数を確認
grep -E "^export" functions/src/index.ts
```

**現在エクスポートされている関数**:
- `auth_onCreate` - サインアップ時のユーザードキュメント作成
- `auth_onDelete` - アカウント削除時のクリーンアップ
- `auth_setCustomClaims` - カスタムクレーム設定
- `user_updateProfile` - ユーザープロフィール更新

---

### ステップ3: グローバル設定の確認

`functions/src/index.ts`の先頭にあるグローバル設定を確認：

```typescript
setGlobalOptions({
  region: "asia-northeast1",  // 東京リージョン
  maxInstances: 10,           // コスト制御
  memory: "256MiB",           // メモリ割り当て
  timeoutSeconds: 60,         // タイムアウト
  minInstances: 0,            // コスト最適化
});
```

**重要**: これらの設定はすべての関数に適用されます。個別の関数で上書きすることも可能です。

---

### ステップ4: 環境変数の確認（必要に応じて）

現在のプロジェクトでは環境変数は使用していませんが、将来的にAPIキーなどを追加する場合：

```bash
# 環境変数の一覧を確認
firebase functions:config:get

# 環境変数の設定（例）
firebase functions:config:set someservice.key="THE API KEY"
```

---

## デプロイ実行

### 開発環境へのデプロイ（推奨：初回）

初めてデプロイする場合や、テスト目的の場合は開発環境にデプロイすることを推奨します。

**注意**: 本プロジェクトでは現在、単一のFirebaseプロジェクト（`tokyo-list-478804-e5`）を使用しています。環境分離が必要な場合は別途プロジェクトを作成してください。

---

### デプロイコマンド

#### 方法1: npm scriptを使用（推奨）

```bash
cd functions

# Lint + Build + デプロイ（本番環境）
npm run deploy
```

**実行される処理**:
1. `npm run lint` - コードスタイルチェック
2. `npm run build` - TypeScriptコンパイル
3. `firebase deploy --only functions` - デプロイ実行

---

#### 方法2: Firebase CLIを直接使用

```bash
# プロジェクトルートで実行

# すべてのFunctionsをデプロイ
firebase deploy --only functions

# 特定の関数のみデプロイ
firebase deploy --only functions:user_updateProfile

# 複数の関数をデプロイ
firebase deploy --only functions:auth_onCreate,functions:auth_onDelete
```

---

### デプロイ中の出力例

```
=== Deploying to 'tokyo-list-478804-e5'...

i  deploying functions
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
i  functions: preparing codebase default for deployment
i  functions: preparing functions directory for uploading...
i  functions: packaged functions directory (1.23 MB) for uploading
✔  functions: functions folder uploaded successfully

i  functions: creating Node.js 24 function auth_onCreate(asia-northeast1)...
i  functions: creating Node.js 24 function auth_onDelete(asia-northeast1)...
i  functions: creating Node.js 24 function auth_setCustomClaims(asia-northeast1)...
i  functions: creating Node.js 24 function user_updateProfile(asia-northeast1)...

✔  functions[auth_onCreate(asia-northeast1)]: Successful create operation.
✔  functions[auth_onDelete(asia-northeast1)]: Successful create operation.
✔  functions[auth_setCustomClaims(asia-northeast1)]: Successful create operation.
✔  functions[user_updateProfile(asia-northeast1)]: Successful create operation.

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/tokyo-list-478804-e5/overview
```

**所要時間**: 初回デプロイは5〜10分、更新デプロイは3〜5分程度です。

---

### デプロイ時の注意事項

#### コールドスタート

本プロジェクトでは`minInstances: 0`に設定しているため、関数は使用されていない間は停止します。初回リクエスト時に起動するため、**コールドスタート**（数秒の遅延）が発生します。

**コールドスタート対策**（重要な関数のみ）:
```typescript
// 特定の関数でminInstancesを上書き
export const criticalFunction = functions
  .runWith({ minInstances: 1 })  // 常に1インスタンスを維持
  .https.onCall(async (data, context) => {
    // 処理
  });
```

> **注意**: `minInstances: 1`に設定すると24時間稼働するため、コストが増加します。

---

#### maxInstances制限

`maxInstances: 10`に設定しているため、同時実行数は最大10に制限されます。急激なトラフィック増加時は追加のリクエストがキューイングされます。

---

## デプロイ後の確認

### ステップ1: Firebase Consoleでの確認

1. [Firebase Console](https://console.firebase.google.com/project/tokyo-list-478804-e5/functions)を開く
2. 左側メニュー「Functions」をクリック
3. デプロイされた関数の一覧が表示される

**確認項目**:
- [ ] すべての関数がデプロイされている
- [ ] ステータスが「アクティブ」（緑色のチェックマーク）
- [ ] リージョンが「asia-northeast1」
- [ ] トリガータイプが正しい（HTTP、Firestore、Auth）

---

### ステップ2: ログの確認

```bash
# 最新のログを表示
firebase functions:log

# 特定の関数のログを表示
firebase functions:log --only user_updateProfile

# リアルタイムでログをストリーミング
firebase functions:log --follow
```

**または、Firebase Consoleから**:
1. Functions画面で関数を選択
2. 「ログ」タブをクリック
3. 実行ログ、エラーログが表示される

---

### ステップ3: 動作テスト

#### HTTP Callable関数のテスト

**curlでのテスト**:
```bash
# 本番環境のURLに変更
curl -X POST \
  https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net/user_updateProfile \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_FIREBASE_ID_TOKEN' \
  -d '{
    "data": {
      "userId": "test-user-123",
      "displayName": "本番テストユーザー"
    }
  }'
```

> **注意**: `Authorization`ヘッダーには有効なFirebase IDトークンが必要です。

#### Authトリガーのテスト

1. Flutterアプリまたは[Firebase Console](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/users)から新規ユーザーを作成
2. `auth_onCreate`トリガーが自動実行される
3. Firestoreの`users`コレクションに新しいユーザードキュメントが作成されたことを確認

```bash
# Firestoreのユーザードキュメント確認（gcloud CLI）
gcloud firestore documents describe users/USER_ID --project=tokyo-list-478804-e5
```

---

### ステップ4: パフォーマンス確認

Firebase Console > Functions > 各関数 > 「指標」タブで以下を確認：

- **呼び出し回数**: 期待通りのリクエスト数か
- **実行時間**: 平均実行時間が60秒以内か
- **エラー率**: エラー率が1%未満か
- **メモリ使用量**: 256MiB以内に収まっているか

---

## 環境別デプロイ

### 環境の概念

本プロジェクトでは、将来的に以下の環境分離を想定しています：

| 環境 | Firebaseプロジェクト | 用途 |
|-----|-------------------|------|
| 開発（development） | `tokyo-list-478804-e5-dev`（未作成） | 開発者の個人テスト |
| ステージング（staging） | `tokyo-list-478804-e5-staging`（未作成） | 統合テスト、QA |
| 本番（production） | `tokyo-list-478804-e5` | エンドユーザー向け |

**現状**: 単一プロジェクト（`tokyo-list-478804-e5`）を使用しています。

---

### 複数プロジェクトの設定（将来的に）

```bash
# 開発環境プロジェクトを追加
firebase use --add

# プロジェクトIDを入力: tokyo-list-478804-e5-dev
# エイリアスを入力: dev

# ステージング環境プロジェクトを追加
firebase use --add
# プロジェクトID: tokyo-list-478804-e5-staging
# エイリアス: staging

# 本番環境をデフォルトに設定
firebase use --add
# プロジェクトID: tokyo-list-478804-e5
# エイリアス: production
```

---

### 環境別デプロイコマンド

`package.json`に環境別のデプロイスクリプトが用意されています：

```bash
# 開発環境にデプロイ（Lintスキップ、高速）
npm run deploy:dev

# ステージング環境にデプロイ
npm run deploy:staging

# 本番環境にデプロイ（Lint + 厳密チェック）
npm run deploy:prod
```

**または直接指定**:
```bash
# プロジェクトを指定してデプロイ
firebase deploy --only functions --project dev
firebase deploy --only functions --project staging
firebase deploy --only functions --project production
```

---

## トラブルシューティング

### エラー1: 「Permission denied」

**エラー例**:
```
Error: HTTP Error: 403, The caller does not have permission
```

**原因**: デプロイ権限が不足しています。

**解決方法**:
1. プロジェクトオーナーに以下の権限付与を依頼：
   - `Cloud Functions 開発者`
   - `Service Account ユーザー`

2. 権限確認：
```bash
gcloud projects get-iam-policy tokyo-list-478804-e5 --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"
```

---

### エラー2: 「Build failed」

**エラー例**:
```
Error: Build failed: Build error details: error TS2304: Cannot find name 'XYZ'.
```

**原因**: TypeScriptのコンパイルエラー

**解決方法**:
```bash
# ローカルでビルドしてエラーを確認
cd functions
npm run build

# エラーメッセージを読み、該当箇所を修正
# 型定義が不足している場合は追加インストール
npm install --save-dev @types/PACKAGE_NAME
```

---

### エラー3: 「Quota exceeded」

**エラー例**:
```
Error: Quota exceeded for quota metric 'Functions deployed' and limit 'Functions deployed per minute' of service 'cloudfunctions.googleapis.com'
```

**原因**: 短時間に複数回デプロイしすぎた

**解決方法**:
- 1〜2分待ってから再度デプロイ
- 一度に大量の関数をデプロイしない（段階的にデプロイ）

---

### エラー4: Node.jsバージョン不一致

**エラー例**:
```
Error: The engines field in the functions/package.json states that you need node 24 but you are using node 18.x.x
```

**原因**: ローカルのNode.jsバージョンが要件と異なる

**解決方法**:
```bash
# nvmを使用している場合
nvm install 24
nvm use 24

# バージョン確認
node --version  # v24.x.x
```

---

### エラー5: デプロイがハングする

**症状**: デプロイが途中で止まり、進まなくなる

**原因**: ネットワーク問題、Firebase側の一時的な障害

**解決方法**:
1. `Ctrl+C`でキャンセル
2. しばらく待ってから再度実行
3. それでも解決しない場合は、特定の関数のみデプロイ：
```bash
firebase deploy --only functions:auth_onCreate
```

---

### エラー6: 関数が呼び出せない（404 Not Found）

**原因**:
- 関数名が間違っている
- リージョンが間違っている
- デプロイが完了していない

**解決方法**:
```bash
# デプロイ済みの関数一覧を確認
firebase functions:list

# 正しいURLフォーマット
https://[REGION]-[PROJECT_ID].cloudfunctions.net/[FUNCTION_NAME]
# 例: https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net/user_updateProfile
```

---

### エラー7: メモリ不足（Memory limit exceeded）

**エラー例**:
```
Error: memory limit exceeded
```

**原因**: 関数のメモリ使用量が256MiBを超えた

**解決方法**:
```typescript
// 特定の関数のメモリを増やす
export const largeFunction = functions
  .runWith({ memory: "512MB" })  // 512MBに増やす
  .https.onCall(async (data, context) => {
    // 処理
  });
```

**再デプロイ**:
```bash
npm run deploy
```

---

### デバッグのヒント

#### ローカルとクラウドの動作の違い

**ローカルエミュレーター**:
- Firestoreエミュレーターを使用（データは本番と分離）
- Authenticationエミュレーターを使用（テストユーザーは本番に影響しない）

**クラウド（本番）**:
- 実際のFirestore、Authentication、BigQueryを使用
- 実行結果が本番データに反映される

#### ログの活用

関数内で詳細なログを出力：
```typescript
import { logger } from "firebase-functions/v2";

export const myFunction = functions.https.onCall(async (data, context) => {
  logger.info("Function started", { userId: context.auth?.uid, data });

  try {
    // 処理
    logger.info("Processing successful", { result });
  } catch (error) {
    logger.error("Processing failed", { error, data });
    throw new functions.https.HttpsError("internal", "処理に失敗しました");
  }
});
```

**ログ確認**:
```bash
firebase functions:log --only myFunction
```

---

## ロールバック手順

### なぜロールバックが必要か

デプロイ後に重大なバグが見つかった場合、以前の動作するバージョンに戻す必要があります。

---

### 方法1: 以前のコミットから再デプロイ（推奨）

```bash
# コミット履歴を確認
git log --oneline

# 例:
# e61e40b config: Claude Code通知フックを追加
# 8b38069 test: サービス層拡張テスト追加  ← この時点に戻したい
# e4e95e6 test: GDPRヘルパー・コレクターテスト追加

# 一時的に以前のコミットにチェックアウト
git checkout 8b38069

# 再デプロイ
cd functions
npm run deploy

# 確認後、最新のコミットに戻る
git checkout main
```

---

### 方法2: 特定の関数のみロールバック

Firebase Consoleには直接的なロールバック機能がないため、以下の手順で行います：

1. 以前のバージョンのコードを取得
2. その関数のみ再デプロイ

```bash
# 特定の関数のみデプロイ
firebase deploy --only functions:problemFunction
```

---

### 方法3: 関数を削除（緊急時）

問題のある関数を一時的に削除：

```bash
# 関数を削除
firebase functions:delete FUNCTION_NAME --region asia-northeast1

# 確認プロンプトで「y」を入力
```

**注意**: 削除すると、その関数を呼び出すクライアントはエラーになります。

---

### ロールバックの確認

```bash
# ログを確認して新しいエラーが出ていないか確認
firebase functions:log --only FUNCTION_NAME

# Firebase Consoleで関数の実行状況を確認
# エラー率が下がっていることを確認
```

---

## セキュリティとベストプラクティス

### シークレット管理

**重要**: APIキー、パスワード、トークンなどの機密情報をコードに直接書かないでください。

#### Firebase環境変数の使用

```bash
# シークレットを設定
firebase functions:config:set someservice.key="YOUR_API_KEY"

# 確認
firebase functions:config:get

# コード内での使用
import * as functions from "firebase-functions";

const apiKey = functions.config().someservice.key;
```

#### Google Secret Managerの使用（推奨・将来的に）

```typescript
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/tokyo-list-478804-e5/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || "";
}
```

---

### 環境変数の扱い

**絶対にコミットしない**:
- `.env`ファイル
- `service-account.json`
- APIキーを含むファイル

`.gitignore`に追加されていることを確認：
```
# functions/.gitignore
.env
.env.local
service-account*.json
```

---

### 認証の徹底

すべてのHTTP Callable関数で認証をチェック：

```typescript
export const secureFunction = functions.https.onCall(async (data, context) => {
  // 認証チェック
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
  }

  // 権限チェック
  if (context.auth.uid !== data.userId) {
    throw new functions.https.HttpsError("permission-denied", "権限がありません");
  }

  // 処理
});
```

---

### レート制限

DoS攻撃を防ぐため、レート制限を実装：

```typescript
// middleware/rateLimiter.ts を使用
import { checkRateLimit } from "../middleware/rateLimiter";

export const limitedFunction = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid;
  if (!userId) throw new functions.https.HttpsError("unauthenticated", "認証が必要です");

  // レート制限チェック（1分間に10回まで）
  await checkRateLimit(userId, "limitedFunction", 10, 60);

  // 処理
});
```

---

### エラーハンドリング

ユーザーに詳細なエラー情報を返さない：

**❌ 悪い例**:
```typescript
catch (error) {
  throw new functions.https.HttpsError("internal", error.message);  // スタックトレースが漏洩
}
```

**✅ 良い例**:
```typescript
catch (error) {
  logger.error("Processing failed", { error, userId: context.auth?.uid });
  throw new functions.https.HttpsError("internal", "処理に失敗しました");  // 一般的なメッセージ
}
```

---

### コスト管理

#### maxInstancesの設定

```typescript
setGlobalOptions({
  maxInstances: 10,  // 同時実行数を制限してコストを抑える
});
```

#### タイムアウトの適切な設定

```typescript
setGlobalOptions({
  timeoutSeconds: 60,  // 不要に長いタイムアウトを避ける
});
```

#### メモリの最適化

```typescript
// デフォルト256MiBで十分な場合が多い
// 必要な場合のみ増やす
export const heavyFunction = functions
  .runWith({ memory: "512MB" })  // 必要最小限に
  .https.onCall(async (data, context) => {
    // 処理
  });
```

---

### GDPR準拠

**個人情報の取り扱い**:
- ログに個人情報（メールアドレス、氏名など）を含めない
- BigQueryへのデータ送信時は仮名化（ハッシュ化）する
- ユーザー削除リクエスト時は30日以内にすべてのデータを削除

**参照仕様書**:
- `docs/specs/06_データ処理記録_ROPA_v1_0.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

---

## デプロイチェックリスト

デプロイ前に以下を確認してください：

### コード品質
- [ ] `npm run lint`がエラーなく完了
- [ ] `npm test`がすべて成功
- [ ] TypeScriptビルド（`npm run build`）が成功

### セキュリティ
- [ ] 認証チェックが実装されている
- [ ] APIキーなどの機密情報がコード内にない
- [ ] レート制限が適切に設定されている

### パフォーマンス
- [ ] 不要なnpmパッケージをインポートしていない（コールドスタート対策）
- [ ] メモリ使用量が適切（256MiBで足りるか）
- [ ] タイムアウトが適切（60秒以内）

### テスト
- [ ] ローカルエミュレーターで動作確認済み
- [ ] 各関数の正常系・異常系をテスト済み
- [ ] ログ出力が適切

### ドキュメント
- [ ] コードにコメント（英語）を記載
- [ ] 新しい関数を追加した場合、README更新

### デプロイ後
- [ ] Firebase Consoleで関数がアクティブか確認
- [ ] ログにエラーが出ていないか確認
- [ ] 動作テストを実施

---

## まとめ

このガイドに従って、以下を達成しました：

- [x] Firebase Functionsのローカル開発とテスト
- [x] 安全なデプロイ手順の理解
- [x] デプロイ後の確認方法
- [x] トラブルシューティング方法
- [x] ロールバック手順
- [x] セキュリティベストプラクティス

---

## 関連ドキュメント

- [開発環境セットアップガイド](./DEVELOPMENT_SETUP_GUIDE.md) - 初回環境構築
- [BigQueryセットアップガイド](./BIGQUERY_SETUP_GUIDE.md) - BigQuery設定
- [CI/CDセットアップガイド](../CI_CD_SETUP.md) - GitHub Actions自動デプロイ
- [システムアーキテクチャ設計書](../specs/01_システムアーキテクチャ設計書_v3_2.md) - 全体設計
- [API設計書](../specs/03_API設計書_Firebase_Functions_v3_3.md) - API仕様
- [セキュリティポリシー](../specs/07_セキュリティポリシー_v1_0.md) - セキュリティ要件

---

## 参考リンク

**公式ドキュメント**:
- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
- [Cloud Functions for Firebase (2nd gen)](https://firebase.google.com/docs/functions/beta)
- [Firebase CLI リファレンス](https://firebase.google.com/docs/cli)

**コミュニティ**:
- [Firebase公式サポート](https://firebase.google.com/support)
- [Stack Overflow（firebase-cloud-functions タグ）](https://stackoverflow.com/questions/tagged/firebase-cloud-functions)

---

**ドキュメント履歴**:
- 2025-12-01: 初版作成
