# 042 ユーザー管理API

## 概要

管理者がユーザーアカウントを管理するためのAPIを実装するチケットです。ユーザー一覧の取得、検索、アカウント状態の変更（停止/復帰）などの機能を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-ADM-001: ユーザーアカウント管理 - ユーザー一覧を確認し、状態を変更できる
- FR-ADM-008: 端末情報管理 - ユーザーの端末情報も確認できる

### 非機能要件

- NFR-042: 管理画面レスポンス - 3秒以内に応答

## 受け入れ条件（Todo）

### ユーザー一覧取得API

- [ ] ページネーション付きユーザー一覧取得APIを実装
- [ ] 1ページあたりの取得件数を設定可能にする（デフォルト: 20件、最大: 100件）
- [ ] カーソルベースのページネーションを実装
- [ ] 並び替え機能を実装（作成日時、最終ログイン日時、ユーザー名）
- [ ] フィルタリング機能を実装（ステータス、プラン種別、作成日時範囲）

### ユーザー検索API

- [ ] ユーザーID（完全一致）での検索機能を実装
- [ ] メールアドレス（部分一致）での検索機能を実装
- [ ] 表示名（部分一致）での検索機能を実装
- [ ] 複数条件でのAND検索を実装
- [ ] 検索結果のページネーションを実装

### ユーザー詳細取得API

- [ ] 指定ユーザーの詳細情報取得APIを実装
- [ ] プロフィール情報の取得
- [ ] サブスクリプション状態の取得
- [ ] 最近のトレーニング履歴概要の取得
- [ ] 端末情報の取得

### ユーザー停止/復帰API

- [ ] ユーザーアカウント停止APIを実装
- [ ] 停止理由の記録機能を実装
- [ ] ユーザーアカウント復帰APIを実装
- [ ] 復帰理由の記録機能を実装
- [ ] 停止/復帰時のメール通知機能を実装

### 監査ログ記録

- [ ] すべての管理操作を監査ログに記録
- [ ] 操作者、対象ユーザー、操作内容、日時を記録
- [ ] 変更前後の状態を記録

### テスト

- [ ] ユーザー一覧取得APIのユニットテストを作成
- [ ] ユーザー検索APIのユニットテストを作成
- [ ] ユーザー停止/復帰APIのユニットテストを作成
- [ ] 権限チェックのテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-001（ユーザーアカウント管理）
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API設計方針
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| GET | `/admin/users` | ユーザー一覧取得 | admin以上 |
| GET | `/admin/users/search` | ユーザー検索 | admin以上 |
| GET | `/admin/users/:userId` | ユーザー詳細取得 | admin以上 |
| POST | `/admin/users/:userId/suspend` | ユーザー停止 | admin以上 |
| POST | `/admin/users/:userId/restore` | ユーザー復帰 | admin以上 |

### リクエスト/レスポンス形式

#### ユーザー一覧取得

```typescript
// リクエスト（クエリパラメータ）
interface ListUsersRequest {
  limit?: number;           // 取得件数（デフォルト: 20、最大: 100）
  cursor?: string;          // ページネーションカーソル
  sortBy?: "createdAt" | "lastLoginAt" | "displayName";
  sortOrder?: "asc" | "desc";
  status?: "active" | "suspended" | "deletionScheduled";
  plan?: "free" | "premium";
  createdAfter?: string;    // ISO 8601形式
  createdBefore?: string;   // ISO 8601形式
}

// レスポンス
interface ListUsersResponse {
  users: AdminUserSummary[];
  nextCursor?: string;      // 次ページがある場合のみ
  totalCount: number;       // 条件に一致する総件数
}

interface AdminUserSummary {
  userId: string;
  email: string;
  displayName: string | null;
  status: "active" | "suspended" | "deletionScheduled";
  plan: "free" | "premium";
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;     // 総トレーニング回数
}
```

#### ユーザー検索

```typescript
// リクエスト（クエリパラメータ）
interface SearchUsersRequest {
  userId?: string;          // 完全一致
  email?: string;           // 部分一致
  displayName?: string;     // 部分一致
  limit?: number;
  cursor?: string;
}

// レスポンス（ListUsersResponseと同形式）
```

#### ユーザー詳細取得

```typescript
// レスポンス
interface AdminUserDetail {
  userId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  status: "active" | "suspended" | "deletionScheduled";
  suspendedAt?: string;
  suspendReason?: string;
  deletionScheduledAt?: string;

  // プロフィール情報
  profile: {
    gender: string | null;
    birthDate: string | null;
    experienceLevel: string | null;
    goal: string | null;
    height: number | null;
    weight: number | null;
  };

  // サブスクリプション情報
  subscription: {
    plan: "free" | "premium";
    status: "active" | "canceled" | "past_due" | null;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
  };

  // トレーニング概要
  trainingSummary: {
    totalSessions: number;
    totalDuration: number;  // 秒
    lastSessionAt: string | null;
    favoriteExercise: string | null;
  };

  // 端末情報
  devices: {
    platform: "ios" | "android";
    osVersion: string;
    appVersion: string;
    lastUsedAt: string;
  }[];

  // メタデータ
  createdAt: string;
  lastLoginAt: string | null;
  tosAcceptedAt: string;
  ppAcceptedAt: string;
}
```

#### ユーザー停止

```typescript
// リクエスト
interface SuspendUserRequest {
  reason: string;           // 停止理由（必須）
  notifyUser: boolean;      // ユーザーに通知するか（デフォルト: true）
}

// レスポンス
interface SuspendUserResponse {
  success: boolean;
  userId: string;
  suspendedAt: string;
}
```

