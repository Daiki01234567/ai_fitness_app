# 046 管理者通知API

## 概要

管理者がユーザーに対してプッシュ通知を送信するためのAPIを実装するチケットです。一斉通知、セグメント配信（特定の条件に合うユーザーへの配信）、通知履歴の管理機能を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤
- 018: GDPR データ削除リクエスト API（通知設定への参照）

## 要件

### 機能要件

- FR-ADM-005: 通知管理 - 通知履歴を参照し、条件に応じて再送を指示できる
- FR-017: リマインダー通知 - ユーザーへのプッシュ通知送信

### 非機能要件

- NFR-042: 管理画面レスポンス - 3秒以内に応答

## 受け入れ条件（Todo）

### 一斉通知送信API

- [ ] 全ユーザーへの一斉通知送信APIを実装
- [ ] 通知内容（タイトル、本文、画像、リンク）の設定機能を実装
- [ ] 送信確認（プレビュー）機能を実装
- [ ] 送信スケジュール機能を実装
- [ ] 送信進捗のトラッキング機能を実装

### セグメント配信API

- [ ] ユーザー属性によるセグメント定義機能を実装
  - プラン種別（無料/有料）
  - 最終ログイン日
  - トレーニング頻度
  - 登録日からの経過日数
- [ ] セグメントの保存・再利用機能を実装
- [ ] セグメント対象ユーザー数のプレビュー機能を実装
- [ ] セグメント配信APIを実装

### 通知履歴API

- [ ] 送信済み通知の一覧取得APIを実装
- [ ] 通知詳細（送信数、開封率など）取得APIを実装
- [ ] 通知の再送機能を実装
- [ ] 失敗した通知のリトライ機能を実装

### 通知テンプレート

- [ ] 通知テンプレートの作成APIを実装
- [ ] 通知テンプレートの一覧・編集・削除APIを実装
- [ ] テンプレート変数の置換機能を実装

### テスト

- [ ] 通知送信APIのユニットテストを作成
- [ ] セグメント条件のテストを作成
- [ ] テンプレート置換のテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-005（通知管理）
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API設計方針

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| POST | `/admin/notifications/send` | 通知送信 | admin以上 |
| POST | `/admin/notifications/send-segment` | セグメント配信 | admin以上 |
| POST | `/admin/notifications/schedule` | 通知予約 | admin以上 |
| GET | `/admin/notifications/history` | 通知履歴 | admin以上 |
| GET | `/admin/notifications/:id` | 通知詳細 | admin以上 |
| POST | `/admin/notifications/:id/resend` | 通知再送 | admin以上 |
| GET | `/admin/segments` | セグメント一覧 | admin以上 |
| POST | `/admin/segments` | セグメント作成 | admin以上 |
| POST | `/admin/segments/preview` | セグメントプレビュー | admin以上 |
| GET | `/admin/notification-templates` | テンプレート一覧 | admin以上 |
| POST | `/admin/notification-templates` | テンプレート作成 | admin以上 |

### データ構造

#### 通知履歴（NotificationHistory）

```typescript
interface NotificationHistory {
  id: string;
  type: "broadcast" | "segment" | "individual";
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;  // カスタムデータ
  segment?: {
    id: string;
    name: string;
    conditions: SegmentCondition[];
  };
  status: "pending" | "sending" | "completed" | "failed" | "cancelled";
  scheduledAt?: Timestamp;
  sentAt?: Timestamp;
  completedAt?: Timestamp;
  stats: {
    targetCount: number;      // 送信対象数
    sentCount: number;        // 送信成功数
    failedCount: number;      // 送信失敗数
    openedCount: number;      // 開封数
    clickedCount: number;     // クリック数
  };
  createdAt: Timestamp;
  createdBy: string;
}
```

#### セグメント定義

