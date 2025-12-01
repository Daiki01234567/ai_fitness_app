# Ticket #005: CI/CDパイプライン構築

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 2
**優先度**: 高
**ステータス**: ほぼ完了（95%）- オプション機能のみ残り
**最終更新**: 2025-12-01
**関連仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`
- `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md`

## 概要
GitHub ActionsとFirebase CLIを使用した自動デプロイパイプラインを構築する。

## Todo リスト

### GitHub リポジトリ設定
- [x] ブランチ保護ルール設定 → `docs/CI_CD_SETUP.md` に手順を記載
  - [x] main ブランチ保護
  - [x] PR必須
  - [x] レビュー必須（1人以上）
  - [x] CI成功必須
- [x] シークレット設定 → `docs/CI_CD_SETUP.md` に手順を記載
  - [x] FIREBASE_TOKEN
  - [x] GOOGLE_APPLICATION_CREDENTIALS
  - [x] 環境変数

### GitHub Actions ワークフロー

#### PR用ワークフロー (`.github/workflows/pr.yml`)
- [x] Flutter アプリ
  - [x] 依存関係インストール
  - [x] `flutter analyze` 実行
  - [x] `flutter test` 実行
  - [x] ビルドテスト
- [x] Cloud Functions
  - [x] 依存関係インストール
  - [x] `npm run lint` 実行
  - [x] `npm run build` 実行
  - [x] `npm test` 実行
- [x] Firestore Rules
  - [x] ルールのバリデーション
  - [ ] セキュリティテスト実行（Phase 2で実装予定）

#### デプロイワークフロー (`.github/workflows/deploy.yml`)
- [x] 環境別デプロイ設定
  - [x] development (feature ブランチ)
  - [x] staging (develop ブランチ)
  - [x] production (main ブランチ)
- [x] Cloud Functions デプロイ
  - [x] 環境変数設定
  - [x] `firebase deploy --only functions`
- [x] Firestore Rules デプロイ
  - [x] `firebase deploy --only firestore:rules`
- [x] Storage Rules デプロイ
  - [x] `firebase deploy --only storage:rules`

#### Flutter アプリビルド (`.github/workflows/app-build.yml`)
- [x] Android ビルド
  - [x] APK生成
  - [x] AAB生成
  - [x] 署名設定
- [x] iOS ビルド
  - [x] IPA生成
  - [x] 証明書設定
  - [x] Provisioning Profile設定
- [x] アーティファクト保存

### 環境管理
- [x] Firebase プロジェクトエイリアス設定 → `.firebaserc` で設定済み
- [x] 環境変数管理
  - [x] `env.example` テンプレート作成
  - [ ] `.env.development` （ローカル設定）
  - [ ] `.env.staging` （ローカル設定）
  - [ ] `.env.production` （ローカル設定）

### テスト自動化
- [x] 単体テスト実行
- [ ] 統合テスト実行（Phase 2で実装予定）
- [ ] E2Eテスト実行（エミュレータ使用）（Phase 2で実装予定）
- [x] カバレッジレポート生成
- [ ] SonarCloud 統合（オプション）

### 通知設定
- [x] Slack 通知
  - [x] ビルド成功/失敗
  - [x] デプロイ成功/失敗
- [ ] メール通知設定（オプション）

### ロールバック戦略
- [x] Cloud Functions のバージョン管理 → `docs/CI_CD_SETUP.md` に手順を記載
- [x] Firestore Rules のバックアップ → `docs/CI_CD_SETUP.md` に手順を記載
- [ ] ロールバックスクリプト作成（Phase 2で実装予定）
- [x] 手動ロールバック手順書 → `docs/CI_CD_SETUP.md` に記載

### 監視統合
- [x] デプロイ後の自動ヘルスチェック
- [ ] エラー率監視（Firebase Crashlytics統合後）
- [ ] パフォーマンス監視（Firebase Performance統合後）
- [ ] アラート設定（Phase 2で実装予定）

### ドキュメント
- [x] CI/CD フロー図作成 → `docs/CI_CD_SETUP.md`
- [x] デプロイ手順書 → `docs/CI_CD_SETUP.md`
- [x] トラブルシューティングガイド → `docs/CI_CD_SETUP.md`
- [x] 環境変数一覧 → `env.example`

## 受け入れ条件
- [x] PRを作成すると自動でテストが実行される
- [x] main ブランチへのマージで本番デプロイが実行される
- [x] 全環境へのデプロイが成功する
- [x] ロールバックが可能（手順書で対応）
- [x] 通知が適切に送信される（Slack連携）

## 注意事項
- Firebase トークンの安全な管理
- 本番環境へのデプロイは承認プロセスを検討
- コスト最適化（ビルド時間の短縮）
- 並列実行による高速化

## 作成ファイル一覧
| ファイル | 説明 |
|---------|------|
| `.github/workflows/pr.yml` | PR用CIワークフロー |
| `.github/workflows/deploy.yml` | Firebase デプロイワークフロー |
| `.github/workflows/app-build.yml` | Flutter アプリビルドワークフロー |
| `env.example` | 環境変数テンプレート |
| `docs/CI_CD_SETUP.md` | CI/CDセットアップガイド |

## 参考リンク
- [GitHub Actions](https://docs.github.com/actions)
- [Firebase GitHub Action](https://github.com/firebase/firebase-tools)
- [Flutter GitHub Actions](https://github.com/subosito/flutter-action)
