# 043 利用状況集計API

## 概要

サービスの利用状況を管理者が把握するための集計APIを実装するチケットです。DAU（日次アクティブユーザー）、MAU（月次アクティブユーザー）、トレーニング種目別統計、課金状況などのメトリクスを提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤
- 012: セッション取得API（トレーニングデータが必要）

## 要件

### 機能要件

- FR-ADM-002: 利用状況集計 - 期間やトレーニング種目ごとの利用状況を集計

### 非機能要件

- NFR-042: 管理画面レスポンス - 3秒以内に応答

## 受け入れ条件（Todo）

### DAU/MAU取得API

- [ ] 日次アクティブユーザー数（DAU）取得APIを実装
- [ ] 月次アクティブユーザー数（MAU）取得APIを実装
- [ ] 期間指定でのDAU推移取得APIを実装
- [ ] 新規ユーザー数の取得機能を実装
- [ ] ユーザーリテンション率の計算機能を実装

### 種目別利用統計API

- [ ] 種目別のセッション数取得APIを実装
- [ ] 種目別の平均スコア取得APIを実装
- [ ] 種目別の平均トレーニング時間取得APIを実装
- [ ] 人気種目ランキングAPIを実装

### 課金状況集計API

- [ ] アクティブな有料会員数取得APIを実装
- [ ] 新規課金ユーザー数取得APIを実装
- [ ] 解約率（Churn Rate）取得APIを実装
- [ ] MRR（月次定期収益）取得APIを実装
- [ ] トライアルからの課金転換率取得APIを実装

### ダッシュボード集計API

- [ ] 主要KPIをまとめて取得するダッシュボードAPIを実装
- [ ] キャッシュ機構を実装（リアルタイム性と負荷のバランス）
- [ ] 日次/週次/月次での比較機能を実装

### テスト

- [ ] 各集計APIのユニットテストを作成
- [ ] 集計ロジックの正確性テストを作成
- [ ] パフォーマンステストを作成（大量データでの応答時間）
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-002（利用状況集計）
- `docs/common/specs/05_BigQuery設計書_v1_0.md` - 分析用テーブル構造

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| GET | `/admin/analytics/overview` | ダッシュボード概要 | admin以上 |
| GET | `/admin/analytics/users/active` | DAU/MAU | admin以上 |
| GET | `/admin/analytics/users/retention` | リテンション率 | admin以上 |
| GET | `/admin/analytics/exercises` | 種目別統計 | admin以上 |
| GET | `/admin/analytics/revenue` | 課金統計 | admin以上 |

### リクエスト/レスポンス形式

#### ダッシュボード概要

```typescript
// リクエスト（クエリパラメータ）
interface OverviewRequest {
  date?: string;  // 基準日（ISO 8601形式、デフォルト: 今日）
}

// レスポンス
interface OverviewResponse {
  date: string;
  users: {
    total: number;              // 総ユーザー数
    dau: number;                // 今日のDAU
    dauChange: number;          // 前日比（%）
    mau: number;                // 今月のMAU
    mauChange: number;          // 前月比（%）
    newToday: number;           // 今日の新規登録数
    newThisMonth: number;       // 今月の新規登録数
  };
  training: {
    sessionsToday: number;      // 今日のセッション数
    sessionsChange: number;     // 前日比（%）
    avgDuration: number;        // 平均トレーニング時間（秒）
    topExercise: string;        // 最も人気の種目
  };
  revenue: {
    activeSubscriptions: number;  // アクティブな有料会員数
    mrr: number;                  // MRR（円）
    mrrChange: number;            // 前月比（%）
    trialUsers: number;           // トライアル中のユーザー数
    conversionRate: number;       // トライアル→課金転換率（%）
  };
  generatedAt: string;          // 生成日時
  cacheExpiresAt: string;       // キャッシュ有効期限
}
```

#### DAU/MAU取得

```typescript
// リクエスト（クエリパラメータ）
interface ActiveUsersRequest {
  startDate: string;    // 開始日（ISO 8601形式）
  endDate: string;      // 終了日（ISO 8601形式）
  granularity: "day" | "week" | "month";
}

// レスポンス
interface ActiveUsersResponse {
  data: {
    date: string;
    activeUsers: number;
    newUsers: number;
  }[];
  summary: {
    avgDau: number;       // 期間平均DAU
    peakDau: number;      // 最大DAU
    peakDate: string;     // 最大DAUの日付
    totalNewUsers: number;
  };
}
```

#### リテンション率