```typescript
interface Segment {
  id: string;
  name: string;
  description: string;
  conditions: SegmentCondition[];
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

interface SegmentCondition {
  field: string;              // 条件フィールド
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "notIn";
  value: string | number | boolean | string[];
}

// 利用可能なフィールド
type SegmentField =
  | "subscription.plan"       // プラン種別
  | "subscription.status"     // サブスクリプション状態
  | "lastLoginAt"             // 最終ログイン日時
  | "createdAt"               // 登録日時
  | "sessionCount"            // トレーニング回数
  | "lastSessionAt"           // 最終トレーニング日時
  | "profile.experienceLevel" // 運動経験レベル
  | "settings.notificationsEnabled"; // 通知設定
```

#### 通知テンプレート

```typescript
interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  title: string;              // {{username}}などの変数を含む
  body: string;
  imageUrl?: string;
  variables: string[];        // 使用している変数一覧
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
```

### リクエスト/レスポンス形式

#### 通知送信

```typescript
// リクエスト
interface SendNotificationRequest {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  targetType: "all" | "segment" | "users";
  segmentId?: string;         // targetType=segmentの場合
  userIds?: string[];         // targetType=usersの場合
  dryRun?: boolean;           // テスト送信（実際には送信しない）
}

// レスポンス
interface SendNotificationResponse {
  notificationId: string;
  status: "pending" | "sending";
  targetCount: number;
  estimatedCompletionTime: string;
}
```

#### セグメントプレビュー

```typescript
// リクエスト
interface SegmentPreviewRequest {
  conditions: SegmentCondition[];
}

// レスポンス
interface SegmentPreviewResponse {
  matchedCount: number;
  sampleUsers: {
    userId: string;
    email: string;
    displayName: string;
  }[];  // 最大10件
}
```

### 実装例

#### 通知送信API

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import { logAuditEvent } from "../utils/auditLog";
import * as admin from "firebase-admin";

/**
 * 通知送信API
 *
 * 指定した対象にプッシュ通知を送信します。
 * admin以上のロールが必要です。
 */
export const sendNotification = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          title,
          body,
          imageUrl,
          data,
          targetType,
          segmentId,
          userIds,
          dryRun = false,
        } = req.body;

        // 入力チェック
        if (!title || !body) {
          return res.status(400).json({
            error: "タイトルと本文を入力してください",
            code: "TITLE_BODY_REQUIRED",
          });
        }

        // 送信対象のユーザーIDリストを取得
        let targetUserIds: string[] = [];

        if (targetType === "all") {
          // 全ユーザー（通知有効かつ削除予定でないユーザー）
          const usersSnapshot = await admin.firestore()
            .collection("users")
            .where("settings.notificationsEnabled", "==", true)
            .where("deletionScheduled", "==", false)
            .get();
          targetUserIds = usersSnapshot.docs.map(doc => doc.id);
        } else if (targetType === "segment" && segmentId) {
          // セグメント対象ユーザー
          targetUserIds = await getSegmentUserIds(segmentId);
        } else if (targetType === "users" && userIds) {
          // 指定ユーザー
          targetUserIds = userIds;
        } else {
          return res.status(400).json({
            error: "送信対象を正しく指定してください",
            code: "INVALID_TARGET",
          });
        }

        // 対象が0人の場合
        if (targetUserIds.length === 0) {
          return res.status(400).json({
            error: "送信対象のユーザーが見つかりません",
            code: "NO_TARGET_USERS",
          });
        }

        const now = admin.firestore.Timestamp.now();
        const notificationId = admin.firestore()
          .collection("notificationHistory")
          .doc().id;

        // 通知履歴を作成
        const notificationHistory = {
          id: notificationId,
          type: targetType === "all" ? "broadcast" :
                targetType === "segment" ? "segment" : "individual",
          title,
          body,
          imageUrl: imageUrl || null,
          data: data || {},
          segment: segmentId ? await getSegmentInfo(segmentId) : null,
          status: dryRun ? "completed" : "pending",
          stats: {
            targetCount: targetUserIds.length,
            sentCount: 0,
            failedCount: 0,
            openedCount: 0,
            clickedCount: 0,
          },
          createdAt: now,
          createdBy: req.adminUser.uid,
        };

        await admin.firestore()
          .collection("notificationHistory")
          .doc(notificationId)
          .set(notificationHistory);

        // テスト送信の場合はここで終了
        if (dryRun) {
          logger.info("通知テスト送信（dryRun）", {
            notificationId,
            targetCount: targetUserIds.length,
          });

          return res.json({
            notificationId,
            status: "completed",
            targetCount: targetUserIds.length,
            message: "テスト送信が完了しました（実際には送信されていません）",
          });
        }

        // 非同期で通知を送信（Cloud Tasksを使用）
        await enqueueNotificationTask({
          notificationId,
          targetUserIds,
          title,
          body,
          imageUrl,
          data,
        });

        // 監査ログ
        await logAuditEvent({
          action: "NOTIFICATION_SENT",
          category: "NOTIFICATION",
          performedBy: req.adminUser.uid,
          details: {
            notificationId,
            targetType,
            targetCount: targetUserIds.length,
            title,
          },
          ipAddress: req.ip,
        });

        res.json({
          notificationId,
          status: "sending",
          targetCount: targetUserIds.length,
          estimatedCompletionTime: estimateCompletionTime(targetUserIds.length),
        });
      } catch (error) {
        logger.error("通知送信エラー", { error });
        res.status(500).json({
          error: "通知の送信に失敗しました",
          code: "SEND_NOTIFICATION_ERROR",
        });
      }
    });
  }
);

