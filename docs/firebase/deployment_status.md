# Firebase デプロイメント状況レポート

**作成日**: 2025-12-04
**プロジェクトID**: tokyo-list-478804-e5
**リージョン**: asia-northeast1 (東京)

---

## 概要

本ドキュメントは、AI Fitness App の Firebase セットアップ状況と次のステップをまとめたものです。

---

## 完了したタスク

### 1. Firebase プロジェクト設定 ✅

| 項目 | 状態 | 詳細 |
|------|------|------|
| プロジェクト作成 | ✅ 完了 | tokyo-list-478804-e5 |
| Blazeプラン | ✅ 完了 | 従量課金に移行済み |
| メール/パスワード認証 | ✅ 完了 | Firebase Console で有効化済み |
| Google認証 | ✅ 完了 | Firebase Console で有効化済み |

### 2. アプリ登録 ✅

| プラットフォーム | App ID | 状態 |
|-----------------|--------|------|
| Android | 1:895851221884:android:69a794cec56d3b1dcb8af9 | ✅ 登録済み |
| iOS | 1:895851221884:ios:f30b4eb0204f5ab1cb8af9 | ✅ 登録済み |
| Web (1) | 1:895851221884:web:45b4df28930a7922cb8af9 | ✅ 登録済み |
| Web (2) | 1:895851221884:web:07a9f4a94f794b9ecb8af9 | ✅ 登録済み |

### 3. Firestore ✅

| 項目 | 状態 | ファイル |
|------|------|----------|
| セキュリティルール | ✅ デプロイ完了 | `firebase/firestore.rules` |
| インデックス | ✅ デプロイ完了 | `firebase/firestore.indexes.json` |

**デプロイコマンド**:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Cloud Storage ✅

| 項目 | 状態 | ファイル |
|------|------|----------|
| セキュリティルール | ✅ デプロイ完了 | `firebase/storage.rules` |

**デプロイコマンド**:
```bash
firebase deploy --only storage
```

### 5. エミュレータ設定 ✅

| サービス | ポート | 状態 |
|----------|--------|------|
| Auth | 9099 | ✅ 設定済み |
| Firestore | 8080 | ✅ 設定済み |
| Functions | 5001 | ✅ 設定済み |
| Storage | 9199 | ✅ 設定済み |
| Emulator UI | 4000 | ✅ 設定済み |

**起動コマンド**:
```bash
firebase emulators:start
```

---

## 未完了タスク

### 1. Cloud Functions デプロイ ⏸️ (ブロック中)

**状態**: Google App Engine の初期化が必要

**エラーメッセージ**:
```
Could not authenticate 'service-895851221884@gcf-admin-robot.iam.gserviceaccount.com': Not found
```

**原因**: Cloud Functions v2 は App Engine のインフラストラクチャを使用するため、App Engine インスタンスの作成が前提条件となります。

---

## 次のステップ

### Step 1: Google App Engine の初期化 (必須)

Cloud Functions をデプロイするために、App Engine インスタンスを作成する必要があります。

**方法 A: GCP Console (推奨)**

1. [Google Cloud Console - App Engine](https://console.cloud.google.com/appengine?project=tokyo-list-478804-e5) にアクセス
2. 「アプリケーションを作成」をクリック
3. リージョンを選択: **asia-northeast1 (東京)**
4. 言語/環境: 任意（例: Node.js、Standard environment）
5. 「作成」をクリック

**方法 B: gcloud CLI**

```bash
gcloud app create --project=tokyo-list-478804-e5 --region=asia-northeast1
```

> **注意**: App Engine のリージョンは一度設定すると変更できません。必ず `asia-northeast1` (東京) を選択してください。

### Step 2: Cloud Functions のデプロイ

App Engine 初期化後、以下のコマンドで Cloud Functions をデプロイします：

```bash
cd C:\Users\236149\Desktop\ai_fitness_app
firebase deploy --only functions --force
```

**デプロイされる関数一覧**:

| 関数名 | タイプ | 説明 |
|--------|--------|------|
| auth_onCreate | Auth Trigger | ユーザー作成時にプロフィール初期化 |
| auth_onDelete | Auth Trigger | ユーザー削除時のクリーンアップ |
| auth_setCustomClaims | Callable | カスタムクレーム設定（管理者用） |
| user_updateProfile | Callable | プロフィール更新 API |
| consent_record | Callable | 同意記録 API |
| consent_revoke | Callable | 同意撤回 API |
| consent_status | Callable | 同意状態取得 API |
| gdpr_exportData | Callable | データエクスポート API |
| gdpr_deleteData | Callable | データ削除リクエスト API |
| gdpr_recoverData | Callable | データ復元 API |
| triggers_onConsentCreated | Firestore Trigger | 同意作成時の処理 |
| triggers_onSessionCreated | Firestore Trigger | セッション作成時の処理 |
| triggers_onSessionUpdated | Firestore Trigger | セッション更新時の処理 |
| processTrainingSession | Pub/Sub Trigger | トレーニングセッションの BigQuery 同期 |

### Step 3: デプロイ検証

```bash
# デプロイされた関数の一覧を確認
firebase functions:list

# 関数のログを確認
firebase functions:log
```

### Step 4: 追加設定 (オプション)

#### Apple Sign In (iOS)
1. Apple Developer Console でサービス ID を作成
2. Firebase Console > Authentication > Sign-in method > Apple で設定

#### CI/CD 用 Firebase Token
```bash
firebase login:ci
```
生成されたトークンを GitHub Secrets に `FIREBASE_TOKEN` として登録

---

## 参考コマンド集

```bash
# 全体デプロイ
firebase deploy

# 個別デプロイ
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only functions
firebase deploy --only functions:auth_onCreate  # 特定の関数のみ

# エミュレータ
firebase emulators:start
firebase emulators:start --only functions,firestore

# ログ確認
firebase functions:log
firebase functions:log --only auth_onCreate

# プロジェクト切り替え
firebase use default
firebase use dev
firebase use production
```

---

## トラブルシューティング

### 問題: Functions デプロイ時に認証エラー

**エラー**:
```
Could not authenticate 'service-XXX@gcf-admin-robot.iam.gserviceaccount.com'
```

**解決方法**:
1. App Engine を初期化する（上記 Step 1 参照）
2. 必要な API が有効になっているか確認:
   - Cloud Functions API
   - Cloud Build API
   - Artifact Registry API
   - Cloud Run API

### 問題: Firestore ルールのコンパイルエラー

**警告**:
```
[W] 49:14 - Unused function: isNotForcedLogout
[W] 50:21 - Invalid function name: get
```

**状態**: 警告のみでデプロイは成功。将来的にルールを最適化することを推奨。

---

## 関連ドキュメント

- [Firebase Project Setup Ticket](../tickets/001_firebase_project_setup.md)
- [Firestore Security Rules Ticket](../tickets/002_firestore_security_rules.md)
- [Firebase Authentication Ticket](../tickets/003_firebase_authentication.md)
- [Cloud Functions Infrastructure Ticket](../tickets/004_cloud_functions_infrastructure.md)
- [Firestore Database Design](../specs/02_Firestoreデータベース設計書_v3_3.md)
- [API Design](../specs/03_API設計書_Firebase_Functions_v3_3.md)

---

## 更新履歴

| 日付 | 更新内容 |
|------|----------|
| 2025-12-04 | 初版作成。Firestore/Storage ルールデプロイ完了、Functions デプロイは App Engine 初期化待ち |
