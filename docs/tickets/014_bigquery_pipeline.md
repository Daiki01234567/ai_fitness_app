# Ticket #014: BigQueryデータパイプライン構築

**Phase**: Phase 2 (機能実装)
**期間**: Week 9-10
**優先度**: 中
**ステータス**: なし
**関連仕様書**:
- `docs/specs/04_BigQuery設計書_v3_3.md`
- `docs/specs/00_要件定義書_v3_3.md` (NFR-018～NFR-020)

## 概要
Firestore→BigQueryのデータパイプラインを構築し、大規模データ分析基盤を整備する。

## Todo リスト

### BigQuery セットアップ

#### データセット作成
- [ ] 本番データセット作成
  ```sql
  CREATE DATASET `ai-fitness-c38f0.analytics`
  OPTIONS(
    location="asia-northeast1",
    default_table_expiration_ms=7776000000  -- 90日
  );
  ```
- [ ] ステージングデータセット作成
- [ ] 開発データセット作成
- [ ] アクセス権限設定

#### テーブル設計
- [ ] Users テーブル
  ```sql
  CREATE TABLE analytics.users (
    user_id STRING NOT NULL,
    email STRING,
    display_name STRING,
    created_at TIMESTAMP,
    last_active TIMESTAMP,
    subscription_status STRING,
    total_sessions INT64,
    avg_form_score FLOAT64,
    PRIMARY KEY (user_id) NOT ENFORCED
  );
  ```
- [ ] Sessions テーブル
- [ ] ExerciseSets テーブル
- [ ] FormAnalysis テーブル
- [ ] Subscriptions テーブル

#### パーティション設計
- [ ] 日付パーティション設定
  - [ ] Sessions: session_date
  - [ ] ExerciseSets: created_at
- [ ] クラスタリング設定
  - [ ] user_id
  - [ ] exercise_type
- [ ] 有効期限設定

### Cloud Dataflow パイプライン

#### Firestore→BigQuery ストリーミング
- [ ] Dataflowテンプレート作成
- [ ] 変換ロジック実装
  ```python
  def transform_session(session):
    return {
      'session_id': session['id'],
      'user_id': session['userId'],
      'duration_seconds': calculate_duration(session),
      'form_scores': extract_scores(session),
      'timestamp': session['createdAt']
    }
  ```
- [ ] スキーママッピング
- [ ] エラーハンドリング
  - [ ] Dead Letter Queue
  - [ ] リトライ設定

#### バッチ処理パイプライン
- [ ] 日次集計ジョブ
  - [ ] セッションサマリー
  - [ ] ユーザー統計更新
  - [ ] トレンド計算
- [ ] 週次集計ジョブ
  - [ ] 週間レポートデータ
  - [ ] コホート分析
- [ ] 月次集計ジョブ
  - [ ] 月間KPI
  - [ ] チャーン分析

### Cloud Functions 実装

#### データエクスポート (`functions/bigquery/export.ts`)
- [ ] Firestore変更検知
  ```typescript
  export const onSessionCreate = functions
    .firestore
    .document('sessions/{sessionId}')
    .onCreate(async (snap, context) => {
      await exportToBigQuery(snap.data());
    });
  ```
- [ ] バッチ処理
- [ ] スキーマ検証
- [ ] 重複排除

#### 分析API (`api/analytics/*`)
- [ ] ユーザー統計取得
  ```typescript
  // api/analytics/userStats.ts
  export async function getUserStats(userId: string) {
    const query = `
      SELECT
        COUNT(*) as total_sessions,
        AVG(form_score) as avg_score,
        MAX(session_date) as last_session
      FROM analytics.sessions
      WHERE user_id = @userId
    `;
    return await bigquery.query(query);
  }
  ```
- [ ] ランキング取得
- [ ] トレンド分析
- [ ] 推奨事項生成

### スケジュール設定

