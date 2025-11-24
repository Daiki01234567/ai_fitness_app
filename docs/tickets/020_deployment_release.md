# Ticket #020: デプロイ・リリース準備

**Phase**: Phase 4 (リリース準備)
**期間**: Week 14
**優先度**: 最高
**関連仕様書**:
- `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md`
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
本番環境へのデプロイとアプリストアへのリリース準備を完了する。

## Todo リスト

### 本番環境準備

#### Firebase プロジェクト設定
- [ ] 本番プロジェクト作成
  - [ ] プロジェクトID: ai-fitness-prod
  - [ ] リージョン: asia-northeast1
  - [ ] 課金アカウント設定
- [ ] サービス有効化
  - [ ] Authentication
  - [ ] Firestore
  - [ ] Cloud Functions
  - [ ] Cloud Storage
  - [ ] BigQuery
  - [ ] Cloud Messaging
- [ ] 環境変数設定
  ```bash
  firebase functions:config:set \
    app.environment="production" \
    app.api_key="..." \
    revenuecat.api_key="..."
  ```

#### セキュリティ設定
- [ ] Firestore セキュリティルール
  - [ ] 本番用ルールデプロイ
  - [ ] ルール監査
  - [ ] テスト実行
- [ ] Storage セキュリティルール
- [ ] API キー制限
  - [ ] Android: パッケージ名制限
  - [ ] iOS: バンドルID制限
  - [ ] Web: リファラー制限
- [ ] App Check有効化
  ```typescript
  // Cloud Functions
  export const api = functions
    .runWith({ enforceAppCheck: true })
    .https.onRequest(app);
  ```

#### インフラ設定
- [ ] Cloud Functions デプロイ
  - [ ] 本番用設定
  - [ ] メモリ/CPU割り当て
  - [ ] 最小インスタンス設定
- [ ] BigQuery設定
  - [ ] データセット作成
  - [ ] スケジュールクエリ
  - [ ] 課金アラート
- [ ] Cloud Scheduler設定
- [ ] Cloud Monitoring設定

### iOS リリース準備

#### App Store Connect設定
- [ ] アプリ情報
  - [ ] アプリ名: AI Fitness Coach
  - [ ] カテゴリ: ヘルスケア＆フィットネス
  - [ ] プライマリ言語: 日本語
  - [ ] バンドルID: com.aifitness.app
- [ ] 価格設定
  - [ ] 無料（アプリ内課金あり）
  - [ ] 地域設定
- [ ] App Store最適化（ASO）
  - [ ] キーワード選定
  - [ ] 説明文作成
  - [ ] What's New作成

#### 証明書・プロファイル
- [ ] 証明書作成
  - [ ] Distribution Certificate
  - [ ] Push Notification Certificate
- [ ] Provisioning Profile
  - [ ] App Store Distribution
- [ ] Capability設定
  - [ ] Push Notifications
  - [ ] Sign in with Apple
  - [ ] Camera Usage

#### アプリ申請素材
- [ ] スクリーンショット
  - [ ] 6.7インチ（iPhone 15 Pro Max）
  - [ ] 6.5インチ（iPhone 14 Plus）
  - [ ] 5.5インチ（iPhone 8 Plus）
  - [ ] 12.9インチ（iPad Pro）
- [ ] アプリプレビュー動画
  - [ ] 30秒以内
  - [ ] 主要機能デモ
- [ ] アイコン
  - [ ] 1024×1024px

#### ビルド・アップロード
- [ ] リリースビルド作成
  ```bash
  flutter build ios --release
  ```
- [ ] Archive作成（Xcode）
- [ ] App Store Connectアップロード
- [ ] TestFlight配布
- [ ] 内部テスト実施

### Android リリース準備

#### Google Play Console設定
- [ ] アプリ作成
  - [ ] アプリ名: AI Fitness Coach
  - [ ] デフォルト言語: 日本語
  - [ ] アプリタイプ: アプリ
- [ ] ストア掲載情報
  - [ ] 簡単な説明（80文字）
  - [ ] 詳しい説明（4000文字）
  - [ ] カテゴリ: 健康＆フィットネス
- [ ] コンテンツレーティング
  - [ ] アンケート回答
  - [ ] レーティング取得

#### 署名設定
- [ ] キーストア作成
  ```bash
  keytool -genkey -v -keystore upload-keystore.jks \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias upload
  ```
- [ ] Play App Signing設定
- [ ] key.properties設定
- [ ] ProGuard設定

#### アプリ申請素材
- [ ] スクリーンショット
  - [ ] スマートフォン（最低2枚）
  - [ ] タブレット7インチ
  - [ ] タブレット10インチ
