# CI/CD パイプライン ガイド

このドキュメントでは、AI Fitness Appプロジェクトの継続的インテグレーション（CI）および継続的デプロイ（CD）パイプラインについて説明します。

## 概要

本プロジェクトでは GitHub Actions を使用してCI/CDパイプラインを構築しています。

### ワークフロー一覧

| ワークフロー | ファイル | トリガー | 目的 |
|------------|---------|---------|------|
| Cloud Functions CI | `functions-ci.yml` | PR作成/更新、main push | Lint、テスト、セキュリティチェック |
| Firestore Rules CI | `firestore-rules-ci.yml` | PR作成/更新、main push | ルールのバリデーションとテスト |
| PR Validation | `pr.yml` | PR作成/更新 | Flutter/Functions/Rulesの総合チェック |
| Deploy to Firebase | `deploy.yml` | main push、手動、リリース | Firebase各種リソースのデプロイ |
| Build Flutter App | `app-build.yml` | タグ作成、手動 | Android/iOSアプリのビルド |

## デプロイフロー

### 開発フロー

```
[開発者] ── feature branch作成 ──> [ローカル開発]
                                        |
                                        v
                                   コミット・プッシュ
                                        |
                                        v
                              PR作成 ──> [GitHub Actions CI]
                                        |
                                        v
                                 ┌──────────────┐
                                 │  Lint        │
                                 │  Build       │
                                 │  Test        │
                                 │  Security    │
                                 └──────────────┘
                                        |
                                        v
                              レビュー・承認 ──> main マージ
                                                    |
                                                    v
                                            [GitHub Actions CD]
                                                    |
                                                    v
                                            開発環境へデプロイ
```

### 本番デプロイフロー

```
[main ブランチ] ── リリースタグ作成 ──> [GitHub Actions CD]
                   (v1.0.0 など)              |
                                              v
                                    ┌─────────────────┐
                                    │ Pre-deploy Test │
                                    └─────────────────┘
                                              |
                                              v
                                    ┌─────────────────┐
                                    │ 承認待ち        │
                                    │ (production環境)│
                                    └─────────────────┘
                                              |
                                    承認後     v
                                    ┌─────────────────┐
                                    │ Deploy          │
                                    │ - Functions     │
                                    │ - Rules         │
                                    │ - Indexes       │
                                    └─────────────────┘
                                              |
                                              v
                                    ┌─────────────────┐
                                    │ Health Check    │
                                    │ 通知            │
                                    └─────────────────┘
```

## CI パイプライン詳細

### Cloud Functions CI (`functions-ci.yml`)

**トリガー条件:**
- `functions/` 配下のファイル変更を含むPR
- mainブランチへのpush

**実行ジョブ:**

1. **Lint & Format**
   - ESLint によるコード品質チェック
   - Prettier によるフォーマットチェック

2. **Build**
   - TypeScript コンパイル
   - ビルド成果物の生成

3. **Unit Tests & Coverage**
   - Jest によるユニットテスト実行
   - カバレッジレポート生成（目標: 80%以上）
   - Codecov へのアップロード

4. **Security Audit**
   - `npm audit` による脆弱性チェック
   - Critical/High 脆弱性の検出

5. **Integration Tests**
   - Firebase Emulator を使用した統合テスト

### Firestore Rules CI (`firestore-rules-ci.yml`)

**トリガー条件:**
- `firebase/firestore.rules` または `firebase/storage.rules` の変更を含むPR
- テストファイルの変更

**実行ジョブ:**

1. **Validate Rules Syntax**
   - Firebase CLI による構文チェック

2. **Test Security Rules**
   - Firestore Emulator を使用したルールテスト
   - `@firebase/rules-unit-testing` によるテスト実行

3. **Security Analysis**
   - 危険なパターンの検出
   - デフォルト拒否ルールの確認

## CD パイプライン詳細

### Deploy to Firebase (`deploy.yml`)

**トリガー条件:**
- mainブランチへのpush（開発環境）
- リリースタグ作成（本番環境）
- 手動トリガー（任意の環境）

