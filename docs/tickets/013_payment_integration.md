# Ticket #013: 課金機能実装（RevenueCat）

**Phase**: Phase 2 (機能実装)
**期間**: Week 8-9
**優先度**: 高
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-031～FR-033)
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
RevenueCatを使用したアプリ内課金機能を実装し、プレミアムプランのサブスクリプション管理を行う。

## Todo リスト

### RevenueCat セットアップ

#### プロジェクト設定
- [ ] RevenueCatアカウント作成
- [ ] プロジェクト作成
- [ ] APIキー取得
  - [ ] iOS用
  - [ ] Android用
- [ ] Webhookエンドポイント設定

#### アプリストア連携
- [ ] App Store Connect設定
  - [ ] アプリ内購入商品作成
  - [ ] サブスクリプショングループ設定
  - [ ] 価格設定（月額/年額）
  - [ ] 無料トライアル設定
- [ ] Google Play Console設定
  - [ ] 商品作成
  - [ ] 価格テンプレート
  - [ ] プロモーション設定
  - [ ] テストアカウント設定

#### 商品設計
- [ ] プラン構成
  ```
  - Free: 基本機能
  - Premium月額: ¥980/月
  - Premium年額: ¥9,800/年（2ヶ月分お得）
  - Family: ¥1,480/月（最大5人）
  ```
- [ ] 機能制限設計
  - [ ] Free: 週3セッションまで
  - [ ] Premium: 無制限+詳細分析
  - [ ] Family: Premium+家族共有

### Flutter 実装

#### RevenueCat SDK統合
- [ ] パッケージ追加 (`purchases_flutter`)
- [ ] 初期化処理
  ```dart
  await Purchases.setup(apiKey);
  ```
- [ ] ユーザー識別設定
- [ ] デバッグログ設定

#### PurchaseManager (`services/purchase_manager.dart`)
- [ ] 初期化処理
  - [ ] SDK設定
  - [ ] ユーザーID設定
  - [ ] リスナー登録
- [ ] 商品情報取得
  - [ ] 利用可能商品リスト
  - [ ] 価格情報
  - [ ] 通貨変換
- [ ] 購入処理
  - [ ] 購入フロー実行
  - [ ] レシート検証
  - [ ] エラーハンドリング
- [ ] 復元処理
  - [ ] 購入履歴復元
  - [ ] クロスプラットフォーム対応

#### SubscriptionProvider (Riverpod)
- [ ] サブスクリプション状態管理
  - [ ] アクティブ/非アクティブ
  - [ ] 有効期限
  - [ ] 自動更新状態
- [ ] エンタイトルメント管理
  - [ ] 利用可能機能
  - [ ] 機能制限チェック
- [ ] リアルタイム更新
  - [ ] 購入完了通知
  - [ ] 有効期限更新

### 課金画面実装

#### PremiumScreen (`screens/premium/premium_screen.dart`)
- [ ] プレミアム機能紹介
  - [ ] 特典リスト
  - [ ] 比較表
  - [ ] スクリーンショット
  - [ ] 動画デモ（オプション）
- [ ] 価格表示
  - [ ] 月額/年額切り替え
  - [ ] 節約額表示
  - [ ] 地域別価格
  - [ ] 無料トライアル期間
- [ ] FAQ セクション
  - [ ] よくある質問
  - [ ] 解約方法
  - [ ] 返金ポリシー

#### PurchaseDialog (`widgets/purchase_dialog.dart`)
- [ ] 購入確認UI
  - [ ] 商品詳細
  - [ ] 価格確認
  - [ ] 利用規約リンク
  - [ ] プライバシーポリシーリンク
- [ ] 購入ボタン
  - [ ] ローディング状態
  - [ ] 無効化制御
- [ ] エラー表示
  - [ ] ネットワークエラー
  - [ ] 支払い失敗
  - [ ] 既に購入済み

#### SubscriptionManagement (`screens/settings/subscription_screen.dart`)
- [ ] 現在のプラン表示
  - [ ] プラン名
  - [ ] 次回請求日
  - [ ] 請求額
