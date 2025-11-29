# CI/CD パイプライン セットアップガイド

## 概要

このドキュメントでは、AI Fitness App の CI/CD パイプラインの設定方法について説明します。

## GitHub Actions ワークフロー

### 1. PR用ワークフロー (`.github/workflows/pr.yml`)

PRが作成・更新されたときに自動実行されます。

**実行内容:**
- Flutter アプリ
  - 依存関係インストール
  - コードフォーマットチェック
  - 静的解析 (`flutter analyze`)
  - 単体テスト (`flutter test`)
  - デバッグビルド
- Cloud Functions
  - 依存関係インストール
  - ESLint
  - TypeScriptビルド
  - Jestテスト
- Firestore/Storage Rules
  - ルールバリデーション

### 2. デプロイワークフロー (`.github/workflows/deploy.yml`)

mainまたはdevelopブランチへのプッシュ時に自動実行されます。

**環境マッピング:**
| ブランチ | 環境 | Firebase Project |
|---------|------|------------------|
| main | production | tokyo-list-478804-e5 |
| develop | staging | tokyo-list-478804-e5 |
| feature/* | development | tokyo-list-478804-e5 |

**デプロイ対象:**
- Cloud Functions
- Firestore Rules
- Storage Rules
- Firestore Indexes

### 3. アプリビルドワークフロー (`.github/workflows/app-build.yml`)

リリースタグ（`v*.*.*`）が作成されたときに実行されます。

**ビルド対象:**
- Android APK/AAB
- iOS App/IPA

---

## GitHub リポジトリ設定

### 必要なシークレット

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定してください：

#### Firebase/GCP認証
| シークレット名 | 説明 |
|--------------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | GCPサービスアカウントのJSONキー（Base64エンコード不要） |

#### Android署名
| シークレット名 | 説明 |
|--------------|------|
| `ANDROID_KEYSTORE_BASE64` | キーストアファイルのBase64エンコード |
| `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
| `ANDROID_KEY_PASSWORD` | キーのパスワード |
| `ANDROID_KEY_ALIAS` | キーのエイリアス |

#### iOS署名
| シークレット名 | 説明 |
|--------------|------|
| `IOS_P12_BASE64` | 証明書(.p12)のBase64エンコード |
| `IOS_P12_PASSWORD` | 証明書のパスワード |
| `IOS_PROVISIONING_PROFILE_BASE64` | Provisioning ProfileのBase64エンコード |
| `KEYCHAIN_PASSWORD` | 一時キーチェーン用パスワード |

### ブランチ保護ルール

Settings > Branches で以下の保護ルールを設定してください：

#### main ブランチ
```
Branch name pattern: main

Protect matching branches:
☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Required status checks:
    - Flutter Tests & Build
    - Cloud Functions Tests & Build
    - Firestore Rules Validation
☑ Require conversation resolution before merging
☑ Do not allow bypassing the above settings
```

#### develop ブランチ
```
Branch name pattern: develop

Protect matching branches:
☑ Require a pull request before merging
☑ Require status checks to pass before merging
  Required status checks:
    - Flutter Tests & Build
    - Cloud Functions Tests & Build
```

### 環境設定

Settings > Environments で以下の環境を作成してください：

#### production
- **Protection rules:**
  - Required reviewers: 1名以上
  - Wait timer: 5分（オプション）
- **Environment secrets:**
  - 本番環境固有のシークレット

#### staging
- **Protection rules:**
  - 特になし（自動デプロイ）
- **Environment secrets:**
  - ステージング環境固有のシークレット

---

## サービスアカウント設定

### 1. GCPサービスアカウント作成

```bash
# プロジェクトを設定
gcloud config set project tokyo-list-478804-e5

# サービスアカウント作成
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy"

# 必要な権限を付与
gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
    --member="serviceAccount:github-actions@tokyo-list-478804-e5.iam.gserviceaccount.com" \
    --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
    --member="serviceAccount:github-actions@tokyo-list-478804-e5.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding tokyo-list-478804-e5 \
    --member="serviceAccount:github-actions@tokyo-list-478804-e5.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# キーを作成
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@tokyo-list-478804-e5.iam.gserviceaccount.com
```

### 2. GitHubシークレットに登録

```bash
# キーファイルの内容をコピーしてGitHubシークレットに登録
cat github-actions-key.json
```

---

## Android署名設定

### 1. キーストア作成

```bash
keytool -genkey -v -keystore upload-keystore.jks \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias upload
```

### 2. Base64エンコード

```bash
# macOS/Linux
base64 -i upload-keystore.jks -o keystore-base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Out-File keystore-base64.txt
```

### 3. key.properties設定

`flutter_app/android/key.properties`:
```properties
storePassword=your-store-password
keyPassword=your-key-password
keyAlias=upload
storeFile=upload-keystore.jks
```

---

## iOS署名設定

### 1. 証明書エクスポート

1. Keychain Access を開く
2. 開発/配布証明書を選択
3. 右クリック > Export > .p12形式で保存

### 2. Provisioning Profile ダウンロード

1. Apple Developer Portal にログイン
2. Certificates, Identifiers & Profiles
3. Profiles > 該当プロファイルをダウンロード

### 3. ExportOptions.plist 作成

`flutter_app/ios/ExportOptions.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.yourcompany.aifitness</key>
        <string>YOUR_PROVISIONING_PROFILE_NAME</string>
    </dict>
</dict>
</plist>
```

---

## Slack通知設定（オプション）

### 1. Slack App作成

1. https://api.slack.com/apps にアクセス
2. Create New App > From scratch
3. App名とワークスペースを選択
4. Features > Incoming Webhooks を有効化
5. Add New Webhook to Workspace
6. 通知先チャンネルを選択
7. Webhook URLをコピー

### 2. GitHub Variables に登録

Settings > Secrets and variables > Actions > Variables:
- `SLACK_WEBHOOK_URL`: Webhook URL

---

## ロールバック手順

### Cloud Functions

```bash
# 利用可能なバージョン一覧
gcloud functions describe FUNCTION_NAME --region asia-northeast1

# 特定バージョンにロールバック（手動再デプロイ）
git checkout <previous-commit>
firebase deploy --only functions
```

### Firestore Rules

```bash
# ルール履歴確認
firebase firestore:rules:list --project tokyo-list-478804-e5

# 以前のルールを適用
firebase firestore:rules:release <ruleset-name> --project tokyo-list-478804-e5
```

### アプリ

1. Google Play Console / App Store Connect にログイン
2. 以前のバージョンへの段階的ロールアウトを停止
3. 以前のバージョンを再公開

---

## トラブルシューティング

### ビルド失敗

1. **Flutter依存関係エラー**
   ```bash
   flutter clean
   flutter pub get
   ```

2. **iOS CocoaPodsエラー**
   ```bash
   cd ios
   pod deintegrate
   pod install --repo-update
   ```

3. **Androidビルドエラー**
   ```bash
   cd android
   ./gradlew clean
   ```

### デプロイ失敗

1. **認証エラー**
   - サービスアカウントの権限を確認
   - シークレットが正しく設定されているか確認

2. **Quota超過**
   - Firebase Blazeプランへのアップグレードを検討
   - Cloud Functions のインスタンス数を調整

### 署名エラー

1. **キーストアが見つからない**
   - `key.properties`のパスを確認
   - Base64デコードが正しいか確認

2. **Provisioning Profile不一致**
   - Bundle IDが一致しているか確認
   - 証明書の有効期限を確認

---

## 環境変数一覧

`env.example`を参照してください。

---

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Flutter Build Documentation](https://docs.flutter.dev/deployment)
- [Google Cloud IAM](https://cloud.google.com/iam/docs)
