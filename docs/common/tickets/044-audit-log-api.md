# 044 監査ログAPI

## 概要

システム内で行われた重要な操作を記録・検索するための監査ログAPIを実装するチケットです。セキュリティインシデントの調査、コンプライアンス対応、不正操作の検出に活用します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-ADM-007: 監査ログ検索 - 期間や条件で検索し、不正操作の有無を確認

### 非機能要件

- NFR-039: 監査ログ保存期間 - 2年以上保存

## 受け入れ条件（Todo）

### 監査ログ検索API

- [ ] 期間指定での監査ログ検索APIを実装
- [ ] 操作者（管理者ID）でのフィルタリングを実装
- [ ] 操作種別でのフィルタリングを実装
- [ ] 対象ユーザーでのフィルタリングを実装
- [ ] IPアドレスでのフィルタリングを実装
- [ ] ページネーションを実装

### ログエクスポートAPI

- [ ] 検索結果をCSV形式でエクスポートする機能を実装
- [ ] 検索結果をJSON形式でエクスポートする機能を実装
- [ ] 大量データのストリーミングエクスポートを実装
- [ ] エクスポート自体の監査ログ記録を実装

### ログ改ざん検知

- [ ] ログエントリのハッシュ値を計算・保存する機能を実装
- [ ] ハッシュチェーン（前のログのハッシュを含む）を実装
- [ ] 定期的な整合性チェック機能を実装
- [ ] 改ざん検知時のアラート機能を実装

### 監査ログ記録基盤

- [ ] 監査ログ記録用の共通関数を実装
- [ ] 自動的なメタデータ付与（タイムスタンプ、IPアドレス等）を実装
- [ ] 非同期でのログ書き込み（パフォーマンス対策）を実装

### テスト

- [ ] 監査ログ検索APIのユニットテストを作成
- [ ] ログエクスポートAPIのテストを作成
- [ ] 改ざん検知機能のテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-007（監査ログ検索）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-039（監査ログ保存期間）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| GET | `/admin/audit-logs` | 監査ログ検索 | admin以上 |
| GET | `/admin/audit-logs/:logId` | 監査ログ詳細 | admin以上 |
| POST | `/admin/audit-logs/export` | ログエクスポート | admin以上 |
| GET | `/admin/audit-logs/integrity` | 整合性チェック | superAdmin |

### 監査ログの種類

| カテゴリ | 操作種別 | 説明 |
|---------|---------|------|
| **認証** | ADMIN_LOGIN | 管理者ログイン |
| | ADMIN_LOGOUT | 管理者ログアウト |
| | LOGIN_FAILED | ログイン失敗 |
| | MFA_VERIFIED | MFA認証成功 |
| **ユーザー管理** | USER_VIEWED | ユーザー情報閲覧 |
| | USER_SUSPENDED | ユーザー停止 |
| | USER_RESTORED | ユーザー復帰 |
| | USER_DELETED | ユーザー削除 |
| **権限管理** | ROLE_CHANGED | ロール変更 |
| | PERMISSION_GRANTED | 権限付与 |
| | PERMISSION_REVOKED | 権限取消 |
| **データ操作** | DATA_EXPORTED | データエクスポート |
| | DATA_DELETED | データ削除 |
| | BULK_OPERATION | 一括操作 |
| **設定変更** | CONFIG_CHANGED | 設定変更 |
| | IP_ALLOWLIST_UPDATED | IP許可リスト更新 |
| **セキュリティ** | SUSPICIOUS_ACCESS | 不審なアクセス検知 |
| | UNAUTHORIZED_ACCESS | 権限外アクセス試行 |

### リクエスト/レスポンス形式

#### 監査ログ検索

