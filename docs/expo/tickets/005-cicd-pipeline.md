# 005 CI/CDパイプライン構築

## 概要

GitHub Actionsを使用したCI/CDパイプラインを構築します。コードの品質管理、自動テスト、Expoビルドの自動化を実現します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [001 Firebaseプロジェクトセットアップ](./001-firebase-project-setup.md)
- [002 Expo開発環境構築](./002-dev-environment-setup.md)

## 要件

### CI（継続的インテグレーション）

| チェック項目 | ツール | 目的 |
|-------------|-------|------|
| コード品質 | ESLint | コードスタイルの統一 |
| フォーマット | Prettier | 自動整形 |
| 型チェック | TypeScript | 型安全性の確保 |
| 単体テスト | Jest | ロジックのテスト |
| ビルド確認 | Expo | ビルドエラーの早期発見 |

### CD（継続的デリバリー）

| 環境 | トリガー | デプロイ先 |
|------|---------|-----------|
| 開発環境 | `develop`ブランチへのマージ | EAS Update（開発チャネル） |
| ステージング | `staging`ブランチへのマージ | EAS Update（ステージングチャネル） |
| 本番環境 | `main`ブランチへのマージ | EAS Update（本番チャネル） |

### ブランチ戦略

```
main          本番環境（リリース用）
  └── staging     ステージング（QA用）
        └── develop    開発環境（開発用）
              └── feature/*  機能開発
              └── fix/*       バグ修正
```

## 受け入れ条件

- [ ] GitHub Actionsワークフローファイルが作成されている
- [ ] PRごとにESLint/Prettier/TypeScriptチェックが実行される
- [ ] PRごとにJestテストが実行される
- [ ] developブランチへのマージでEAS Updateが実行される
- [ ] mainブランチへのマージで本番チャネルにUpdateが配信される
- [ ] シークレット（Firebase認証情報等）が安全に管理されている
- [ ] ビルド失敗時に通知が送信される

## 参照ドキュメント

- [要件定義書 Part 2（非機能要件）](../specs/02_要件定義書_Expo版_v1_Part2.md) - NFR-026
- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)

## 技術詳細

### GitHub Actions ワークフロー

#### .github/workflows/ci.yml

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop, staging]
  push:
    branches: [main, develop, staging]

jobs:
  lint-and-test:
    name: Lint and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier check
        run: npm run format:check

      - name: Run TypeScript check
        run: npm run type-check

      - name: Run Tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build-check:
    name: Build Check
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Check Expo config
        run: npx expo config --type introspect
```

#### .github/workflows/deploy.yml

```yaml
name: Deploy

on:
  push:
    branches:
      - main
      - staging
      - develop

jobs:
  update:
    name: EAS Update
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Determine channel
        id: channel
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "channel=production" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "channel=staging" >> $GITHUB_OUTPUT
          else
            echo "channel=development" >> $GITHUB_OUTPUT
          fi

      - name: Publish update
        run: eas update --branch ${{ steps.channel.outputs.channel }} --message "${{ github.event.head_commit.message }}"
```

### package.json scripts

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### EAS設定（eas.json）

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### 必要なシークレット

| シークレット名 | 用途 |
|---------------|------|
| `EXPO_TOKEN` | EAS CLIの認証 |
| `CODECOV_TOKEN` | カバレッジレポート |
| `FIREBASE_SERVICE_ACCOUNT` | Firebaseデプロイ（Cloud Functions用） |

### シークレット設定方法

1. GitHub リポジトリの Settings > Secrets and variables > Actions
2. 「New repository secret」をクリック
3. 各シークレットを追加

## 注意事項

- シークレットはGitHub Secretsで管理し、コードにハードコードしないこと
- EXPO_TOKENはExpo Dashboardから取得（expo.dev > Account Settings > Access Tokens）
- 本番デプロイは必ずmainブランチ経由で行うこと
- ビルド時間を短縮するため、キャッシュを適切に設定すること

## 見積もり

- 想定工数: 4-6時間
- 難易度: 中

## 進捗

- [ ] 未着手
