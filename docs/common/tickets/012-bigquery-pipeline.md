# 012 BigQueryパイプライン構築

## 概要

トレーニングデータを分析するためのBigQuery（Googleのデータ分析サービス）のテーブルとデータセットを構築します。

BigQueryは、大量のデータを高速に分析できるサービスです。このチケットでは、アプリで記録されたトレーニングデータを分析できる基盤を作ります。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/003: Firebase Authentication 統合

## 要件

### データセット作成

1. **analytics_production**: 本番環境用のデータセット
2. **analytics_development**: 開発環境用のデータセット

### テーブル作成

1. **sessions**: トレーニングセッションのデータ
   - 種目、回数、スコア、デバイス情報など

2. **frames**: フレーム単位の骨格座標データ
   - 33個の関節位置情報

3. **user_aggregates**: ユーザーごとの集計データ
   - 週次・月次の統計

4. **device_performance**: デバイス別パフォーマンスデータ
   - 端末ごとのFPS、推論時間など

### ストリーミングインサート設定

- Firestoreにデータが保存されたら、自動でBigQueryに送信
- リアルタイムに近いデータ反映（遅延は数秒程度）

## 受け入れ条件

- [ ] analytics_production データセットが作成されている
- [ ] analytics_development データセットが作成されている
- [ ] sessions テーブルのスキーマが正しく設定されている
- [ ] frames テーブルのスキーマが正しく設定されている
- [ ] user_aggregates テーブルのスキーマが正しく設定されている
- [ ] device_performance テーブルのスキーマが正しく設定されている
- [ ] 日次パーティショニングが設定されている
- [ ] 2年後に自動削除される設定になっている（partition_expiration_days = 730）
- [ ] クラスタリングが正しく設定されている

## 参照ドキュメント

- `docs/common/specs/05_BigQuery設計書_v1_0.md` - 全体
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - セクション4.5（データ分析）

## 技術詳細

### データセット設定

| 項目 | 値 | 説明 |
|-----|---|------|
| Location | asia-northeast1（東京） | 日本市場向け |
| Default Table Expiration | 730日（2年） | GDPR準拠 |
| Encryption | Google管理鍵 | 保存時暗号化 |

### sessions テーブルスキーマ（抜粋）

```sql
CREATE TABLE `project-id.analytics_production.sessions` (
  -- 仮名化ID（SHA-256ハッシュ）
  user_id_hash STRING NOT NULL,

  -- セッション情報
  session_id STRING NOT NULL,
  exercise_type STRING NOT NULL,  -- squat, pushup, armcurl, sidelateral, shoulderpress
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INT64,  -- 秒
  status STRING NOT NULL,  -- completed, cancelled

  -- トレーニング結果
  rep_count INT64 NOT NULL,
  set_count INT64 NOT NULL,
  overall_score INT64,  -- 0-100

  -- パフォーマンスメトリクス
  average_fps FLOAT64,
  average_inference_time FLOAT64,  -- ms

  -- デバイス情報
  platform STRING,  -- iOS, Android
  device_model STRING,

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL  -- BigQuery同期日時

) PARTITION BY DATE(created_at)
CLUSTER BY exercise_type, platform;
```

### パーティショニングとクラスタリング

| テーブル | パーティショニング | クラスタリングキー | 理由 |
|---------|-----------------|-----------------|------|
| sessions | DATE(created_at) | exercise_type, platform | 種目別・プラットフォーム別分析が多い |
| frames | DATE(created_at) | session_id | セッション単位でのクエリが多い |
| user_aggregates | period_start | period_type, fitness_level | 期間別・レベル別分析が多い |
| device_performance | date | platform, device_model | デバイス別分析が多い |

### なぜパーティショニングが必要？

パーティショニングは、データを日付ごとに分けて保存する仕組みです。

**メリット**:
1. **コスト削減**: 必要な日付のデータだけ検索できる
2. **自動削除**: 2年経ったデータは自動で消える
3. **高速化**: 検索範囲を絞れるので速くなる

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| NFR-022 | データ分析基盤の構築 |
| NFR-031 | データ保存期間2年（GDPR準拠） |

## 見積もり

3日

## 進捗

- [ ] 未着手
