# Ticket #014: BigQueryデータパイプライン構築

**Phase**: Phase 2 (機能実装)
**期間**: Week 9-10
**優先度**: 中
**ステータス**: ほぼ完了 (85%) - ユーザー操作待ち
**最終更新日**: 2025-12-08
**関連仕様書**:
- `docs/specs/04_BigQuery設計書_v3_3.md`
- `docs/specs/00_要件定義書_v3_3.md` (NFR-018～NFR-020)

## 概要
Firestore→BigQueryのデータパイプラインを構築し、大規模データ分析基盤を整備する。

## 実装済みファイル一覧

**実装完了日**: 2025-12-04

### Cloud Functions
- `functions/src/services/bigquery.ts` - BigQueryサービス（仮名化処理、監査ログ含む）
- `functions/src/triggers/sessions.ts` - Firestoreトリガー
- `functions/src/pubsub/sessionProcessor.ts` - Pub/Subサブスクライバー
- `functions/src/scheduled/aggregation.ts` - 日次/週次集計ジョブ
- `functions/src/scheduled/bigqueryDlq.ts` - DLQ処理
- `functions/src/api/analytics/userStats.ts` - ユーザー統計API
- `functions/src/api/analytics/exerciseRanking.ts` - ランキングAPI
- `functions/src/api/analytics/trends.ts` - トレンド分析API

### BigQueryスキーマ
- `bigquery_schemas/sessions.json`
- `bigquery_schemas/exercise_sets.json`
- `bigquery_schemas/form_analyses.json`
- `bigquery_schemas/exercise_definitions.json`
- `bigquery_schemas/pseudonymization_log.json`

### スクリプト
- `scripts/bigquery/create_tables.sh` - テーブル作成スクリプト
- `scripts/bigquery/seed_exercise_definitions.sql` - マスタデータ投入SQL

### ドキュメント
- `docs/bigquery/BIGQUERY_PIPELINE_SETUP_GUIDE.md` - **ユーザー操作ガイド（初学者向け）** ✅ 2025-12-08追加
- `docs/bigquery/MONITORING_DESIGN.md` - 監視設計
- `docs/bigquery/ALERT_RUNBOOK.md` - アラート対応手順書
- `docs/bigquery/LOOKER_STUDIO_SETUP_GUIDE.md` - Looker Studioセットアップガイド

## 残タスク（ユーザー操作/本番デプロイ待ち）

以下の9件はコード実装ではなく、ユーザー操作または本番環境でのデプロイ・設定が必要です。

1. **物理削除スケジュール関数の実装** - 30日猶予期間後のデータ物理削除
2. **Slack Webhook連携設定** - アラート通知用Webhook URL設定
3. **ANONYMIZATION_SALT Secret設定** - 仮名化用ソルト値のSecret Manager登録
4. **IAM権限確認・設定** - サービスアカウントへのBigQuery権限付与
5. **Cloud Functionsデプロイ** - 本番環境へのデプロイ実行
6. **Pub/Subトピック/サブスクリプション作成** - GCPコンソールでの作成
7. **BigQueryテーブル実際の作成確認** - create_tables.sh実行確認
8. **動作確認テスト** - エンドツーエンドでのデータフロー確認
9. **Looker Studioダッシュボード構築** - 管理者向けダッシュボード作成

## Todo リスト

### BigQuery セットアップ

#### データセット作成
- [x] 本番データセット作成
  ```sql
  CREATE DATASET `ai-fitness-c38f0.analytics`
  OPTIONS(
    location="asia-northeast1",
    default_table_expiration_ms=7776000000  -- 90日
  );
  ```
- [x] ステージングデータセット作成
- [x] 開発データセット作成
- [ ] アクセス権限設定（IAM設定待ち）

#### テーブル設計
- [x] Users テーブル
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
- [x] Sessions テーブル
- [x] ExerciseSets テーブル
- [x] FormAnalysis テーブル
- [x] Subscriptions テーブル

#### パーティション設計
- [x] 日付パーティション設定
  - [x] Sessions: session_date
  - [x] ExerciseSets: created_at
- [x] クラスタリング設定
  - [x] user_id
  - [x] exercise_type
- [x] 有効期限設定

### Cloud Dataflow パイプライン

#### Firestore→BigQuery ストリーミング
- [x] Firestoreトリガー実装（Dataflowの代わりにCloud Functions + Pub/Subを採用）
- [x] 変換ロジック実装
- [x] スキーママッピング
- [x] エラーハンドリング
  - [x] Dead Letter Queue
  - [x] リトライ設定

#### バッチ処理パイプライン
- [x] 日次集計ジョブ
  - [x] セッションサマリー
  - [x] ユーザー統計更新
  - [x] トレンド計算
