# Ticket #001: Firebase プロジェクトセットアップ

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 1
**優先度**: 最高
**ステータス**: ほぼ完了（98%）
**最終更新**: 2025-12-05
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
- [x] Firebase Functions 有効化
- [x] BigQuery 連携設定

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
  - [ ] iOS: `GoogleService-Info.plist`（ユーザー操作必要: Firebase コンソールからダウンロードして配置）
  - [x] Web: Firebase config
- [x] FlutterFire CLI のインストール
- [x] `flutterfire configure` 実行

### Functions 初期設定
- [x] TypeScript プロジェクト初期化
- [x] ESLint 設定（Google スタイル）
- [x] 必要な依存関係インストール
- [x] `tsconfig.json` 設定（strict モード）
- [x] デプロイスクリプト設定

### セキュリティ・環境設定
- [x] `firestore.rules` 作成（本番用ルール363行実装済み）
- [x] `storage.rules` 作成（初期：全拒否）
- [x] `firestore.indexes.json` 作成（9インデックス定義済み）
- [x] `.env.example` 作成
- [x] `.gitignore` 更新（セキュリティ対応）
- [x] エミュレータ起動スクリプト作成
- [x] README.md 作成

## 実装済み詳細

### Cloud Functions
- **実装ファイル数**: 70ファイル
- **構成**:
  - `src/auth/`: 認証トリガー（onCreate, onDelete, customClaims）
  - `src/api/`: HTTPコーラブル関数（users/）
  - `src/middleware/`: 認証、バリデーション、レート制限
  - `src/services/`: BigQuery、CloudTasksサービス
  - `src/types/`: TypeScript型定義
  - `src/utils/`: ロガー、バリデーション、エラー処理

### テスト基盤
- **テストファイル数**: 70件
- **カテゴリ**: unit, integration, compliance
- **フレームワーク**: Jest

### BigQuery連携
- **スキーマ定義**: 5テーブル
  - sessions, daily_aggregates, user_exercise_stats, conversion_funnel, error_logs
- **スクリプト**: setup_bigquery.sh, verify_dataset.sh
- **サービス**: BigQueryService.ts（ストリーミングインサート対応）

### Firestoreセキュリティルール
- **本番用ルール**: 363行
- **機能**: フィールドレベルアクセス制御、削除予定ユーザー保護、カスタムクレーム対応

## 受け入れ条件
- [x] Firebase コンソールからプロジェクトにアクセス可能
- [x] ローカルでエミュレータが起動する
- [x] Flutter アプリから Firebase に接続可能
- [x] Functions がローカル動作確認済み（本番デプロイテスト待ち）

## 残タスク
1. **iOS用 `GoogleService-Info.plist` の配置**
   - Firebase コンソールからダウンロードして `flutter_app/ios/Runner/` に配置が必要
   - ユーザー操作が必要（自動生成不可）

2. **Functions本番デプロイ確認**
   - `firebase deploy --only functions` で本番環境へのデプロイテストを実施

## ユーザー操作が必要な項目

### iOS設定ファイルの配置
| 項目 | 内容 |
|------|------|
| **操作** | `GoogleService-Info.plist` をダウンロードして配置 |
| **所要時間** | 約5分 |
| **手順** | 1. [Firebase Console](https://console.firebase.google.com/project/tokyo-list-478804-e5/settings/general/ios) にアクセス<br>2. iOSアプリを選択<br>3. `GoogleService-Info.plist` をダウンロード<br>4. `flutter_app/ios/Runner/` に配置 |

### Functions本番デプロイテスト
| 項目 | 内容 |
|------|------|
| **操作** | Cloud Functionsを本番環境にデプロイ |
| **所要時間** | 約10分 |
| **コマンド** | `firebase deploy --only functions` |
| **前提条件** | Blazeプラン（従量課金）への切り替えが必要 |

## 注意事項
- プロジェクトIDは `ai-fitness-c38f0` を使用
- リージョンは `asia-northeast1` を優先使用
- 課金アカウントの設定が必要（Blaze プラン）

## 参考リンク
- [Firebase プロジェクト設定](https://firebase.google.com/docs/projects/learn-more)
- [FlutterFire 概要](https://firebase.flutter.dev/docs/overview)