```typescript
// リクエスト（クエリパラメータ）
interface SearchAuditLogsRequest {
  startDate: string;          // 開始日時（ISO 8601形式）
  endDate: string;            // 終了日時（ISO 8601形式）
  actionType?: string;        // 操作種別
  performedBy?: string;       // 操作者の管理者ID
  targetUser?: string;        // 対象ユーザーID
  ipAddress?: string;         // IPアドレス
  severity?: "info" | "warning" | "error" | "critical";
  limit?: number;             // 取得件数（デフォルト: 50、最大: 200）
  cursor?: string;            // ページネーションカーソル
}

// レスポンス
interface SearchAuditLogsResponse {
  logs: AuditLogEntry[];
  nextCursor?: string;
  totalCount: number;
}

interface AuditLogEntry {
  logId: string;
  timestamp: string;
  action: string;             // 操作種別
  category: string;           // カテゴリ
  severity: "info" | "warning" | "error" | "critical";
  performedBy: {
    userId: string;
    email: string;
    role: string;
  };
  targetUser?: {
    userId: string;
    email: string;
  };
  details: Record<string, unknown>;  // 操作の詳細
  previousState?: Record<string, unknown>;  // 変更前の状態
  newState?: Record<string, unknown>;       // 変更後の状態
  metadata: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  };
  hash: string;               // このログのハッシュ
  previousHash: string;       // 前のログのハッシュ（チェーン）
}
```

#### ログエクスポート

```typescript
// リクエスト
interface ExportAuditLogsRequest {
  startDate: string;
  endDate: string;
  format: "csv" | "json";
  filters?: {
    actionType?: string;
    performedBy?: string;
    severity?: string;
  };
}

// レスポンス（非同期ジョブ）
interface ExportAuditLogsResponse {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  downloadUrl?: string;       // 完了後に設定
  expiresAt?: string;         // ダウンロードURL有効期限
}
```

### 実装例

#### 監査ログ記録用共通関数

```typescript
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { logger } from "firebase-functions";

/**
 * 監査ログエントリの型定義
 */
interface AuditLogInput {
  action: string;
  category: string;
  severity?: "info" | "warning" | "error" | "critical";
  performedBy: string;
  targetUser?: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * 監査ログを記録する
 *
 * ハッシュチェーンを使用して改ざん検知を可能にします。
 * 非同期で書き込みを行い、メインの処理をブロックしません。
 */
export async function logAuditEvent(input: AuditLogInput): Promise<string> {
  try {
    const timestamp = admin.firestore.Timestamp.now();
    const logId = generateLogId(timestamp);

    // 前のログのハッシュを取得
    const previousHash = await getLastLogHash();

    // 操作者情報を取得
    const performerDoc = await admin.firestore()
      .collection("users")
      .doc(input.performedBy)
      .get();
    const performerData = performerDoc.data();

    // 対象ユーザー情報を取得（存在する場合）
    let targetUserData = null;
    if (input.targetUser) {
      const targetDoc = await admin.firestore()
        .collection("users")
        .doc(input.targetUser)
        .get();
      targetUserData = targetDoc.data();
    }

    // ログエントリを構築
    const logEntry = {
      logId,
      timestamp,
      action: input.action,
      category: input.category,
      severity: input.severity || "info",
      performedBy: {
        userId: input.performedBy,
        email: performerData?.email || "unknown",
        role: performerData?.role || "unknown",
      },
      targetUser: input.targetUser ? {
        userId: input.targetUser,
        email: targetUserData?.email || "unknown",
      } : null,
      details: input.details || {},
      previousState: input.previousState || null,
      newState: input.newState || null,
      metadata: {
        ipAddress: input.ipAddress || "unknown",
        userAgent: input.userAgent || "unknown",
        requestId: input.requestId || generateRequestId(),
      },
      previousHash,
      hash: "", // 後で計算
    };

    // ハッシュを計算
    logEntry.hash = calculateLogHash(logEntry);

    // Firestoreに保存
    await admin.firestore()
      .collection("auditLogs")
      .doc(logId)
      .set(logEntry);

    // 最新ハッシュを更新
    await admin.firestore()
      .collection("auditLogs")
      .doc("_metadata")
      .set({
        lastLogId: logId,
        lastHash: logEntry.hash,
        updatedAt: timestamp,
      });

    logger.info("監査ログを記録しました", { logId, action: input.action });

    return logId;
  } catch (error) {
    logger.error("監査ログの記録に失敗しました", { error, input });
    throw error;
  }
}

/**
 * ログIDを生成
 * 時系列順でソートしやすい形式
 */
function generateLogId(timestamp: admin.firestore.Timestamp): string {
  const date = timestamp.toDate();
  const dateStr = date.toISOString().replace(/[-:]/g, "").split(".")[0];
  const random = crypto.randomBytes(4).toString("hex");
  return `${dateStr}_${random}`;
}

/**
 * ログエントリのハッシュを計算
 */
function calculateLogHash(logEntry: Omit<typeof logEntry, "hash">): string {
  const dataToHash = JSON.stringify({
    logId: logEntry.logId,
    timestamp: logEntry.timestamp.toMillis(),
    action: logEntry.action,
    performedBy: logEntry.performedBy.userId,
    targetUser: logEntry.targetUser?.userId,
    details: logEntry.details,
    previousHash: logEntry.previousHash,
  });

  return crypto
    .createHash("sha256")
    .update(dataToHash)
    .digest("hex");
}

/**
 * 最後のログのハッシュを取得
 */
async function getLastLogHash(): Promise<string> {
  const metadataDoc = await admin.firestore()
    .collection("auditLogs")
    .doc("_metadata")
    .get();

  if (!metadataDoc.exists) {
    return "genesis"; // 最初のログ
  }

  return metadataDoc.data()?.lastHash || "genesis";
}

function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}
```

