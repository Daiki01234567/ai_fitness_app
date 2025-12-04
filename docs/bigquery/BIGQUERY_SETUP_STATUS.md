# BigQuery セットアップ完了レポート

**作成日**: 2025-12-04
**プロジェクトID**: `tokyo-list-478804-e5`
**リージョン**: `asia-northeast1` (東京)
**関連チケット**: #014 BigQueryデータパイプライン構築

---

## 1. 完了したタスク

### 1.1 BigQuery インフラストラクチャ

| 項目 | 状態 | 詳細 |
|-----|------|------|
| BigQuery API | ✅ 有効化済み | GCP Console で確認済み |
| データセット (prod) | ✅ 作成済み | `fitness_analytics` |
| データセット (dev) | ✅ 作成済み | `fitness_analytics_dev` |
| データセット (backup) | ✅ 作成済み | `fitness_analytics_backup` |
| 予算アラート | ✅ 設定済み | $50/月 上限 |

### 1.2 テーブル構成

#### 本番環境 (`fitness_analytics`)

| テーブル名 | パーティション | クラスタリング | 有効期限 |
|-----------|--------------|--------------|---------|
| `training_sessions` | `created_at` (DAY) | `user_id_hash`, `exercise_id` | 730日 |
| `user_metadata` | `updated_at` (DAY) | `user_id_hash`, `country_code` | 730日 |
| `aggregated_stats` | `stat_date` (DAY) | `exercise_id`, `country_code` | 730日 |
| `pseudonymization_log` | `created_at` (DAY) | `status`, `source_collection` | 90日 |
| `exercise_definitions` | なし | なし | なし |

#### 開発環境 (`fitness_analytics_dev`)
- 同じテーブル構成
- 有効期限: 30日（コスト削減）

### 1.3 Pub/Sub トピック

| トピック名 | 用途 |
|-----------|------|
| `training-sessions-stream` | セッションデータのストリーミング |
| `training-sessions-dlq` | 失敗メッセージの Dead Letter Queue |

### 1.4 Cloud Functions

| 関数名 | トリガー | 説明 |
|-------|---------|------|
| `onSessionCreated` | Firestore onCreate | セッション作成時にPub/Subへ発行 |
| `onSessionUpdated` | Firestore onUpdate | セッション完了時にPub/Subへ発行 |
| `processTrainingSession` | Pub/Sub | BigQueryへストリーミング挿入 |

### 1.5 実装済み機能

- **仮名化処理**: SHA-256 + ソルトによるユーザーID仮名化
- **リトライロジック**: 指数バックオフ（最大3回）
- **DLQ処理**: 失敗メッセージを `training-sessions-dlq` へ送信
- **監査ログ**: `pseudonymization_log` テーブルへ処理結果を記録

### 1.6 スケジュール関数（2025-12-04 追加）

| 関数名 | スケジュール | 説明 |
|-------|-------------|------|
| `scheduled_dailyAggregation` | 毎日 02:00 (JST) | 前日データの日次集計 |
| `scheduled_weeklyAggregation` | 毎週月曜 03:00 (JST) | 週次統計集計 |
| `scheduled_processBigQueryDlq` | 毎日 05:00 (JST) | DLQ メッセージのリトライ |
| `admin_processDlq` | 手動 | 管理者用 DLQ 手動リトライ |

### 1.7 分析API（2025-12-04 追加）

| 関数名 | 説明 |
|-------|------|
| `analytics_getUserStats` | ユーザー個人の統計情報取得 |
| `analytics_getExerciseStats` | 種目別統計情報取得 |
| `analytics_getScoreDistribution` | スコア分布分析 |
| `analytics_getDailyTrends` | 日別トレンド分析 |
| `analytics_getActiveUsers` | DAU/WAU/MAU 分析 |
| `analytics_getRetention` | リテンション分析 |
| `analytics_getOverallStats` | 全体統計情報取得 |

---

## 2. データフロー

```
┌─────────────────┐
│  Flutter App    │
│  (セッション完了) │
└────────┬────────┘
         │ Firestore 書き込み
         ▼
┌─────────────────┐
│   Firestore     │
│ users/{uid}/    │
│ sessions/{sid}  │
└────────┬────────┘
         │ onSessionUpdated トリガー
         ▼
┌─────────────────┐
│  Cloud Function │
│ (sessions.ts)   │
└────────┬────────┘
         │ Pub/Sub 発行
         ▼
┌─────────────────────────────┐
│       Pub/Sub               │
│ training-sessions-stream    │
└────────┬────────────────────┘
         │ サブスクライブ
         ▼
┌─────────────────────────────┐
│      Cloud Function         │
│  (sessionProcessor.ts)      │
│  - ユーザーID仮名化         │
│  - データ変換               │
│  - リトライ/DLQ処理         │
└────────┬────────────────────┘
         │ ストリーミング挿入
         ▼
┌─────────────────────────────┐
│        BigQuery             │
│  fitness_analytics.         │
│  training_sessions          │
└─────────────────────────────┘
```