**デプロイ対象:**
- Cloud Functions
- Firestore Security Rules
- Storage Security Rules
- Firestore Indexes

**環境:**

| 環境 | トリガー | 承認 | Firebase Project |
|------|---------|------|------------------|
| development | main push | 不要 | tokyo-list-478804-e5 |
| staging | 手動 | 不要 | tokyo-list-478804-e5 |
| production | リリースタグ/手動 | 必要 | tokyo-list-478804-e5 |

## GitHub Secrets 設定

以下のSecretsをGitHubリポジトリに設定する必要があります:

| Secret名 | 説明 | 必須 |
|----------|------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase サービスアカウントキー（JSON） | Yes |
| `CODECOV_TOKEN` | Codecov アップロード用トークン | No |

### Variables（環境変数）

| Variable名 | 説明 | 値 |
|------------|------|-----|
| `DEPLOY_ENABLED` | デプロイの有効/無効 | `true` or `false` |
| `SLACK_WEBHOOK_URL` | Slack通知用Webhook URL | URL |

## GitHub Environments 設定

本番デプロイに承認機能を有効にするには、GitHub リポジトリで Environment を設定します:

1. リポジトリ設定 > Environments に移動
2. `production` 環境を作成
3. "Required reviewers" を有効化
4. 承認者を追加

## ロールバック手順

### Cloud Functions のロールバック

**方法1: Git revert**
```bash
# 問題のあるコミットを特定
git log --oneline

# revert コミットを作成
git revert <commit-hash>
git push origin main

# 自動でCDが実行され、前のバージョンがデプロイされる
```

**方法2: Firebase Console**
1. [Firebase Console](https://console.firebase.google.com/project/tokyo-list-478804-e5/functions) にアクセス
2. Functions > ダッシュボード
3. 関数の詳細から以前のバージョンを確認
4. 必要に応じて手動でロールバック

**方法3: 手動デプロイ**
```bash
# 前のタグをチェックアウト
git checkout <previous-tag>

# 手動でデプロイ
firebase deploy --only functions --project tokyo-list-478804-e5
```

### Firestore Rules のロールバック

```bash
# 前のルールバージョンをチェックアウト
git checkout <previous-commit> -- firebase/firestore.rules

# 手動でデプロイ
firebase deploy --only firestore:rules --project tokyo-list-478804-e5
```

### Storage Rules のロールバック

```bash
# 前のルールバージョンをチェックアウト
git checkout <previous-commit> -- firebase/storage.rules

# 手動でデプロイ
firebase deploy --only storage:rules --project tokyo-list-478804-e5
```

## トラブルシューティング

### CI が失敗する場合

1. **Lint エラー**
   ```bash
   cd functions
   npm run lint:fix
   npm run format
   ```

2. **テスト失敗**
   ```bash
   cd functions
   npm test -- --verbose
   ```

3. **ビルドエラー**
   ```bash
   cd functions
   npm run clean
   npm run build
   ```

### デプロイが失敗する場合

1. **認証エラー**
   - `GOOGLE_APPLICATION_CREDENTIALS` シークレットが正しく設定されているか確認
   - サービスアカウントに必要な権限があるか確認

2. **Firestore Rules 構文エラー**
   ```bash
   firebase --project tokyo-list-478804-e5 firestore:rules:validate firebase/firestore.rules
   ```

3. **Functions デプロイエラー**
   - Firebase Console でログを確認
   - `firebase functions:log` でデプロイログを確認

### Emulator テストが失敗する場合

1. Java がインストールされているか確認（JDK 11以上）
2. ポートが使用中でないか確認
   - Firestore: 8080
   - Auth: 9099
   - Functions: 5001

## 参照ドキュメント

- [チケット008: CI/CDパイプライン](./tickets/008-cicd-pipeline.md)
- [非機能要件 NFR-026, NFR-027](./specs/02-2_非機能要件_v1_0.md)
- [Firebase CLI ドキュメント](https://firebase.google.com/docs/cli)
- [GitHub Actions ドキュメント](https://docs.github.com/actions)

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