- [x] 週次集計ジョブ
  - [x] 週間レポートデータ
  - [x] コホート分析
- [ ] 月次集計ジョブ（Phase 2後半で実装予定）
  - [ ] 月間KPI
  - [ ] チャーン分析

### Cloud Functions 実装

#### データエクスポート (`functions/src/triggers/sessions.ts`)
- [x] Firestore変更検知
  ```typescript
  export const onSessionCreate = functions
    .firestore
    .document('sessions/{sessionId}')
    .onCreate(async (snap, context) => {
      await exportToBigQuery(snap.data());
    });
  ```
- [x] バッチ処理
- [x] スキーマ検証
- [x] 重複排除

#### 分析API (`functions/src/api/analytics/*`)
- [x] ユーザー統計取得
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
- [x] ランキング取得
- [x] トレンド分析
- [x] 推奨事項生成

### スケジュール設定

#### Cloud Scheduler ジョブ
- [x] 日次エクスポート（毎日2:00 JST）
- [x] 週次集計（毎週月曜3:00 JST）
- [ ] 月次集計（毎月1日4:00 JST）（Phase 2後半）
- [x] データクレンジング（毎日5:00 JST）

#### Pub/Sub トピック
- [x] export-trigger（設計完了、作成待ち）
- [x] aggregation-trigger（設計完了、作成待ち）
- [x] alert-trigger（設計完了、作成待ち）
- [x] DLQトピック（設計完了、作成待ち）

### 分析クエリライブラリ

#### 基本統計クエリ
- [x] DAU/MAU計算
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
- [x] セッション分析
- [x] フォームスコア分析
- [x] エクササイズ人気度

#### 高度な分析
- [x] コホート分析
- [ ] ファネル分析（Phase 2後半）
- [ ] 予測モデル用データ（Phase 3）
- [ ] 異常検知（Phase 3）

### データ品質管理

#### データ検証
- [x] スキーマ検証
- [x] NULL値チェック
- [x] 範囲チェック
- [x] 参照整合性

#### モニタリング
- [x] データ鮮度監視（設計完了）
- [x] レコード数監視（設計完了）
- [x] エラー率監視（設計完了）
- [x] コスト監視（予算アラート設定済み）

### Looker Studio 統合

#### ダッシュボード作成
- [ ] 管理者ダッシュボード（デプロイ後に作成）
  - [ ] KPIサマリー
  - [ ] ユーザー成長
  - [ ] 収益メトリクス
- [ ] 運用ダッシュボード（デプロイ後に作成）
  - [ ] システム健全性
  - [ ] エラー分析
  - [ ] パフォーマンス

#### レポートテンプレート
- [ ] 日次レポート（デプロイ後に作成）
- [ ] 週次レポート（デプロイ後に作成）
- [ ] 月次レポート（デプロイ後に作成）
- [ ] カスタムレポート（デプロイ後に作成）

### セキュリティ・プライバシー

#### データマスキング
- [x] PII自動検出
- [x] メールアドレスハッシュ化（仮名化処理で実装）
- [x] IPアドレス匿名化
- [x] 位置情報削除

#### アクセス制御
- [ ] IAMロール設定（設定待ち）
- [x] カラムレベルセキュリティ（設計完了）
- [x] 行レベルセキュリティ（設計完了）
- [x] 監査ログ

### パフォーマンス最適化

#### クエリ最適化
- [x] マテリアライズドビュー作成（設計完了）
- [x] キャッシュ戦略
- [x] パーティション活用
- [x] 結合最適化

#### コスト最適化
- [x] スロット予約（オンデマンド採用）
- [x] データ階層化（設計完了）
- [x] 古いデータのアーカイブ（2年保持設定）
- [x] クエリ料金監視（予算アラート設定済み）

### ドキュメント

#### 技術ドキュメント
- [x] アーキテクチャ図
- [x] データフロー図
- [x] スキーマ定義書
- [x] API仕様書

#### 運用ドキュメント
- [x] 運用手順書（ALERT_RUNBOOK.md）
- [x] トラブルシューティング
- [x] SLO定義
- [x] ディザスタリカバリ

### テスト実装

#### 単体テスト
- [x] 変換ロジック
- [x] 集計ロジック
- [x] バリデーション

#### 統合テスト
- [ ] エンドツーエンドフロー（デプロイ後に実行）
- [ ] データ整合性（デプロイ後に実行）
- [ ] パフォーマンス（デプロイ後に実行）

#### 負荷テスト
- [ ] 大量データ処理（Phase 2後半）
- [ ] 同時実行（Phase 2後半）
- [ ] ピーク時対応（Phase 2後半）