- [ ] フィーチャーグラフィック
  - [ ] 1024×500px
- [ ] アイコン
  - [ ] 512×512px

#### ビルド・アップロード
- [ ] リリースビルド作成
  ```bash
  flutter build appbundle --release
  ```
- [ ] AABファイル生成
- [ ] Play Consoleアップロード
- [ ] 内部テストトラック
- [ ] 段階的ロールアウト設定

### プライバシー・法的要件

#### プライバシーポリシー
- [ ] プライバシーポリシー更新
- [ ] Webページ公開
- [ ] アプリ内リンク設定
- [ ] ストア掲載

#### 利用規約
- [ ] 利用規約最終確認
- [ ] 法務レビュー
- [ ] 各国法規制確認
- [ ] 薬機法対応確認

#### データ安全性
- [ ] Google Play データセーフティ
  - [ ] データ収集申告
  - [ ] データ共有申告
  - [ ] セキュリティ対策申告
- [ ] Apple App Privacy
  - [ ] プライバシーラベル作成
  - [ ] トラッキング申告

### マーケティング準備

#### ランディングページ
- [ ] Webサイト作成
  - [ ] 機能紹介
  - [ ] スクリーンショット
  - [ ] ダウンロードリンク
- [ ] SEO最適化
- [ ] OGP設定
- [ ] Analytics設定

#### プロモーション素材
- [ ] プレスリリース作成
- [ ] SNSアカウント作成
  - [ ] Twitter/X
  - [ ] Instagram
  - [ ] Facebook
- [ ] 紹介動画作成
- [ ] App Storeバッジ取得

### 監視・分析設定

#### Firebase設定
- [ ] Crashlytics有効化
- [ ] Analytics設定
  - [ ] コンバージョンイベント
  - [ ] ユーザープロパティ
  - [ ] オーディエンス設定
- [ ] Performance Monitoring
- [ ] Remote Config設定

#### 外部ツール連携
- [ ] RevenueCat設定
- [ ] Mixpanel/Amplitude（オプション）
- [ ] Sentry（オプション）
- [ ] AppsFlyerr（オプション）

### リリース戦略

#### 段階的リリース
- [ ] Phase 1: 内部テスト（社員20名）
- [ ] Phase 2: クローズドベータ（100名）
- [ ] Phase 3: オープンベータ（1000名）
- [ ] Phase 4: 段階的公開（10%→50%→100%）

#### リリースチェックリスト
- [ ] 全機能動作確認
- [ ] セキュリティ監査完了
- [ ] パフォーマンス基準達成
- [ ] バックアップ取得
- [ ] ロールバック手順確認
- [ ] サポート体制確立

#### Day 1パッチ準備
- [ ] 既知の問題リスト
- [ ] 修正優先順位
- [ ] ホットフィックス手順
- [ ] 緊急連絡網

### ドキュメント整備

#### 技術ドキュメント
- [ ] APIドキュメント
- [ ] データベーススキーマ
- [ ] インフラ構成図
- [ ] デプロイ手順書

#### 運用ドキュメント
- [ ] 運用マニュアル
- [ ] トラブルシューティング
- [ ] FAQ
- [ ] SLA定義

#### ユーザードキュメント
- [ ] 利用ガイド
- [ ] よくある質問
- [ ] トラブルシューティング
- [ ] お問い合わせ先

### 災害対策

#### バックアップ設定
- [ ] Firestoreバックアップ
  - [ ] 日次自動バックアップ
  - [ ] 保持期間30日
- [ ] Cloud Storageバックアップ
- [ ] ソースコード（GitHub）

#### 障害対応準備
- [ ] インシデント対応フロー
- [ ] エスカレーション手順
- [ ] 連絡体制
- [ ] 復旧手順書

### カスタマーサポート

#### サポート体制
- [ ] お問い合わせフォーム設置
- [ ] サポートメールアドレス
- [ ] FAQ作成
- [ ] 自動応答設定

#### フィードバック収集
- [ ] アプリ内フィードバック
- [ ] レビュー監視
- [ ] ユーザーサーベイ
- [ ] バグレポート

## 受け入れ条件
- [ ] 両ストア審査通過
- [ ] 本番環境正常稼働
- [ ] 監視アラート設定完了
- [ ] バックアップ動作確認
- [ ] ドキュメント完備

## 注意事項
- ストア審査期間の考慮（1-2週間）
- リジェクト対策
- 初回リリースは機能限定も検討
- ユーザーフィードバックの迅速な対応

## 参考リンク
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Firebase Launch Checklist](https://firebase.google.com/docs/projects/launch-checklist)