#### 監査ログ検索API

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import * as admin from "firebase-admin";

/**
 * 監査ログ検索API
 *
 * 期間や条件を指定して監査ログを検索します。
 */
export const searchAuditLogs = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          startDate,
          endDate,
          actionType,
          performedBy,
          targetUser,
          ipAddress,
          severity,
          limit = 50,
          cursor,
        } = req.query;

        // 入力チェック
        if (!startDate || !endDate) {
          return res.status(400).json({
            error: "開始日と終了日を指定してください",
            code: "DATE_REQUIRED",
          });
        }

        const limitNum = Math.min(Number(limit), 200);

        // クエリを構築
        let query = admin.firestore()
          .collection("auditLogs")
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(new Date(startDate as string)))
          .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(new Date(endDate as string)))
          .orderBy("timestamp", "desc")
          .limit(limitNum + 1);

        // フィルタリング
        if (actionType) {
          query = query.where("action", "==", actionType);
        }
        if (performedBy) {
          query = query.where("performedBy.userId", "==", performedBy);
        }
        if (targetUser) {
          query = query.where("targetUser.userId", "==", targetUser);
        }
        if (severity) {
          query = query.where("severity", "==", severity);
        }

        // カーソルがある場合
        if (cursor) {
          const cursorDoc = await admin.firestore()
            .collection("auditLogs")
            .doc(cursor as string)
            .get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }

        const snapshot = await query.get();
        const docs = snapshot.docs.slice(0, limitNum);

        const logs = docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.timestamp.toDate().toISOString(),
          };
        });

        // IPアドレスフィルター（クライアント側でフィルタリング）
        const filteredLogs = ipAddress
          ? logs.filter(log => log.metadata.ipAddress === ipAddress)
          : logs;

        const hasNextPage = snapshot.docs.length > limitNum;
        const nextCursor = hasNextPage ? docs[docs.length - 1].id : undefined;

        // この検索操作自体も記録
        await logAuditEvent({
          action: "AUDIT_LOG_SEARCHED",
          category: "AUDIT",
          performedBy: req.adminUser.uid,
          details: {
            startDate,
            endDate,
            actionType,
            resultCount: filteredLogs.length,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({
          logs: filteredLogs,
          nextCursor,
          totalCount: filteredLogs.length,
        });
      } catch (error) {
        logger.error("監査ログ検索エラー", { error });
        res.status(500).json({
          error: "監査ログの検索に失敗しました",
          code: "SEARCH_AUDIT_LOGS_ERROR",
        });
      }
    });
  }
);
```

#### 整合性チェックAPI

```typescript
/**
 * 監査ログの整合性をチェックするAPI
 *
 * ハッシュチェーンを検証し、改ざんがないか確認します。
 * superAdminのみ実行可能です。
 */