#### Cloud Scheduler ジョブ
- [ ] 日次エクスポート（毎日2:00 JST）
- [ ] 週次集計（毎週月曜3:00 JST）
- [ ] 月次集計（毎月1日4:00 JST）
- [ ] データクレンジング（毎日5:00 JST）

#### Pub/Sub トピック
- [ ] export-trigger
- [ ] aggregation-trigger
- [ ] alert-trigger
- [ ] DLQトピック

### 分析クエリライブラリ

#### 基本統計クエリ
- [ ] DAU/MAU計算
  ```sql
  WITH daily_active AS (
    SELECT
      DATE(session_timestamp) as date,
      COUNT(DISTINCT user_id) as dau
    FROM analytics.sessions
    WHERE DATE(session_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY date
  )
  SELECT
    date,
    dau,
    AVG(dau) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as wau_7d
  FROM daily_active
  ORDER BY date DESC;
  ```
- [ ] セッション分析
- [ ] フォームスコア分析
- [ ] エクササイズ人気度

#### 高度な分析
- [ ] コホート分析
- [ ] ファネル分析
- [ ] 予測モデル用データ
- [ ] 異常検知

### データ品質管理

#### データ検証
- [ ] スキーマ検証
- [ ] NULL値チェック
- [ ] 範囲チェック
- [ ] 参照整合性

#### モニタリング
- [ ] データ鮮度監視
- [ ] レコード数監視
- [ ] エラー率監視
- [ ] コスト監視

### Looker Studio 統合

#### ダッシュボード作成
- [ ] 管理者ダッシュボード
  - [ ] KPIサマリー
  - [ ] ユーザー成長
  - [ ] 収益メトリクス
- [ ] 運用ダッシュボード
  - [ ] システム健全性
  - [ ] エラー分析
  - [ ] パフォーマンス

#### レポートテンプレート
- [ ] 日次レポート
- [ ] 週次レポート
- [ ] 月次レポート
- [ ] カスタムレポート

### セキュリティ・プライバシー

#### データマスキング
- [ ] PII自動検出
- [ ] メールアドレスハッシュ化
- [ ] IPアドレス匿名化
- [ ] 位置情報削除

#### アクセス制御
- [ ] IAMロール設定
- [ ] カラムレベルセキュリティ
- [ ] 行レベルセキュリティ
- [ ] 監査ログ

### パフォーマンス最適化

#### クエリ最適化
- [ ] マテリアライズドビュー作成
- [ ] キャッシュ戦略
- [ ] パーティション活用
- [ ] 結合最適化

#### コスト最適化
- [ ] スロット予約
- [ ] データ階層化
- [ ] 古いデータのアーカイブ
- [ ] クエリ料金監視

### ドキュメント

#### 技術ドキュメント
- [ ] アーキテクチャ図
- [ ] データフロー図
- [ ] スキーマ定義書
- [ ] API仕様書

#### 運用ドキュメント
- [ ] 運用手順書
- [ ] トラブルシューティング
- [ ] SLO定義
- [ ] ディザスタリカバリ

### テスト実装

#### 単体テスト
- [ ] 変換ロジック
- [ ] 集計ロジック
- [ ] バリデーション

#### 統合テスト
- [ ] エンドツーエンドフロー
- [ ] データ整合性
- [ ] パフォーマンス

#### 負荷テスト
- [ ] 大量データ処理
- [ ] 同時実行
- [ ] ピーク時対応

## 受け入れ条件
- [ ] リアルタイムでデータが同期される
- [ ] 日次集計が正しく実行される
- [ ] ダッシュボードでデータが確認できる
- [ ] クエリ性能がSLOを満たす
- [ ] コストが予算内に収まる

## 注意事項
- GDPR準拠（個人情報の扱い）
- データ保持期間の遵守
- コスト監視（特にストリーミング）
- スケーラビリティの考慮

## 参考リンク
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [Dataflow Templates](https://cloud.google.com/dataflow/docs/guides/templates)
- [Looker Studio](https://lookerstudio.google.com/)
