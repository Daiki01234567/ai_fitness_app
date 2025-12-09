# 008 環境設定・デプロイパイプライン

## 概要

開発環境、ステージング環境、本番環境を分離し、GitHub Actionsを使用したCI/CDパイプラインを構築するチケットです。自動テスト、自動デプロイ、環境変数管理、ロールバック機能などを実装し、安全かつ効率的なリリース体制を構築します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築

## 要件

### 機能要件

- なし（基盤機能のため）

### 非機能要件

- NFR-037: デプロイ - CI/CD パイプライン、環境分離

## 受け入れ条件（Todo）

- [ ] 環境分離設定（development, staging, production）
- [ ] `.firebaserc` ファイルの設定
- [ ] 環境変数管理の実装（Firebase環境設定）
- [ ] GitHub Actions CI/CD パイプラインの構築
- [ ] 自動テスト実行の実装（PR作成時）
- [ ] 自動デプロイの実装（mainブランチマージ時）
- [ ] ロールバック機能の実装
- [ ] デプロイ前のFirestoreルール検証
- [ ] デプロイ後のスモークテスト実装
- [ ] ドキュメント作成（デプロイ手順、トラブルシューティング）

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-037
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件

## 技術詳細

### 環境分離構成

#### Firebase プロジェクト構成

| 環境 | プロジェクトID | 用途 | デプロイ条件 |
|------|--------------|------|------------|
| **Development** | `tokyo-list-478804-e5-dev` | 開発者ローカル環境 | 手動デプロイ |
| **Staging** | `tokyo-list-478804-e5-stg` | リリース前テスト環境 | developブランチへのマージ |
| **Production** | `tokyo-list-478804-e5` | 本番環境 | mainブランチへのマージ |

#### .firebaserc 設定

```json
{
  "projects": {
    "development": "tokyo-list-478804-e5-dev",
    "staging": "tokyo-list-478804-e5-stg",
    "production": "tokyo-list-478804-e5"
  },
  "targets": {},
  "etags": {}
}
```

#### 環境切り替え

```bash
# 開発環境に切り替え
firebase use development

# ステージング環境に切り替え
firebase use staging

# 本番環境に切り替え
firebase use production
```

### 環境変数管理

#### Firebase環境設定

```bash
# 開発環境の環境変数設定
firebase functions:config:set \
  stripe.secret_key="sk_test_..." \
  --project development

# 本番環境の環境変数設定
firebase functions:config:set \
  stripe.secret_key="sk_live_..." \
  --project production

# 環境変数の確認
firebase functions:config:get --project production
```

#### functions/src/config.ts

```typescript
import * as functions from 'firebase-functions';

/**
 * 環境変数設定
 */
export const config = {
  stripe: {
    secretKey: functions.config().stripe.secret_key,
    webhookSecret: functions.config().stripe.webhook_secret,
  },
  bigquery: {
    datasetId: functions.config().bigquery?.dataset_id || 'fitness_data',
  },
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
```

### GitHub Actions CI/CD パイプライン

#### ディレクトリ構成

```
.github/
└── workflows/
    ├── ci.yml                  # PR時の自動テスト
    ├── deploy-staging.yml      # ステージング環境へのデプロイ
    └── deploy-production.yml   # 本番環境へのデプロイ
```

#### ci.yml（PR時の自動テスト）

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
      - develop

jobs:
  test-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./functions
        run: npm ci

      - name: Run linter
        working-directory: ./functions
        run: npm run lint

      - name: Run tests
        working-directory: ./functions
        run: npm test

      - name: Build
        working-directory: ./functions
        run: npm run build

  test-firestore-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Validate Firestore Rules
        run: |
          npm install -g firebase-tools
          firebase emulators:exec --only firestore \
            "npm test" --project=development
```

#### deploy-staging.yml（ステージング環境へのデプロイ）

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./functions
        run: npm ci

      - name: Build
        working-directory: ./functions
        run: npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}'
          projectId: tokyo-list-478804-e5-stg
          channelId: live

      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging
```

#### deploy-production.yml（本番環境へのデプロイ）

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./functions
        run: npm ci

      - name: Build
        working-directory: ./functions
        run: npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_PRODUCTION }}'
          projectId: tokyo-list-478804-e5
          channelId: live

      - name: Run smoke tests
        run: npm run test:smoke -- --env=production

      - name: Notify deployment
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "🚀 Production deployment completed successfully!"
            }
```

### ロールバック機能

#### 手動ロールバック

```bash
# 過去のデプロイを確認
firebase functions:list --project production

# 特定バージョンにロールバック
firebase functions:rollback user_updateProfile --version=12345 --project production
```

#### 自動ロールバック（スモークテスト失敗時）

```yaml
- name: Rollback on failure
  if: failure()
  run: |
    firebase functions:rollback --all --project production
```

### デプロイ前検証

#### Firestoreルール検証

```bash
# ルールの構文チェック
firebase deploy --only firestore:rules --dry-run --project staging

# エミュレータでテスト
firebase emulators:start --only firestore
npm run test:firestore-rules
```

#### スモークテスト

```typescript
// tests/smoke.test.ts
import { httpsCallable } from 'firebase/functions';

describe('Smoke Tests', () => {
  it('should call user_getProfile successfully', async () => {
    const getProfile = httpsCallable(functions, 'user_getProfile');
    const result = await getProfile({ userId: 'test-user-id' });
    expect(result.data.success).toBe(true);
  });
});
```

### デプロイフロー

#### 開発フロー

```
1. Feature branchで開発
   ↓
2. PR作成（develop or mainへ）
   ↓
3. CI実行（自動テスト、lint、build）
   ↓
4. レビュー・承認
   ↓
5. マージ
   ↓
6. 自動デプロイ（staging or production）
   ↓
7. スモークテスト
   ↓
8. デプロイ完了通知（Slack）
```

#### ロールバックフロー

```
1. 問題検知（エラー率高騰、スモークテスト失敗）
   ↓
2. ロールバック判断
   ↓
3. 手動ロールバック実行 or 自動ロールバック
   ↓
4. スモークテスト
   ↓
5. 原因調査・修正
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### Firebase サービスアカウント設定

GitHub Actionsで自動デプロイを行うには、Firebaseサービスアカウントが必要です。

```bash
# サービスアカウントキーを生成
firebase login:ci

# GitHubのSecretsに登録
# Settings > Secrets and variables > Actions > New repository secret
# 名前: FIREBASE_SERVICE_ACCOUNT_PRODUCTION
# 値: 生成されたトークン
```

### 環境変数の管理

**機密情報の保護**:
- `.env` ファイルは `.gitignore` に追加
- 本番環境の環境変数はFirebase環境設定で管理
- GitHub Secretsで管理（CI/CD用）

**設定例**:

```bash
# 開発環境（.env.local）
STRIPE_SECRET_KEY=sk_test_...
ENVIRONMENT=development

# 本番環境（Firebase環境設定）
firebase functions:config:set \
  stripe.secret_key="sk_live_..." \
  environment="production" \
  --project production
```

### デプロイ時の注意点

- **本番デプロイは慎重に**: 必ずステージング環境でテスト後にデプロイ
- **ピーク時間を避ける**: ユーザーが少ない時間帯（深夜）にデプロイ
- **監視を強化**: デプロイ後1時間は監視ダッシュボードを確認
- **ロールバック準備**: 問題発生時にすぐロールバックできるよう準備

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