export const checkIntegrity = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("superAdmin")(req, res, async () => {
      try {
        const { startDate, endDate } = req.query;

        let query = admin.firestore()
          .collection("auditLogs")
          .orderBy("timestamp", "asc");

        if (startDate) {
          query = query.where(
            "timestamp",
            ">=",
            admin.firestore.Timestamp.fromDate(new Date(startDate as string))
          );
        }
        if (endDate) {
          query = query.where(
            "timestamp",
            "<=",
            admin.firestore.Timestamp.fromDate(new Date(endDate as string))
          );
        }

        const snapshot = await query.get();
        const logs = snapshot.docs.filter(doc => doc.id !== "_metadata");

        let previousHash = "genesis";
        const issues: { logId: string; issue: string }[] = [];

        for (const doc of logs) {
          const data = doc.data();

          // 前のハッシュをチェック
          if (data.previousHash !== previousHash) {
            issues.push({
              logId: doc.id,
              issue: `前のハッシュが一致しません。期待値: ${previousHash}, 実際: ${data.previousHash}`,
            });
          }

          // このログのハッシュを再計算して検証
          const recalculatedHash = calculateLogHash({
            logId: data.logId,
            timestamp: data.timestamp,
            action: data.action,
            performedBy: data.performedBy,
            targetUser: data.targetUser,
            details: data.details,
            previousState: data.previousState,
            newState: data.newState,
            metadata: data.metadata,
            previousHash: data.previousHash,
          });

          if (recalculatedHash !== data.hash) {
            issues.push({
              logId: doc.id,
              issue: `ハッシュが一致しません。改ざんの可能性があります。`,
            });
          }

          previousHash = data.hash;
        }

        // 整合性チェック自体も記録
        await logAuditEvent({
          action: "INTEGRITY_CHECK",
          category: "SECURITY",
          severity: issues.length > 0 ? "critical" : "info",
          performedBy: req.adminUser.uid,
          details: {
            logsChecked: logs.length,
            issuesFound: issues.length,
          },
          ipAddress: req.ip,
        });

        // 問題が見つかった場合はアラートを送信
        if (issues.length > 0) {
          await sendSecurityAlert({
            type: "AUDIT_LOG_TAMPERING_DETECTED",
            details: issues,
          });
        }

        res.json({
          success: issues.length === 0,
          logsChecked: logs.length,
          issuesFound: issues.length,
          issues: issues,
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("整合性チェックエラー", { error });
        res.status(500).json({
          error: "整合性チェックに失敗しました",
          code: "INTEGRITY_CHECK_ERROR",
        });
      }
    });
  }
);
```

### Firestoreセキュリティルール

```javascript
// 監査ログへのアクセス制御
match /auditLogs/{logId} {
  // クライアントからの読み書きは禁止
  // Cloud Functionsからのみアクセス可能
  allow read, write: if false;
}
```

## 見積もり

- 工数: 4日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 監査ログは法的要件により2年以上保存が必要
- BigQueryへの定期的なエクスポートを検討（長期保存・大量データ分析用）
- 改ざん検知のハッシュチェーンは、システムの信頼性を担保する重要な機能
- 整合性チェックは定期的（例: 週次）に自動実行することを推奨

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
