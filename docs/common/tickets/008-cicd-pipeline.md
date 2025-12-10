# 008 CI/CDパイプライン

## 概要

コードの品質を自動でチェックし、問題がなければ自動でデプロイする仕組み（CI/CDパイプライン）を構築するチケットです。

CI（継続的インテグレーション）とは、コードの変更が入るたびに自動でテストを実行して問題がないかチェックすること。CD（継続的デプロイ）とは、チェックが通ったコードを自動でサーバーにデプロイすることです。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 003（Cloud Functions基盤）

## 要件

### 機能要件

- なし（基盤チケットのため）

### 非機能要件

- NFR-026: コードカバレッジ - 80%以上
- NFR-027: ドキュメント - 全機能のドキュメント化

## 受け入れ条件（Todo）

- [x] GitHub Actions CI設定を作成
  - [x] PRごとにLint、テストを自動実行
  - [x] mainブランチへのマージでテストを実行
  - [x] テストカバレッジレポートを生成
- [x] GitHub Actions CD設定を作成
  - [x] mainブランチへのマージで開発環境にデプロイ
  - [x] タグ作成で本番環境にデプロイ
- [x] Firestore Security Rulesの自動デプロイを設定
- [x] 環境変数・シークレットの管理を設定
- [x] デプロイ通知（Slack or メール）を設定
- [x] ドキュメントを作成
  - [x] デプロイフローの説明
  - [x] ロールバック手順

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - 保守性要件

## 技術詳細

### GitHub Actions CI設定

```yaml
# .github/workflows/ci-functions.yml
name: Cloud Functions CI

on:
  pull_request:
    branches: [main]
    paths:
      - 'functions/**'
      - '.github/workflows/ci-functions.yml'
  push:
    branches: [main]
    paths:
      - 'functions/**'

jobs:
  lint-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: functions

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check formatting
        run: npm run format -- --check

      - name: Run TypeScript compiler
        run: npm run build

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage report
        uses: codecov/codecov-action@v3
        with:
          directory: functions/coverage
          flags: functions
          fail_ci_if_error: true

  security-check:
    name: Security Check
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: functions

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high
```

### GitHub Actions CD設定（開発環境）

```yaml
# .github/workflows/deploy-dev.yml
name: Deploy to Development

on:
  push:
    branches: [main]
    paths:
      - 'functions/**'
      - 'firebase/**'

jobs:
  deploy:
    name: Deploy to Dev
    runs-on: ubuntu-latest
    environment: development

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: functions

      - name: Build
        run: npm run build
        working-directory: functions

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}

      - name: Setup Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy Cloud Functions
        run: firebase deploy --only functions --project tokyo-list-478804-e5

      - name: Deploy Firestore Rules
        run: firebase deploy --only firestore:rules --project tokyo-list-478804-e5

      - name: Deploy Firestore Indexes
        run: firebase deploy --only firestore:indexes --project tokyo-list-478804-e5

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Cloud Functions deployed to development'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### GitHub Actions CD設定（本番環境）

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production

on:
  release:
    types: [published]

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: functions

      - name: Build
        run: npm run build
        working-directory: functions

      - name: Run tests
        run: npm test
        working-directory: functions

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROD }}

      - name: Setup Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy Cloud Functions
        run: firebase deploy --only functions --project tokyo-list-478804-e5-prod

      - name: Deploy Firestore Rules
        run: firebase deploy --only firestore:rules --project tokyo-list-478804-e5-prod

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Cloud Functions deployed to PRODUCTION - ${{ github.event.release.tag_name }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Firestore Security Rulesテスト

```yaml
# .github/workflows/test-rules.yml
name: Firestore Rules Test

on:
  pull_request:
    branches: [main]
    paths:
      - 'firebase/firestore.rules'
      - 'firebase/tests/**'

jobs:
  test-rules:
    name: Test Security Rules
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Firebase Tools
        run: npm install -g firebase-tools

      - name: Install test dependencies
        run: npm ci
        working-directory: firebase

      - name: Start emulator and run tests
        run: firebase emulators:exec --only firestore "npm test"
        working-directory: firebase
```

### 必要なシークレット設定

| シークレット名 | 説明 | 設定場所 |
|--------------|------|---------|
| `FIREBASE_SERVICE_ACCOUNT` | 開発環境のサービスアカウントキー | GitHub Secrets |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | 本番環境のサービスアカウントキー | GitHub Secrets |
| `SLACK_WEBHOOK` | Slack通知用Webhook URL | GitHub Secrets |
| `CODECOV_TOKEN` | コードカバレッジ用トークン | GitHub Secrets |

### デプロイフロー図

```
[開発者] ── PR作成 ──> [GitHub Actions CI]
                          |
                          v
                     Lint + Test
                          |
                          v
                     ✅ or ❌
                          |
                          v
[レビュー・承認] ── マージ ──> [GitHub Actions CD (dev)]
                                   |
                                   v
                              開発環境にデプロイ
                                   |
                                   v
[動作確認] ── リリース作成 ──> [GitHub Actions CD (prod)]
                                   |
                                   v
                              本番環境にデプロイ
```

### ロールバック手順

```bash
# 1. Firebase Consoleで前のバージョンを確認
# https://console.firebase.google.com/project/tokyo-list-478804-e5/functions/list

# 2. 前のコミットに戻す
git revert <commit-hash>
git push origin main

# 3. 自動でCDが走り、前のバージョンがデプロイされる

# または、手動でロールバック
firebase functions:rollback
```

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了（2025-12-10）

## 備考

- 本番環境（tokyo-list-478804-e5-prod）はPhase 2の終盤で作成予定
- 本番デプロイは手動承認を必要とする設定にする
- セキュリティ上、サービスアカウントキーは定期的にローテーションする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | CI/CDパイプライン実装完了 |
