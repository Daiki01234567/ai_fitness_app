# BigQuery設計書 v1.0

**バージョン**: 1.0
**最終更新日**: 2025年12月9日
**対象**: AIフィットネスアプリ（共通仕様）
**基準**: Expo版要件定義書 v1.0

---

## 目次

1. [ドキュメント概要](#1-ドキュメント概要)
2. [データセット設計](#2-データセット設計)
3. [テーブル定義](#3-テーブル定義)
4. [仮名化処理](#4-仮名化処理)
5. [パーティショニングとクラスタリング](#5-パーティショニングとクラスタリング)
6. [データ同期フロー](#6-データ同期フロー)
7. [分析クエリ例](#7-分析クエリ例)

---

## 1. ドキュメント概要

### 1.1 目的

本ドキュメントは、AIフィットネスアプリの分析基盤であるBigQueryの設計を定義します。

**設計の目標**:
- GDPR準拠の仮名化処理
- 2年間のデータ保持
- 自動パーティショニングによる効率的なストレージ
- 統計分析とML学習準備

### 1.2 想定読者

- バックエンドエンジニア
- データエンジニア
- データサイエンティスト
- プロジェクトマネージャー

### 1.3 参照ドキュメント

| ドキュメント名 | バージョン | 参照目的 |
|--------------|-----------|---------|
| Firestoreデータベース設計書 | v1.0 | データモデル |
| API設計書 | v1.0 | データ同期フロー |
| プライバシーポリシー | v1.0 | データ保持ポリシー |

---

## 2. データセット設計

### 2.1 データセット構成

```
ai-fitness-app
├── analytics_production       # 本番環境データ
│   ├── sessions              # トレーニングセッション
│   ├── frames                # フレームデータ
│   ├── user_aggregates       # ユーザー集計データ
│   └── device_performance    # デバイスパフォーマンス
└── analytics_development     # 開発環境データ
    ├── sessions
    ├── frames
    ├── user_aggregates
    └── device_performance
```

### 2.2 データセット設定

| 項目 | 値 | 説明 |
|-----|---|------|
| **Location** | asia-northeast1（東京） | 日本市場向け |
| **Default Table Expiration** | 730日（2年） | GDPR準拠 |
| **Encryption** | Google管理鍵 | 保存時暗号化 |
| **Data Residency** | 日本 | データ所在地 |

---

## 3. テーブル定義

### 3.1 sessions テーブル

**目的**: トレーニングセッションの集計データ

**スキーマ**:

```sql
CREATE TABLE `ai-fitness-app.analytics_production.sessions` (
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

  -- フォーム評価
  overall_score INT64,  -- 0-100
  good_frames INT64,
  warning_frames INT64,
  error_frames INT64,
  warnings ARRAY<STRUCT<
    type STRING,
    count INT64,
    severity STRING
  >>,

  -- カメラ設定
  camera_position STRING,  -- front, side
  camera_resolution STRING,
  camera_fps INT64,

  -- パフォーマンスメトリクス
  total_frames INT64,
  processed_frames INT64,
  average_fps FLOAT64,
  frame_drop_count INT64,
  average_confidence FLOAT64,

  -- MediaPipeパフォーマンス
  average_inference_time FLOAT64,  -- ms
  max_inference_time FLOAT64,
  min_inference_time FLOAT64,

  -- デバイス情報
  platform STRING,  -- iOS, Android
  os_version STRING,
  device_model STRING,
  device_memory FLOAT64,  -- GB

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL  -- BigQuery同期日時

) PARTITION BY DATE(created_at)
CLUSTER BY exercise_type, platform;
```

### 3.2 frames テーブル

**目的**: フレーム単位の骨格座標データ

**スキーマ**:

```sql
CREATE TABLE `ai-fitness-app.analytics_production.frames` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL,
  session_id STRING NOT NULL,
  frame_id STRING NOT NULL,

  -- フレーム情報
  frame_number INT64 NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- 骨格座標データ（33個の関節点）
  landmarks ARRAY<STRUCT<
    id INT64,           -- 関節ID（0-32）
    x FLOAT64,          -- 正規化X座標（0-1）
    y FLOAT64,          -- 正規化Y座標（0-1）
    z FLOAT64,          -- 深度（相対値）
    visibility FLOAT64  -- 信頼度（0-1）
  >>,

  -- フォーム評価
  frame_score INT64,  -- 0-100
  frame_status STRING,  -- good, warning, error

  -- パフォーマンス
  inference_time FLOAT64,  -- ms

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL

) PARTITION BY DATE(created_at)
CLUSTER BY session_id;
```

### 3.3 user_aggregates テーブル

**目的**: ユーザー単位の集計データ（週次・月次）

**スキーマ**:

```sql
CREATE TABLE `ai-fitness-app.analytics_production.user_aggregates` (
  -- 仮名化ID
  user_id_hash STRING NOT NULL,

  -- 集計期間
  period_type STRING NOT NULL,  -- weekly, monthly
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- トレーニング統計
  total_sessions INT64,
  total_reps INT64,
  total_duration INT64,  -- 秒
  average_score FLOAT64,

  -- 種目別統計
  exercise_stats ARRAY<STRUCT<
    exercise_type STRING,
    session_count INT64,
    rep_count INT64,
    average_score FLOAT64
  >>,

  -- プロフィール情報（オプション）
  height INT64,  -- cm
  weight INT64,  -- kg
  gender STRING,  -- male, female, other, prefer_not_to_say
  fitness_level STRING,  -- beginner, intermediate, advanced

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL

) PARTITION BY period_start
CLUSTER BY period_type, fitness_level;
```

### 3.4 device_performance テーブル

**目的**: デバイス別パフォーマンス分析

**スキーマ**:

```sql
CREATE TABLE `ai-fitness-app.analytics_production.device_performance` (
  -- デバイス情報
  platform STRING NOT NULL,
  os_version STRING NOT NULL,
  device_model STRING NOT NULL,
  device_memory FLOAT64,

  -- 集計期間
  date DATE NOT NULL,

  -- パフォーマンス統計
  session_count INT64,
  average_fps FLOAT64,
  average_frame_drop_rate FLOAT64,  -- %
  average_inference_time FLOAT64,  -- ms
  p50_inference_time FLOAT64,
  p95_inference_time FLOAT64,
  p99_inference_time FLOAT64,

  -- 低スペック判定
  is_low_spec BOOLEAN,  -- average_fps < 25

  -- タイムスタンプ
  created_at TIMESTAMP NOT NULL

) PARTITION BY date
CLUSTER BY platform, device_model;
```

---

## 4. 仮名化処理

### 4.1 仮名化方針

**GDPR第4条第5項準拠**: 個人を特定できない形式に変換

**仮名化の方法**:
- **ユーザーID**: SHA-256ハッシュ化
- **メールアドレス**: 削除（送信しない）
- **写真**: 送信しない（骨格座標のみ）
- **IPアドレス**: 削除

### 4.2 仮名化実装

```typescript
import crypto from 'crypto';

/**
 * ユーザーIDを仮名化
 */
function pseudonymizeUserId(userId: string): string {
  const salt = process.env.PSEUDONYMIZATION_SALT;
  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}

/**
 * セッションデータを仮名化してBigQueryに送信
 */
async function syncSessionToBigQuery(
  userId: string,
  sessionData: SessionDocument
) {
  const pseudonymizedData = {
    user_id_hash: pseudonymizeUserId(userId),
    session_id: sessionData.sessionId,
    exercise_type: sessionData.exerciseType,
    start_time: sessionData.startTime.toDate().toISOString(),
    end_time: sessionData.endTime?.toDate().toISOString() || null,
    duration: sessionData.duration,
    status: sessionData.status,
    rep_count: sessionData.repCount,
    set_count: sessionData.setCount,
    overall_score: sessionData.formFeedback.overallScore,
    good_frames: sessionData.formFeedback.goodFrames,
    warning_frames: sessionData.formFeedback.warningFrames,
    error_frames: sessionData.formFeedback.errorFrames,
    warnings: sessionData.formFeedback.warnings,
    camera_position: sessionData.cameraSettings.position,
    camera_resolution: sessionData.cameraSettings.resolution,
    camera_fps: sessionData.cameraSettings.fps,
    total_frames: sessionData.sessionMetadata.totalFrames,
    processed_frames: sessionData.sessionMetadata.processedFrames,
    average_fps: sessionData.sessionMetadata.averageFps,
    frame_drop_count: sessionData.sessionMetadata.frameDropCount,
    average_confidence: sessionData.sessionMetadata.averageConfidence,
    average_inference_time: sessionData.sessionMetadata.mediapipePerformance.averageInferenceTime,
    max_inference_time: sessionData.sessionMetadata.mediapipePerformance.maxInferenceTime,
    min_inference_time: sessionData.sessionMetadata.mediapipePerformance.minInferenceTime,
    platform: sessionData.sessionMetadata.deviceInfo.platform,
    os_version: sessionData.sessionMetadata.deviceInfo.osVersion,
    device_model: sessionData.sessionMetadata.deviceInfo.deviceModel,
    device_memory: sessionData.sessionMetadata.deviceInfo.deviceMemory,
    created_at: sessionData.createdAt.toDate().toISOString(),
    synced_at: new Date().toISOString()
  };

  await bigquery
    .dataset('analytics_production')
    .table('sessions')
    .insert([pseudonymizedData]);
}
```

---

## 5. パーティショニングとクラスタリング

### 5.1 パーティショニング戦略

全てのテーブルは**日次パーティショニング**を使用します。

**メリット**:
- クエリコストの削減
- 古いデータの自動削除（2年後）
- クエリパフォーマンスの向上

**設定**:

```sql
PARTITION BY DATE(created_at)
OPTIONS(
  partition_expiration_days = 730,  -- 2年後に自動削除
  require_partition_filter = true   -- パーティションフィルタ必須
)
```

### 5.2 クラスタリング戦略

| テーブル | クラスタリングキー | 理由 |
|---------|-----------------|------|
| sessions | `exercise_type`, `platform` | 種目別・プラットフォーム別分析が多い |
| frames | `session_id` | セッション単位でのクエリが多い |
| user_aggregates | `period_type`, `fitness_level` | 期間別・レベル別分析が多い |
| device_performance | `platform`, `device_model` | デバイス別分析が多い |

---

## 6. データ同期フロー

### 6.1 同期タイミング

| データ | 同期タイミング | 方法 |
|--------|-------------|------|
| セッションデータ | セッション完了時 | Firestore Trigger → Cloud Functions → BigQuery |
| フレームデータ | セッション完了時（バッチ） | Cloud Functions → BigQuery Streaming Insert |
| 集計データ | 日次バッチ | Cloud Scheduler → Cloud Functions → BigQuery |

### 6.2 リトライ処理

**Cloud Tasksによるリトライキュー**:
- 最大10回リトライ
- 指数バックオフ（1秒、2秒、4秒...）
- 失敗時はDead Letter Queueに保存

**実装**:

```typescript
export const session_onComplete = onDocumentWritten(
  'users/{userId}/sessions/{sessionId}',
  async (event) => {
    const sessionData = event.data?.after.data();

    if (sessionData?.status === 'completed') {
      try {
        await syncSessionToBigQuery(event.params.userId, sessionData);
      } catch (error) {
        console.error('BigQuery sync failed:', error);

        // Cloud Tasksにリトライタスクを登録
        await enqueueRetryTask({
          userId: event.params.userId,
          sessionId: event.params.sessionId,
          tableName: 'sessions',
          retryCount: 0
        });
      }
    }
  }
);
```

---

## 7. 分析クエリ例

### 7.1 種目別平均スコア

```sql
SELECT
  exercise_type,
  COUNT(*) AS session_count,
  AVG(overall_score) AS average_score,
  STDDEV(overall_score) AS score_stddev
FROM `ai-fitness-app.analytics_production.sessions`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND status = 'completed'
GROUP BY exercise_type
ORDER BY average_score DESC;
```

### 7.2 低スペック端末の割合

```sql
SELECT
  platform,
  COUNT(*) AS total_sessions,
  COUNTIF(average_fps < 25) AS low_spec_sessions,
  ROUND(COUNTIF(average_fps < 25) * 100.0 / COUNT(*), 2) AS low_spec_percentage
FROM `ai-fitness-app.analytics_production.sessions`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY platform
ORDER BY platform;
```

### 7.3 デバイスモデル別パフォーマンス

```sql
SELECT
  device_model,
  platform,
  COUNT(*) AS session_count,
  AVG(average_fps) AS avg_fps,
  AVG(average_inference_time) AS avg_inference_time,
  APPROX_QUANTILES(average_fps, 100)[OFFSET(50)] AS median_fps,
  APPROX_QUANTILES(average_fps, 100)[OFFSET(95)] AS p95_fps
FROM `ai-fitness-app.analytics_production.sessions`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND status = 'completed'
GROUP BY device_model, platform
HAVING session_count >= 10  -- 最低10セッション
ORDER BY avg_fps DESC
LIMIT 20;
```

### 7.4 ユーザー継続率（週次）

```sql
WITH weekly_users AS (
  SELECT
    user_id_hash,
    DATE_TRUNC(DATE(created_at), WEEK) AS week,
    COUNT(*) AS session_count
  FROM `ai-fitness-app.analytics_production.sessions`
  WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 12 WEEK)
    AND status = 'completed'
  GROUP BY user_id_hash, week
)
SELECT
  week,
  COUNT(DISTINCT user_id_hash) AS active_users
FROM weekly_users
GROUP BY week
ORDER BY week;
```

---

## 変更履歴

| バージョン | 日付 | 主な変更内容 |
|-----------|------|-------------|
| **v1.0** | 2025年12月9日 | 初版作成。Flutter版を基に、Expo版の5種目（squat, pushup, armcurl, sidelateral, shoulderpress）に対応。 |

---

**このドキュメントは、Expo版とFlutter版の両方で共通利用可能です。**

**作成者**: Claude (Documentation Engineer)
**最終確認日**: 2025年12月9日
