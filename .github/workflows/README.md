# GitHub Actions ワークフロー設定ガイド

## デプロイワークフロー (deploy.yml)

Firebase へのデプロイを自動化する GitHub Actions ワークフローです。

### 必要な設定

#### 1. リポジトリ変数 (Repository Variables)

GitHub リポジトリの Settings > Secrets and variables > Actions > Variables で以下を設定:

| 変数名 | 値 | 説明 |
|-------|---|------|
| `DEPLOY_ENABLED` | `true` または `false` | デプロイ機能の有効/無効を制御 |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | (オプション) Slack 通知用 |

**重要**: `DEPLOY_ENABLED` を `false` に設定すると、すべてのデプロイジョブがスキップされます。
これにより、認証情報が未設定の場合でもワークフローがエラーにならずに完了します。

#### 2. リポジトリシークレット (Repository Secrets)

GitHub リポジトリの Settings > Secrets and variables > Actions > Secrets で以下を設定:

| シークレット名 | 内容 | 取得方法 |
|---------------|------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキー (JSON) | Firebase Console > プロジェクト設定 > サービスアカウント |

**サービスアカウントキーの取得手順**:

1. Firebase Console を開く
2. プロジェクト設定 > サービスアカウント
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードした JSON ファイルの内容をコピー
5. GitHub のシークレットに貼り付け

#### 3. GitHub Permissions

ワークフローには以下の権限が設定されています:

- `contents: read` - リポジトリの読み取り
- `deployments: write` - デプロイステータスの作成

これらの権限は `notify` ジョブで使用されます。

### ワークフローの動作

#### トリガー条件

1. **main ブランチへのプッシュ**: 本番環境 (production) にデプロイ
2. **develop ブランチへのプッシュ**: ステージング環境 (staging) にデプロイ
3. **手動実行 (workflow_dispatch)**: 環境を選択してデプロイ

#### デプロイジョブ

`DEPLOY_ENABLED=true` の場合、以下のジョブが実行されます:

1. **deploy-functions**: Cloud Functions をデプロイ
2. **deploy-firestore-rules**: Firestore セキュリティルールをデプロイ
3. **deploy-storage-rules**: Cloud Storage セキュリティルールをデプロイ
4. **deploy-firestore-indexes**: Firestore インデックスをデプロイ
5. **health-check**: デプロイ後のヘルスチェック
6. **notify**: デプロイ結果の通知

### デプロイを有効にする手順

1. Firebase プロジェクトでサービスアカウントキーを生成
2. GitHub リポジトリにシークレット `GOOGLE_APPLICATION_CREDENTIALS` を追加
3. GitHub リポジトリに変数 `DEPLOY_ENABLED` を `true` に設定
4. (オプション) Slack 通知を設定する場合は `SLACK_WEBHOOK_URL` を追加

### トラブルシューティング

#### 認証エラー: "must specify exactly one of workload_identity_provider or credentials_json"

**原因**: `GOOGLE_APPLICATION_CREDENTIALS` シークレットが設定されていないか、空です。

**解決方法**:
1. `DEPLOY_ENABLED` 変数を `false` に設定 (デプロイを無効化)
2. または、`GOOGLE_APPLICATION_CREDENTIALS` シークレットを正しく設定

#### 通知エラー: "Resource not accessible by integration"

**原因**: GitHub deployment API へのアクセス権限が不足しています。

**解決方法**:
このエラーは自動的に処理されます (`continue-on-error: true`)。
デプロイ自体は成功しますが、GitHub の Deployments タブにステータスが表示されません。

#### デプロイジョブがスキップされる

**原因**: `DEPLOY_ENABLED` 変数が `false` または未設定です。

**解決方法**:
リポジトリ変数 `DEPLOY_ENABLED` を `true` に設定してください。

### セキュリティのベストプラクティス

1. **サービスアカウントキーの管理**
   - キーは GitHub Secrets に保存 (平文で保存しない)
   - 定期的にキーをローテーション
   - 最小権限の原則に従う

2. **環境分離**
   - 本番環境とステージング環境で異なる Firebase プロジェクトを使用
   - 本番環境へのデプロイは main ブランチのみに制限

3. **ブランチ保護**
   - main ブランチに保護ルールを設定
   - プルリクエストのレビューを必須化
   - ステータスチェックの成功を必須化

### 参考リンク

- [Firebase CI/CD](https://firebase.google.com/docs/cli#cli-ci-systems)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