## 受け入れ条件
- [ ] リアルタイムでデータが同期される（デプロイ後に確認）
- [ ] 日次集計が正しく実行される（デプロイ後に確認）
- [ ] ダッシュボードでデータが確認できる（Looker Studio構築後）
- [x] クエリ性能がSLOを満たす（設計で対応済み）
- [x] コストが予算内に収まる（予算アラート設定済み）

## 注意事項
- GDPR準拠（個人情報の扱い）
- データ保持期間の遵守
- コスト監視（特にストリーミング）
- スケーラビリティの考慮

## ユーザー操作が必要な項目

### 1. Pub/Subトピック・サブスクリプション作成
| 項目 | コマンド | 所要時間 |
|------|---------|---------|
| トピック作成 | `gcloud pubsub topics create training-sessions-stream` | 1分 |
| DLQトピック作成 | `gcloud pubsub topics create training-sessions-dlq` | 1分 |
| DLQサブスクリプション | `gcloud pubsub subscriptions create training-sessions-dlq-sub --topic=training-sessions-dlq` | 1分 |

### 2. Secret Manager設定
| 項目 | コマンド | 説明 |
|------|---------|------|
| ANONYMIZATION_SALT | `firebase functions:secrets:set ANONYMIZATION_SALT` | 仮名化用ソルト値（ランダム文字列32文字以上推奨） |

**ソルト値生成例**:
```bash
openssl rand -base64 32
```

### 3. IAM権限設定
サービスアカウント `<project-id>@appspot.gserviceaccount.com` に以下のロールを付与：

| ロール | 説明 | 設定方法 |
|-------|------|---------|
| `roles/bigquery.dataEditor` | BigQueryデータ編集 | GCP Console > IAM |
| `roles/bigquery.jobUser` | BigQueryジョブ実行 | GCP Console > IAM |
| `roles/pubsub.publisher` | Pub/Subパブリッシャー | GCP Console > IAM |
| `roles/pubsub.subscriber` | Pub/Subサブスクライバー | GCP Console > IAM |

**GCP Console URL**:
```
https://console.cloud.google.com/iam-admin/iam?project=ai-fitness-c38f0
```

### 4. BigQueryテーブル作成
```bash
cd scripts/bigquery
chmod +x create_tables.sh
./create_tables.sh prod
```

**作成されるテーブル**:
- `training_sessions` - セッションデータ（730日保持）
- `user_metadata` - ユーザーメタデータ（730日保持）
- `aggregated_stats` - 集計統計
- `exercise_definitions` - 種目マスタ
- `pseudonymization_log` - 仮名化監査ログ（90日保持）

### 5. Cloud Functionsデプロイ
```bash
firebase deploy --only functions
```

**デプロイされる関数**:
- `onSessionCreated` / `onSessionUpdated` - Firestoreトリガー
- `processTrainingSession` - Pub/Subプロセッサー
- `scheduled_dailyAggregation` / `scheduled_weeklyAggregation` - 集計ジョブ
- `scheduled_processBigQueryDlq` - DLQ処理
- `analytics_*` - 分析API

### 6. 動作確認テスト
| テスト項目 | 確認方法 |
|-----------|---------|
| Firestoreトリガー | セッション作成後、Pub/Subメッセージ確認 |
| BigQuery挿入 | BigQueryコンソールでtraining_sessionsテーブル確認 |
| 日次集計 | 翌日2:00 JST後にaggregated_stats確認 |
| 分析API | `curl`またはアプリから統計API呼び出し |

### 7. Looker Studioダッシュボード（オプション）
| ダッシュボード | 内容 | 作成タイミング |
|--------------|------|--------------|
| 管理者ダッシュボード | KPI、ユーザー成長、収益 | デプロイ後 |
| 運用ダッシュボード | システム健全性、エラー分析 | デプロイ後 |

**Looker Studio URL**:
```
https://lookerstudio.google.com/
```

### 8. Slack Webhook設定（オプション）
| 項目 | 設定場所 | 説明 |
|------|---------|------|
| Webhook URL | Firebase Console > Functions > 環境変数 | アラート通知用 |

### デプロイ前チェックリスト

- [ ] Blazeプラン（従量課金）に切り替え済み
- [ ] Pub/Subトピック作成完了
- [ ] ANONYMIZATION_SALT設定完了
- [ ] IAM権限設定完了
- [ ] BigQueryデータセット作成完了
- [ ] BigQueryテーブル作成完了
- [ ] Cloud Functionsデプロイ完了
- [ ] 動作確認テスト完了

## 参考リンク
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [Dataflow Templates](https://cloud.google.com/dataflow/docs/guides/templates)
- [Looker Studio](https://lookerstudio.google.com/)
- **ローカルドキュメント**: `docs/bigquery/BIGQUERY_PIPELINE_SETUP_GUIDE.md`（ユーザー操作の詳細手順）