---

## 3. 変更されたファイル

### Cloud Functions

```
functions/src/
├── index.ts                      # Pub/Sub, スケジュール関数エクスポート
├── triggers/
│   ├── index.ts                  # sessions エクスポート有効化
│   └── sessions.ts               # Firestore → Pub/Sub トリガー
├── pubsub/
│   ├── index.ts                  # 新規作成
│   └── sessionProcessor.ts       # 新規作成 (Pub/Sub → BigQuery)
├── scheduled/
│   ├── index.ts                  # スケジュール関数エクスポート
│   ├── bigqueryDlq.ts            # DLQ処理（スケジュール + 手動）
│   └── aggregation.ts            # 日次/週次集計ジョブ
├── api/
│   ├── index.ts                  # 分析APIエクスポート追加
│   └── analytics/
│       ├── index.ts              # 分析APIインデックス
│       ├── userStats.ts          # ユーザー統計API
│       ├── exerciseRanking.ts    # 種目別ランキングAPI
│       └── trends.ts             # トレンド分析API
└── services/
    └── bigquery.ts               # テーブル名設定更新
```

### BigQuery スキーマ

```
bigquery_schemas/
├── training_sessions.json
├── user_metadata.json
├── aggregated_stats.json
├── pseudonymization_log.json
└── exercise_definitions.json
```

---

## 4. 次のステップ

### 4.1 必須: デプロイ

```bash
# Cloud Functions をデプロイ
cd functions
npm run build
firebase deploy --only functions
```

### 4.2 推奨: 環境変数設定

```bash
# 仮名化ソルトを設定（セキュリティ強化）
firebase functions:secrets:set ANONYMIZATION_SALT
# プロンプトで安全なランダム文字列を入力
```

### 4.3 確認: IAM 権限

Cloud Console で以下を確認:

1. **Cloud Functions サービスアカウント** に以下の権限があること:
   - `roles/bigquery.dataEditor`
   - `roles/pubsub.publisher`
   - `roles/pubsub.subscriber`

2. 確認コマンド:
```bash
gcloud projects get-iam-policy tokyo-list-478804-e5 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*@appspot.gserviceaccount.com"
```

### 4.4 追加実装（2025-12-04 完了）

以下のタスクが実装完了しました:

| タスク | 状態 | ファイル |
|-------|------|---------|
| DLQ 処理関数 | ✅ 完了 | `scheduled/bigqueryDlq.ts` |
| 日次集計ジョブ | ✅ 完了 | `scheduled/aggregation.ts` |
| 分析API | ✅ 完了 | `api/analytics/*.ts` |
| Looker Studio ガイド | ✅ 完了 | `docs/firebase/LOOKER_STUDIO_SETUP_GUIDE.md` |

---

## 5. 動作確認手順

### 5.1 Pub/Sub 確認

```bash
# トピック一覧
gcloud pubsub topics list --project=tokyo-list-478804-e5

# サブスクリプション確認
gcloud pubsub subscriptions list --project=tokyo-list-478804-e5
```

### 5.2 BigQuery 確認

```bash
# テーブル一覧
bq ls fitness_analytics

# データ確認（デプロイ後、セッション完了後）
bq query --use_legacy_sql=false \
  'SELECT session_id, exercise_id, created_at
   FROM `tokyo-list-478804-e5.fitness_analytics.training_sessions`
   LIMIT 10'
```

### 5.3 ログ確認

```bash
# Cloud Functions ログ
gcloud functions logs read processTrainingSession \
  --region=asia-northeast1 \
  --limit=50
```

---

## 6. トラブルシューティング

### 問題: BigQuery 挿入エラー

**症状**: `processTrainingSession` でエラーが発生

**確認手順**:
1. Cloud Functions ログを確認
2. `pseudonymization_log` テーブルで `status = 'failed'` を検索
3. DLQ トピック (`training-sessions-dlq`) のメッセージを確認

**解決策**:
- スキーマ不一致の場合: BigQuery テーブルスキーマを更新
- 権限エラーの場合: IAM 権限を確認

### 問題: Pub/Sub メッセージが処理されない

**確認手順**:
1. Firestore トリガーが発火しているか確認
2. Pub/Sub トピックにメッセージが発行されているか確認
3. サブスクリプションが正しく設定されているか確認

---

## 7. 関連ドキュメント

- [BigQuery設計書 v3.3](../specs/04_BigQuery設計書_v3_3.md)
- [チケット#014 BigQueryパイプライン](../tickets/014_bigquery_pipeline.md)
- [チケット#015 データエクスポート・削除](../tickets/015_data_export_deletion.md)
- [監視・ログ基盤](./deployment_status.md)

---

## 8. 変更履歴

| 日付 | 変更内容 |
|-----|---------|
| 2025-12-04 | 初版作成。BigQuery基盤セットアップ完了 |
| 2025-12-04 | DLQ処理関数、日次集計ジョブ、分析API、Looker Studioガイド追加 |