/**
 * FCMで通知を送信する（バッチ処理）
 */
async function sendFcmNotifications(
  notificationId: string,
  userIds: string[],
  notification: { title: string; body: string; imageUrl?: string },
  data?: Record<string, string>
): Promise<{ success: number; failure: number }> {
  const BATCH_SIZE = 500; // FCMの最大バッチサイズ
  let successCount = 0;
  let failureCount = 0;

  // ユーザーIDからFCMトークンを取得
  const tokenMap = await getFcmTokens(userIds);

  const tokens = Object.values(tokenMap).flat();

  // バッチに分割して送信
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...data,
        notificationId,
      },
      tokens: batchTokens,
      android: {
        priority: "high",
        notification: {
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      // 無効なトークンを削除
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === "messaging/unregistered") {
          removeInvalidToken(batchTokens[idx]);
        }
      });
    } catch (error) {
      logger.error("FCMバッチ送信エラー", { error, batchIndex: i });
      failureCount += batchTokens.length;
    }

    // 進捗を更新
    await admin.firestore()
      .collection("notificationHistory")
      .doc(notificationId)
      .update({
        "stats.sentCount": successCount,
        "stats.failedCount": failureCount,
      });
  }

  return { success: successCount, failure: failureCount };
}
```

#### セグメントプレビューAPI

```typescript
/**
 * セグメントプレビューAPI
 *
 * 指定した条件に一致するユーザー数を取得します。
 */
export const previewSegment = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const { conditions } = req.body;

        if (!conditions || conditions.length === 0) {
          return res.status(400).json({
            error: "条件を指定してください",
            code: "CONDITIONS_REQUIRED",
          });
        }

        // クエリを構築
        let query: admin.firestore.Query = admin.firestore()
          .collection("users")
          .where("deletionScheduled", "==", false);

        // 各条件を適用
        for (const condition of conditions) {
          query = applyCondition(query, condition);
        }

        // 件数を取得
        const countSnapshot = await query.count().get();
        const matchedCount = countSnapshot.data().count;

        // サンプルユーザーを取得（最大10件）
        const sampleSnapshot = await query.limit(10).get();
        const sampleUsers = sampleSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            userId: doc.id,
            email: maskEmail(data.email),  // メールアドレスをマスク
            displayName: data.displayName || "(未設定)",
          };
        });

        res.json({
          matchedCount,
          sampleUsers,
        });
      } catch (error) {
        logger.error("セグメントプレビューエラー", { error });
        res.status(500).json({
          error: "セグメントプレビューに失敗しました",
          code: "PREVIEW_SEGMENT_ERROR",
        });
      }
    });
  }
);

