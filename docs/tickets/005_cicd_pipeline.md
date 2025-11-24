# Ticket #005: CI/CDパイプライン構築

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 2
**優先度**: 高
**関連仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`
- `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md`

## 概要
GitHub ActionsとFirebase CLIを使用した自動デプロイパイプラインを構築する。

## Todo リスト

### GitHub リポジトリ設定
- [ ] ブランチ保護ルール設定
  - [ ] main ブランチ保護
  - [ ] PR必須
  - [ ] レビュー必須（1人以上）
  - [ ] CI成功必須
- [ ] シークレット設定
  - [ ] FIREBASE_TOKEN
  - [ ] GOOGLE_APPLICATION_CREDENTIALS
  - [ ] 環境変数

### GitHub Actions ワークフロー

#### PR用ワークフロー (`.github/workflows/pr.yml`)
- [ ] Flutter アプリ
  - [ ] 依存関係インストール
  - [ ] `flutter analyze` 実行
  - [ ] `flutter test` 実行
  - [ ] ビルドテスト
- [ ] Cloud Functions
  - [ ] 依存関係インストール
  - [ ] `npm run lint` 実行
  - [ ] `npm run build` 実行
  - [ ] `npm test` 実行
- [ ] Firestore Rules
  - [ ] ルールのバリデーション
  - [ ] セキュリティテスト実行

#### デプロイワークフロー (`.github/workflows/deploy.yml`)
- [ ] 環境別デプロイ設定
  - [ ] development (feature ブランチ)
  - [ ] staging (develop ブランチ)
  - [ ] production (main ブランチ)
- [ ] Cloud Functions デプロイ
  - [ ] 環境変数設定
  - [ ] `firebase deploy --only functions`
- [ ] Firestore Rules デプロイ
  - [ ] `firebase deploy --only firestore:rules`
- [ ] Storage Rules デプロイ
  - [ ] `firebase deploy --only storage:rules`

#### Flutter アプリビルド (`.github/workflows/app-build.yml`)
- [ ] Android ビルド
  - [ ] APK生成
  - [ ] AAB生成
  - [ ] 署名設定
- [ ] iOS ビルド
  - [ ] IPA生成
  - [ ] 証明書設定
  - [ ] Provisioning Profile設定
- [ ] アーティファクト保存

### 環境管理
- [ ] Firebase プロジェクトエイリアス設定
  ```json
  {
    "projects": {
      "dev": "ai-fitness-dev",
      "staging": "ai-fitness-staging",
      "production": "ai-fitness-c38f0"
    }
  }
  ```
- [ ] 環境変数管理
  - [ ] `.env.development`
  - [ ] `.env.staging`
  - [ ] `.env.production`

### テスト自動化
- [ ] 単体テスト実行
- [ ] 統合テスト実行
- [ ] E2Eテスト実行（エミュレータ使用）
- [ ] カバレッジレポート生成
- [ ] SonarCloud 統合（オプション）

### 通知設定
- [ ] Slack 通知
  - [ ] ビルド成功/失敗
  - [ ] デプロイ成功/失敗
- [ ] メール通知設定

### ロールバック戦略
- [ ] Cloud Functions のバージョン管理
- [ ] Firestore Rules のバックアップ
- [ ] ロールバックスクリプト作成
- [ ] 手動ロールバック手順書

### 監視統合
- [ ] デプロイ後の自動ヘルスチェック
- [ ] エラー率監視
- [ ] パフォーマンス監視
- [ ] アラート設定

### ドキュメント
- [ ] CI/CD フロー図作成
- [ ] デプロイ手順書
- [ ] トラブルシューティングガイド
- [ ] 環境変数一覧

## 受け入れ条件
- [ ] PRを作成すると自動でテストが実行される
- [ ] main ブランチへのマージで本番デプロイが実行される
- [ ] 全環境へのデプロイが成功する
- [ ] ロールバックが可能
- [ ] 通知が適切に送信される

## 注意事項
- Firebase トークンの安全な管理
- 本番環境へのデプロイは承認プロセスを検討
- コスト最適化（ビルド時間の短縮）
- 並列実行による高速化

## 参考リンク
- [GitHub Actions](https://docs.github.com/actions)
- [Firebase GitHub Action](https://github.com/firebase/firebase-tools)
- [Flutter GitHub Actions](https://github.com/subosito/flutter-action)