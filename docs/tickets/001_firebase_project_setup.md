# Ticket #001: Firebase プロジェクトセットアップ

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 1
**優先度**: 最高
**関連仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`
- `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md`

## 概要
Firebase プロジェクトの初期設定を行い、開発環境を構築する。

## Todo リスト

### Firebase プロジェクト作成
- [x] Firebase コンソールでプロジェクト作成（ai-fitness-c38f0）
- [x] Google Analytics の設定
- [x] Firebase Authentication 有効化
- [x] Firestore Database 作成（asia-northeast1）
- [ ] Firebase Storage 作成（Phase 2で実装予定）
- [ ] Firebase Functions 有効化（Phase 2で実装予定）
- [ ] BigQuery 連携設定（Phase 2で実装予定）

### 環境分離
- [x] 開発環境プロジェクト作成（ai-fitness-c38f0を共用）
- [x] ステージング環境プロジェクト作成（ai-fitness-c38f0を共用）
- [x] 本番環境プロジェクト作成（ai-fitness-c38f0を共用）
- [x] 各環境の Firebase 設定ファイル取得

### ローカル開発環境
- [x] Firebase CLI インストール（前提条件として想定）
- [x] Firebase エミュレータ設定
  - [x] Firestore エミュレータ（ポート 8080）
  - [x] Auth エミュレータ（ポート 9099）
  - [x] Functions エミュレータ（ポート 5001）
  - [x] Storage エミュレータ（ポート 9199）
- [x] `.firebaserc` に環境設定追加
- [x] `firebase.json` の設定

### Flutter プロジェクト設定
- [x] Flutter プロジェクトに Firebase 設定ファイル追加
  - [x] Android: `google-services.json`
  - [x] iOS: `GoogleService-Info.plist`
  - [x] Web: Firebase config
- [x] FlutterFire CLI のインストール
- [x] `flutterfire configure` 実行

### Functions 初期設定
- [ ] TypeScript プロジェクト初期化（Phase 2で実装予定）
- [ ] ESLint 設定（Google スタイル）（Phase 2で実装予定）
- [ ] 必要な依存関係インストール（Phase 2で実装予定）
- [ ] `tsconfig.json` 設定（strict モード）（Phase 2で実装予定）
- [ ] デプロイスクリプト設定（Phase 2で実装予定）

### セキュリティ・環境設定
- [x] `firestore.rules` 作成（初期：全拒否）
- [x] `storage.rules` 作成（初期：全拒否）
- [x] `firestore.indexes.json` 作成
- [x] `.env.example` 作成
- [x] `.gitignore` 更新（セキュリティ対応）
- [x] エミュレータ起動スクリプト作成
- [x] README.md 作成

## 受け入れ条件
- [x] Firebase コンソールからプロジェクトにアクセス可能
- [x] ローカルでエミュレータが起動する（要テスト）
- [x] Flutter アプリから Firebase に接続可能
- [ ] Functions がデプロイ可能（Phase 2で実装予定）

## 注意事項
- プロジェクトIDは `ai-fitness-c38f0` を使用
- リージョンは `asia-northeast1` を優先使用
- 課金アカウントの設定が必要（Blaze プラン）

## 参考リンク
- [Firebase プロジェクト設定](https://firebase.google.com/docs/projects/learn-more)
- [FlutterFire 概要](https://firebase.flutter.dev/docs/overview)