/**
 * 条件をFirestoreクエリに適用
 */
function applyCondition(
  query: admin.firestore.Query,
  condition: SegmentCondition
): admin.firestore.Query {
  const { field, operator, value } = condition;

  switch (operator) {
    case "eq":
      return query.where(field, "==", value);
    case "neq":
      return query.where(field, "!=", value);
    case "gt":
      return query.where(field, ">", value);
    case "gte":
      return query.where(field, ">=", value);
    case "lt":
      return query.where(field, "<", value);
    case "lte":
      return query.where(field, "<=", value);
    case "in":
      return query.where(field, "in", value);
    case "notIn":
      return query.where(field, "not-in", value);
    default:
      return query;
  }
}

/**
 * メールアドレスをマスク
 * example@gmail.com → exa***@gmail.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.substring(0, 3)}***@${domain}`;
}
```

#### 通知スケジュールAPI

```typescript
/**
 * 通知スケジュールAPI
 *
 * 指定日時に通知を送信するようスケジュールします。
 */
export const scheduleNotification = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          title,
          body,
          imageUrl,
          data,
          targetType,
          segmentId,
          scheduledAt,
        } = req.body;

        // 入力チェック
        if (!scheduledAt) {
          return res.status(400).json({
            error: "スケジュール日時を指定してください",
            code: "SCHEDULED_AT_REQUIRED",
          });
        }

        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
          return res.status(400).json({
            error: "スケジュール日時は未来の日時を指定してください",
            code: "INVALID_SCHEDULED_AT",
          });
        }

        const now = admin.firestore.Timestamp.now();
        const notificationId = admin.firestore()
          .collection("notificationHistory")
          .doc().id;

        // 通知履歴を作成（スケジュール状態）
        const notificationHistory = {
          id: notificationId,
          type: targetType === "all" ? "broadcast" : "segment",
          title,
          body,
          imageUrl: imageUrl || null,
          data: data || {},
          segment: segmentId ? await getSegmentInfo(segmentId) : null,
          status: "pending",
          scheduledAt: admin.firestore.Timestamp.fromDate(scheduledDate),
          stats: {
            targetCount: 0,  // 送信時に計算
            sentCount: 0,
            failedCount: 0,
            openedCount: 0,
            clickedCount: 0,
          },
          createdAt: now,
          createdBy: req.adminUser.uid,
        };

        await admin.firestore()
          .collection("notificationHistory")
          .doc(notificationId)
          .set(notificationHistory);

        // Cloud Schedulerでスケジュール
        await scheduleNotificationTask({
          notificationId,
          scheduledAt: scheduledDate,
        });

        // 監査ログ
        await logAuditEvent({
          action: "NOTIFICATION_SCHEDULED",
          category: "NOTIFICATION",
          performedBy: req.adminUser.uid,
          details: {
            notificationId,
            targetType,
            scheduledAt,
            title,
          },
          ipAddress: req.ip,
        });

        res.json({
          notificationId,
          status: "scheduled",
          scheduledAt: scheduledDate.toISOString(),
        });
      } catch (error) {
        logger.error("通知スケジュールエラー", { error });
        res.status(500).json({
          error: "通知のスケジュールに失敗しました",
          code: "SCHEDULE_NOTIFICATION_ERROR",
        });
      }
    });
  }
);
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- FCMの送信制限に注意（1リクエストあたり500デバイスまで）
- 大量送信時はCloud Tasksでキューイングして負荷分散
- 通知設定がOFFのユーザーには送信しない
- 削除予定ユーザーには送信しない
- 開封率の計測にはアプリ側での対応が必要

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