```typescript
// リクエスト（クエリパラメータ）
interface RetentionRequest {
  cohortMonth: string;  // コホート月（YYYY-MM形式）
}

// レスポンス
interface RetentionResponse {
  cohortMonth: string;
  cohortSize: number;     // 対象ユーザー数
  retention: {
    day1: number;         // 1日後の継続率（%）
    day7: number;         // 7日後の継続率（%）
    day14: number;        // 14日後の継続率（%）
    day30: number;        // 30日後の継続率（%）
    day60: number;        // 60日後の継続率（%）
    day90: number;        // 90日後の継続率（%）
  };
}
```

#### 種目別統計

```typescript
// リクエスト（クエリパラメータ）
interface ExerciseStatsRequest {
  startDate: string;
  endDate: string;
}

// レスポンス
interface ExerciseStatsResponse {
  exercises: {
    exerciseType: string;       // 種目名
    sessionCount: number;       // セッション数
    uniqueUsers: number;        // ユニークユーザー数
    totalReps: number;          // 総レップ数
    avgScore: number;           // 平均スコア
    avgDuration: number;        // 平均トレーニング時間（秒）
    popularityRank: number;     // 人気ランキング
  }[];
  totalSessions: number;
  mostPopular: string;
  leastPopular: string;
}
```

#### 課金統計

```typescript
// リクエスト（クエリパラメータ）
interface RevenueStatsRequest {
  startDate: string;
  endDate: string;
}

// レスポンス
interface RevenueStatsResponse {
  currentMonth: {
    activeSubscriptions: number;
    newSubscriptions: number;
    canceledSubscriptions: number;
    mrr: number;
    churnRate: number;          // 解約率（%）
    arpu: number;               // ARPU（ユーザーあたり平均収益）
  };
  trial: {
    activeTrials: number;
    trialsStarted: number;
    trialsConverted: number;
    conversionRate: number;     // 転換率（%）
  };
  trend: {
    date: string;
    mrr: number;
    subscriptions: number;
  }[];
}
```

### 実装例

#### ダッシュボード概要API

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// キャッシュ（メモリ内キャッシュ、シンプルな実装）
let overviewCache: { data: OverviewResponse; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

/**
 * ダッシュボード概要取得API
 *
 * 主要KPIをまとめて取得します。
 * パフォーマンスのため、5分間キャッシュします。
 */
export const getOverview = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const now = Date.now();

        // キャッシュが有効なら返す
        if (overviewCache && overviewCache.expiresAt > now) {
          return res.json(overviewCache.data);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        // 各種集計を並列実行
        const [
          totalUsers,
          todayDau,
          yesterdayDau,
          thisMonthMau,
          lastMonthMau,
          newToday,
          newThisMonth,
          sessionsToday,
          sessionsYesterday,
          activeSubscriptions,
          trialUsers,
        ] = await Promise.all([
          countTotalUsers(),
          countDau(today),
          countDau(yesterday),
          countMau(thisMonthStart),
          countMau(lastMonthStart),
          countNewUsers(today, new Date()),
          countNewUsers(thisMonthStart, new Date()),
          countSessions(today, new Date()),
          countSessions(yesterday, today),
          countActiveSubscriptions(),
          countTrialUsers(),
        ]);

        // 変化率を計算
        const dauChange = yesterdayDau > 0
          ? ((todayDau - yesterdayDau) / yesterdayDau) * 100
          : 0;
        const mauChange = lastMonthMau > 0
          ? ((thisMonthMau - lastMonthMau) / lastMonthMau) * 100
          : 0;
        const sessionsChange = sessionsYesterday > 0
          ? ((sessionsToday - sessionsYesterday) / sessionsYesterday) * 100
          : 0;

        // 追加情報を取得
        const avgDuration = await getAvgSessionDuration(today);
        const topExercise = await getTopExercise(today);
        const mrr = activeSubscriptions * 500; // 月額500円

        const response: OverviewResponse = {
          date: today.toISOString().split("T")[0],
          users: {
            total: totalUsers,
            dau: todayDau,
            dauChange: Math.round(dauChange * 10) / 10,
            mau: thisMonthMau,
            mauChange: Math.round(mauChange * 10) / 10,
            newToday,
            newThisMonth,
          },
          training: {
            sessionsToday,
            sessionsChange: Math.round(sessionsChange * 10) / 10,
            avgDuration,
            topExercise,
          },
          revenue: {
            activeSubscriptions,
            mrr,
            mrrChange: 0, // 前月データとの比較は別途実装
            trialUsers,
            conversionRate: await calculateConversionRate(),
          },
          generatedAt: new Date().toISOString(),
          cacheExpiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
        };

        // キャッシュを更新
        overviewCache = {
          data: response,
          expiresAt: now + CACHE_TTL_MS,
        };

        // 監査ログ
        await logAdminAction({
          action: "VIEW_ANALYTICS_OVERVIEW",
          performedBy: req.adminUser.uid,
        });

        res.json(response);
      } catch (error) {
        logger.error("ダッシュボード取得エラー", { error });
        res.status(500).json({
          error: "統計情報の取得に失敗しました",
          code: "OVERVIEW_ERROR",
        });
      }
    });
  }
);

