# 環境変数セットアップガイド

**バージョン**: 1.0
**最終更新日**: 2025年12月10日
**対象**: AIフィットネスアプリ開発環境
**関連チケット**: 001-firebase-environment.md

---

## 目次

1. [概要](#概要)
2. [Firebase プロジェクト情報](#firebase-プロジェクト情報)
3. [環境変数の設定](#環境変数の設定)
4. [開発環境セットアップ](#開発環境セットアップ)
5. [本番環境セットアップ](#本番環境セットアップ)
6. [環境変数の検証](#環境変数の検証)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

このドキュメントでは、AIフィットネスアプリの開発・本番環境における環境変数の設定方法を説明します。

### 環境構成

| 環境 | Firebase Project ID | リージョン | 用途 |
|------|-------------------|----------|------|
| 開発 (dev) | tokyo-list-478804-e5 | asia-northeast1 | ローカル開発、エミュレータ |
| ステージング (staging) | tokyo-list-478804-e5 | asia-northeast1 | テスト環境（将来） |
| 本番 (production) | tokyo-list-478804-e5 | asia-northeast1 | 本番環境 |

**注**: 現在は単一プロジェクトで全環境を運用。本番環境への昇格時に別プロジェクトを作成する予定。

---

## Firebase プロジェクト情報

```
Firebase Project ID: tokyo-list-478804-e5
リージョン: asia-northeast1（東京）
プラットフォーム: Expo (React Native), Flutter
バックエンド: Firebase Cloud Functions (TypeScript)
データベース: Cloud Firestore
分析: BigQuery
```

---

## 環境変数の設定

### 1. プロジェクトルートでの設定

プロジェクトルートに `.env.local` ファイルを作成（gitignore対象）:

```bash
# .env.local（開発環境用）

# Firebase プロジェクト ID
GOOGLE_CLOUD_PROJECT=tokyo-list-478804-e5
FIREBASE_PROJECT_ID=tokyo-list-478804-e5

# 実行環境
NODE_ENV=development
ENVIRONMENT=development

# エミュレータ設定（オプション）
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
```

### 2. Cloud Functions 用の環境変数

Cloud Functions は `firebase.json` と `.firebaserc` から自動的にプロジェクト情報を読み取ります。

追加の環境変数が必要な場合は Firebase Functions Config を使用:

```bash
# Cloud Functions Config の設定（本番環境のみ）
firebase functions:config:set \
  app.environment="production" \
  app.region="asia-northeast1"

# 設定の確認
firebase functions:config:get

# ローカルで本番環境設定を使う場合
firebase functions:config:get > functions/.runtimeconfig.json
```

### 3. Expo アプリ用の環境変数

`expo_app/.env.local` を作成:

```bash
# Expo アプリ用 .env.local

# Firebase 設定（expo_app/firebase.config.ts から読み取り）
EXPO_PUBLIC_FIREBASE_API_KEY=（Firebase Console から取得）
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tokyo-list-478804-e5.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tokyo-list-478804-e5
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tokyo-list-478804-e5.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=（Firebase Console から取得）
EXPO_PUBLIC_FIREBASE_APP_ID=（Firebase Console から取得）

# エミュレータ使用フラグ
EXPO_PUBLIC_USE_EMULATOR=true
```

**重要**: `EXPO_PUBLIC_` プレフィックスは必須（Expoがクライアント側で読み取るため）

### 4. Flutter アプリ用の環境変数

Flutter は `firebase_options.dart` から自動生成された設定を使用します。

FlutterFire CLI で設定を再生成する場合:

```bash
cd flutter_app
flutterfire configure --project=tokyo-list-478804-e5
```

---

## 開発環境セットアップ

### ステップ 1: Firebase CLI のインストール

```bash
# Firebase CLI をグローバルにインストール
npm install -g firebase-tools

# バージョン確認
firebase --version
```

### ステップ 2: Firebase にログイン

```bash
# ブラウザで認証
firebase login

# ログイン状態確認
firebase login:list

# 現在のプロジェクトを確認
firebase projects:list
```

### ステップ 3: プロジェクトの選択

```bash
# プロジェクトルートで実行
firebase use tokyo-list-478804-e5

# または環境別に切り替え
firebase use dev
```

### ステップ 4: エミュレータの起動

```bash
# プロジェクトルートで実行
firebase emulators:start

# エミュレータ UI を開く
# http://localhost:4000
```

**エミュレータポート一覧**:
- Auth: 9099
- Firestore: 8080
- Functions: 5001
- Storage: 9199
- UI: 4000

---

## 本番環境セットアップ

### ステップ 1: 本番用 Firebase Functions Config の設定

```bash
# 本番環境に切り替え
firebase use production

# 環境変数を設定
firebase functions:config:set \
  app.environment="production" \
  app.region="asia-northeast1" \
  bigquery.dataset="ai_fitness_prod" \
  bigquery.table="training_sessions"

# 設定の確認
firebase functions:config:get
```

### ステップ 2: デプロイ前の確認

```bash
# セキュリティルールの検証
firebase deploy --only firestore:rules --dry-run

# Functions のビルド確認
cd functions
npm run build

# テスト実行
npm test
```

### ステップ 3: 本番デプロイ

```bash
# 全体デプロイ
firebase deploy

# Functions のみ
firebase deploy --only functions

# Firestore ルールのみ
firebase deploy --only firestore:rules

# Storage ルールのみ
firebase deploy --only storage:rules
```

---

## 環境変数の検証

### 1. Firebase プロジェクト確認

```bash
# 現在のプロジェクトを確認
firebase projects:list
firebase use

# プロジェクト情報の詳細
firebase projects:get tokyo-list-478804-e5
```

### 2. Cloud Functions Config 確認

```bash
# 本番環境の設定を確認
firebase use production
firebase functions:config:get

# 開発環境の設定を確認
firebase use dev
firebase functions:config:get
```

### 3. エミュレータ接続テスト

```bash
# エミュレータ起動
firebase emulators:start

# 別ターミナルで Firestore 接続テスト
curl http://localhost:8080

# Auth エミュレータ接続テスト
curl http://localhost:9099
```

---

## トラブルシューティング

### 問題 1: Firebase CLI がプロジェクトを認識しない

**症状**:
```
Error: Failed to get Firebase project tokyo-list-478804-e5
```

**解決策**:
```bash
# 再ログイン
firebase logout
firebase login

# プロジェクトを明示的に指定
firebase use --add tokyo-list-478804-e5
```

### 問題 2: エミュレータが起動しない

**症状**:
```
Error: Port 8080 is already in use
```

**解決策**:
```bash
# ポートを使用しているプロセスを特定（Windows）
netstat -ano | findstr :8080

# プロセスを終了
taskkill /PID <プロセスID> /F

# または別のポートを使用
firebase emulators:start --only firestore --port=8081
```

### 問題 3: Cloud Functions のデプロイが失敗する

**症状**:
```
Error: Failed to deploy functions
```

**解決策**:
```bash
# ビルドエラーを確認
cd functions
npm run build

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScript 設定を確認
npm run lint

# デプロイを再試行
firebase deploy --only functions
```

### 問題 4: Firestore ルールのデプロイが失敗する

**症状**:
```
Error: Invalid security rules
```

**解決策**:
```bash
# ルールの検証
firebase deploy --only firestore:rules --dry-run

# ルールファイルの構文チェック
cat firebase/firestore.rules

# エミュレータでテスト
firebase emulators:start --only firestore
npm test  # セキュリティルールのテストを実行
```

### 問題 5: 環境変数が読み込まれない

**症状**:
- `process.env.FIREBASE_PROJECT_ID` が undefined

**解決策**:
```bash
# .env.local の存在確認
ls -la .env.local

# ファイルの内容確認
cat .env.local

# アプリの再起動
# Expo の場合
npm start -- --reset-cache

# Functions の場合
firebase emulators:start --only functions
```

---

## セキュリティのベストプラクティス

### 1. 機密情報の管理

**絶対に Git にコミットしてはいけないファイル**:
- `.env.local`
- `.env.production`
- `functions/.runtimeconfig.json`
- `firebase-debug.log`
- サービスアカウントキー（`*.json`）

**.gitignore に追加**:
```
# Environment files
.env.local
.env.*.local
*.env

# Firebase
.firebase/
firebase-debug.log
functions/.runtimeconfig.json

# Service account keys
*-firebase-adminsdk-*.json
```

### 2. API キーの取り扱い

- Firebase API キーはクライアント側で公開されるため、セキュリティルールで保護する
- 本番環境では Firebase Console で API キーの制限を設定:
  - HTTP リファラー制限
  - アプリ署名の制限（モバイル）

### 3. Cloud Functions Config の暗号化

機密情報は Firebase Functions Config または Secret Manager を使用:

```bash
# Secret Manager を使用（推奨）
firebase functions:secrets:set STRIPE_SECRET_KEY

# 関数内で使用
import { defineSecret } from "firebase-functions/params";
const stripeSecret = defineSecret("STRIPE_SECRET_KEY");

export const processPayment = onRequest(
  { secrets: [stripeSecret] },
  async (req, res) => {
    const apiKey = stripeSecret.value();
    // ...
  }
);
```

---

## 関連ドキュメント

- [Firebase CLI リファレンス](https://firebase.google.com/docs/cli)
- [Cloud Functions 環境設定](https://firebase.google.com/docs/functions/config-env)
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)
- チケット001: `docs/common/tickets/001-firebase-environment.md`
- チケット002: `docs/common/tickets/002-firestore-security-rules.md`
- チケット003: `docs/common/tickets/003-cloud-functions-infrastructure.md`

---

## 変更履歴

| 日付 | 変更内容 | 担当 |
|------|----------|------|
| 2025-12-10 | 初版作成 | Phase 1 実装 |