### 実装例

#### ユーザー一覧取得API

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * 管理者用ユーザー一覧取得API
 *
 * ページネーション付きでユーザー一覧を取得します。
 * admin以上のロールが必要です。
 */
export const listUsers = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    // 管理者認証チェック
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          limit = 20,
          cursor,
          sortBy = "createdAt",
          sortOrder = "desc",
          status,
          plan,
          createdAfter,
          createdBefore,
        } = req.query;

        // 取得件数の上限チェック
        const limitNum = Math.min(Number(limit), 100);

        // クエリを構築
        let query = admin.firestore()
          .collection("users")
          .orderBy(sortBy as string, sortOrder as "asc" | "desc")
          .limit(limitNum + 1); // 次ページ判定のため+1

        // カーソルがある場合は続きから取得
        if (cursor) {
          const cursorDoc = await admin.firestore()
            .collection("users")
            .doc(cursor)
            .get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }

        // フィルタリング
        if (status) {
          query = query.where("status", "==", status);
        }
        if (plan) {
          query = query.where("subscription.plan", "==", plan);
        }

        // クエリ実行
        const snapshot = await query.get();

        // ユーザー一覧を変換
        const users: AdminUserSummary[] = [];
        const docs = snapshot.docs.slice(0, limitNum);

        for (const doc of docs) {
          const data = doc.data();
          users.push({
            userId: doc.id,
            email: data.email,
            displayName: data.displayName || null,
            status: data.deletionScheduled ? "deletionScheduled" :
                    data.suspended ? "suspended" : "active",
            plan: data.subscription?.plan || "free",
            createdAt: data.createdAt?.toDate().toISOString(),
            lastLoginAt: data.lastLoginAt?.toDate().toISOString() || null,
            sessionCount: data.sessionCount || 0,
          });
        }

        // 次ページの有無を判定
        const hasNextPage = snapshot.docs.length > limitNum;
        const nextCursor = hasNextPage ? docs[docs.length - 1].id : undefined;

        // 総件数を取得（パフォーマンス考慮で概算）
        // 正確な件数が必要な場合はカウンタードキュメントを別途管理
        const countSnapshot = await admin.firestore()
          .collection("users")
          .count()
          .get();
        const totalCount = countSnapshot.data().count;

        // 監査ログに記録
        await logAdminAction({
          action: "LIST_USERS",
          performedBy: req.adminUser.uid,
          details: { limit: limitNum, filters: { status, plan } },
        });

        res.json({
          users,
          nextCursor,
          totalCount,
        });
      } catch (error) {
        logger.error("ユーザー一覧取得エラー", { error });
        res.status(500).json({
          error: "ユーザー一覧の取得に失敗しました",
          code: "LIST_USERS_ERROR",
        });
      }
    });
  }
);
```

#### ユーザー停止API

```typescript
/**
 * ユーザーアカウント停止API
 *
 * 指定したユーザーのアカウントを停止します。
 * admin以上のロールが必要です。
 */
export const suspendUser = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const { userId } = req.params;
        const { reason, notifyUser = true } = req.body;

        // 入力チェック
        if (!reason || reason.trim().length === 0) {
          return res.status(400).json({
            error: "停止理由を入力してください",
            code: "REASON_REQUIRED",
          });
        }

        // ユーザーの存在確認
        const userRef = admin.firestore().collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return res.status(404).json({
            error: "ユーザーが見つかりません",
            code: "USER_NOT_FOUND",
          });
        }

        const userData = userDoc.data();

        // すでに停止中かチェック
        if (userData.suspended) {
          return res.status(400).json({
            error: "このユーザーはすでに停止中です",
            code: "ALREADY_SUSPENDED",
          });
        }

        // ユーザーを停止
        const suspendedAt = admin.firestore.Timestamp.now();
        await userRef.update({
          suspended: true,
          suspendedAt: suspendedAt,
          suspendReason: reason,
          suspendedBy: req.adminUser.uid,
        });

        // Firebase Authのユーザーも無効化
        await admin.auth().updateUser(userId, {
          disabled: true,
        });

        // 監査ログに記録
        await logAdminAction({
          action: "SUSPEND_USER",
          performedBy: req.adminUser.uid,
          targetUser: userId,
          details: { reason, notifyUser },
          previousState: { suspended: false },
          newState: { suspended: true, suspendReason: reason },
        });

        // ユーザーに通知
        if (notifyUser && userData.email) {
          await sendSuspensionNotificationEmail({
            email: userData.email,
            displayName: userData.displayName,
            reason: reason,
          });
        }

        logger.info("ユーザーを停止しました", {
          userId,
          adminId: req.adminUser.uid,
        });

        res.json({
          success: true,
          userId,
          suspendedAt: suspendedAt.toDate().toISOString(),
        });
      } catch (error) {
        logger.error("ユーザー停止エラー", { error });
        res.status(500).json({
          error: "ユーザーの停止に失敗しました",
          code: "SUSPEND_USER_ERROR",
        });
      }
    });
  }
);
```

### Firestoreインデックス

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subscription.plan", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 見積もり

- 工数: 4日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-11

## 備考

- ユーザー検索はFirestoreの制限により、部分一致検索の実装に工夫が必要
- 大量データの場合はAlgoliaなどの全文検索サービスの導入を検討
- 停止ユーザーのセッション無効化も合わせて実装する

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了（ユーザー一覧、詳細、停止/復帰、検索API） |