- [ ] プラン変更
  - [ ] アップグレード
  - [ ] ダウングレード
  - [ ] 日割り計算表示
- [ ] 解約処理
  - [ ] 解約確認
  - [ ] 解約理由アンケート
  - [ ] 解約日表示
- [ ] 購入履歴
  - [ ] 過去の取引
  - [ ] 領収書表示

### ペイウォール実装

#### PaywallManager (`services/paywall_manager.dart`)
- [ ] 機能制限チェック
  ```dart
  bool canAccessFeature(Feature feature) {
    if (isPremium) return true;
    return feature.availableInFree;
  }
  ```
- [ ] ペイウォール表示
  - [ ] モーダル表示
  - [ ] 機能説明
  - [ ] アップグレード誘導
- [ ] 使用量トラッキング
  - [ ] セッション回数
  - [ ] 機能使用回数
  - [ ] 制限到達通知

### Cloud Functions 実装

#### Webhook処理 (`api/purchases/webhook.ts`)
- [ ] RevenueCat Webhook受信
  - [ ] 署名検証
  - [ ] イベントタイプ判定
  - [ ] ペイロード解析
- [ ] イベント処理
  - [ ] 初回購入
  - [ ] 更新
  - [ ] 解約
  - [ ] 有効期限切れ
  - [ ] 返金
- [ ] Firestore更新
  - [ ] Users コレクション
  - [ ] Subscriptions コレクション
  - [ ] 履歴記録

#### サブスクリプション管理API
- [ ] ステータス確認 (`api/subscriptions/status.ts`)
- [ ] プラン変更 (`api/subscriptions/change.ts`)
- [ ] 使用量取得 (`api/subscriptions/usage.ts`)
- [ ] 請求履歴 (`api/subscriptions/billing.ts`)

### データモデル

#### Subscriptions コレクション
```typescript
interface Subscription {
  userId: string;
  productId: string;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: Timestamp;
  autoRenewEnabled: boolean;
  platform: 'ios' | 'android';
  originalTransactionId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### PurchaseHistory コレクション
```typescript
interface PurchaseHistory {
  userId: string;
  transactionId: string;
  productId: string;
  price: number;
  currency: string;
  purchaseDate: Timestamp;
  platform: 'ios' | 'android';
  status: 'completed' | 'refunded' | 'pending';
}
```

### テスト実装

#### 単体テスト
- [ ] 購入フロー
- [ ] 機能制限ロジック
- [ ] 価格計算

#### 統合テスト
- [ ] RevenueCat連携
- [ ] Webhook処理
- [ ] データ同期

#### サンドボックステスト
- [ ] iOS TestFlight
- [ ] Google Play Internal Testing
- [ ] 購入フロー全体
- [ ] 更新処理
- [ ] 解約処理

### 分析・監視

#### RevenueCatダッシュボード設定
- [ ] メトリクス監視
  - [ ] MRR（月間定期収益）
  - [ ] チャーンレート
  - [ ] LTV（顧客生涯価値）
- [ ] コホート分析
- [ ] A/Bテスト設定

#### カスタムイベント
- [ ] ペイウォール表示
- [ ] 購入開始
- [ ] 購入完了
- [ ] 解約

### コンプライアンス

#### 法的要件
- [ ] 特定商取引法表記
- [ ] 返金ポリシー明記
- [ ] 自動更新の明確な説明
- [ ] 解約方法の明示

#### プラットフォーム要件
- [ ] App Store審査対策
  - [ ] 購入復元機能必須
  - [ ] 外部リンク制限
- [ ] Google Play要件
  - [ ] 明確な価格表示
  - [ ] 誤解を招く表現禁止

## 受け入れ条件
- [ ] 購入フローが完了する
- [ ] サブスクリプションが正しく管理される
- [ ] 機能制限が適切に動作する
- [ ] 両プラットフォームで動作する
- [ ] 購入復元が機能する

## 注意事項
- テスト環境での課金テストを十分に行う
- 本番環境移行時の設定確認
- 為替レート変動への対応
- サブスクリプション解約の扱い（解約後も期限まで利用可能）

## 参考リンク
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Billing](https://developer.android.com/google/play/billing)