// ヘルパー関数

async function countTotalUsers(): Promise<number> {
  const snapshot = await admin.firestore()
    .collection("users")
    .count()
    .get();
  return snapshot.data().count;
}

async function countDau(date: Date): Promise<number> {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const snapshot = await admin.firestore()
    .collection("sessions")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(date))
    .where("startedAt", "<", admin.firestore.Timestamp.fromDate(nextDay))
    .get();

  // ユニークユーザーIDをカウント
  const uniqueUsers = new Set(snapshot.docs.map(doc => doc.data().userId));
  return uniqueUsers.size;
}

async function countMau(monthStart: Date): Promise<number> {
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const snapshot = await admin.firestore()
    .collection("sessions")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(monthStart))
    .where("startedAt", "<", admin.firestore.Timestamp.fromDate(nextMonth))
    .get();

  const uniqueUsers = new Set(snapshot.docs.map(doc => doc.data().userId));
  return uniqueUsers.size;
}

async function countNewUsers(start: Date, end: Date): Promise<number> {
  const snapshot = await admin.firestore()
    .collection("users")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("createdAt", "<", admin.firestore.Timestamp.fromDate(end))
    .count()
    .get();
  return snapshot.data().count;
}

async function countSessions(start: Date, end: Date): Promise<number> {
  const snapshot = await admin.firestore()
    .collection("sessions")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("startedAt", "<", admin.firestore.Timestamp.fromDate(end))
    .count()
    .get();
  return snapshot.data().count;
}

async function countActiveSubscriptions(): Promise<number> {
  const snapshot = await admin.firestore()
    .collection("users")
    .where("subscription.status", "==", "active")
    .count()
    .get();
  return snapshot.data().count;
}

async function countTrialUsers(): Promise<number> {
  const now = admin.firestore.Timestamp.now();
  const snapshot = await admin.firestore()
    .collection("users")
    .where("subscription.trialEnd", ">", now)
    .count()
    .get();
  return snapshot.data().count;
}

async function getAvgSessionDuration(date: Date): Promise<number> {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const snapshot = await admin.firestore()
    .collection("sessions")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(date))
    .where("startedAt", "<", admin.firestore.Timestamp.fromDate(nextDay))
    .select("duration")
    .get();

  if (snapshot.empty) return 0;

  const totalDuration = snapshot.docs.reduce(
    (sum, doc) => sum + (doc.data().duration || 0),
    0
  );
  return Math.round(totalDuration / snapshot.size);
}

async function getTopExercise(date: Date): Promise<string> {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const snapshot = await admin.firestore()
    .collection("sessions")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(date))
    .where("startedAt", "<", admin.firestore.Timestamp.fromDate(nextDay))
    .select("exerciseType")
    .get();

  if (snapshot.empty) return "なし";

  const counts: Record<string, number> = {};
  snapshot.docs.forEach(doc => {
    const type = doc.data().exerciseType;
    counts[type] = (counts[type] || 0) + 1;
  });

  const topExercise = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0];

  return topExercise ? topExercise[0] : "なし";
}

async function calculateConversionRate(): Promise<number> {
  // 過去30日以内にトライアル終了 → 課金したユーザーの割合
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trialEndedSnapshot = await admin.firestore()
    .collection("users")
    .where("subscription.trialEnd", "<=", admin.firestore.Timestamp.now())
    .where("subscription.trialEnd", ">=", admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get();

  if (trialEndedSnapshot.empty) return 0;

  const converted = trialEndedSnapshot.docs.filter(
    doc => doc.data().subscription?.status === "active"
  ).length;

  return Math.round((converted / trialEndedSnapshot.size) * 100);
}
```

### BigQuery連携（大規模データ用）

```sql
-- DAU取得クエリ（BigQuery）
SELECT
  DATE(started_at) as date,
  COUNT(DISTINCT user_id) as dau
FROM `tokyo-list-478804-e5.analytics.sessions`
WHERE started_at >= @start_date
  AND started_at < @end_date
GROUP BY date
ORDER BY date;

-- 種目別統計クエリ
SELECT
  exercise_type,
  COUNT(*) as session_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(score) as avg_score,
  AVG(duration) as avg_duration
FROM `tokyo-list-478804-e5.analytics.sessions`
WHERE started_at >= @start_date
  AND started_at < @end_date
GROUP BY exercise_type
ORDER BY session_count DESC;
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 大量データになった場合はBigQueryからの集計に切り替えることを検討
- リアルタイム性が必要ない指標は、日次バッチ処理で事前計算することを推奨
- ダッシュボードのレスポンス時間が3秒を超える場合は、キャッシュ時間の延長やクエリの最適化を行う

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
