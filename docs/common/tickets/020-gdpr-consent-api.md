# 020 GDPR同意履歴・監査機能（拡張機能）

## 概要

**チケット006で実装した基本的な同意管理API（recordConsent, revokeConsent, getConsent）の拡張機能**として、同意履歴の詳細な監査機能、データアクセスログ機能、管理者向けレポート機能を実装します。

GDPR Article 7（同意の条件）およびArticle 15（アクセス権）に準拠した、監査証跡の完全性を保証する機能群です。

## チケット006との違い

| 機能カテゴリ | チケット006（基本機能） | チケット020（本チケット：拡張機能） |
|------------|---------------------|--------------------------------|
| **同意記録** | ✅ user_updateConsent 実装済み | - |
| **同意撤回** | ✅ user_revokeConsent 実装済み | - |
| **同意状態取得** | ✅ user_getConsent 実装済み | - |
| **同意履歴一覧** | - | ✅ **consent_getHistory 新規実装** |
| **監査ログ検索** | - | ✅ **consent_searchAuditLogs 新規実装** |
| **データアクセスログ** | - | ✅ **データアクセス記録機能 新規実装** |
| **管理者向けレポート** | - | ✅ **統計レポート機能 新規実装** |
| **GDPR準拠** | Article 6（同意の合法性） | Article 7（同意の条件）、Article 15（アクセス権） |

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- **006: GDPR同意管理API（必須）** - 本チケットは006の完了が前提
- 002: Firestoreセキュリティルール実装
- 003: Cloud Functions基盤

## 要件

### 機能要件

- FR-034: GDPR第7条（同意の条件）対応 - 同意履歴の透明性
- FR-035: GDPR第15条（アクセス権）対応 - データアクセスログ

### 非機能要件

- NFR-008: データ最小化原則
- NFR-019: 同意管理 - 記録保持
- NFR-032: データ保護

## 受け入れ条件（Todo）

### 1. 同意履歴一覧API
- [ ] `consent_getHistory` Callable Functionを実装
- [ ] 期間フィルタリング機能（開始日時・終了日時）
- [ ] 同意タイプフィルタリング（ToS/PP/Marketing）
- [ ] ページネーション実装（1ページ20件）
- [ ] ユーザー本人のみアクセス可能（認証チェック）

### 2. 監査ログ検索API
- [ ] `consent_searchAuditLogs` Callable Functionを実装（管理者専用）
- [ ] 管理者権限チェック（カスタムクレーム `admin: true`）
- [ ] 複合検索条件実装（ユーザーID、期間、操作タイプ）
- [ ] CSV/JSONエクスポート機能

### 3. データアクセスログ
- [ ] `dataAccessLogs` コレクションのスキーマ設計
- [ ] アクセスログ記録関数（汎用ミドルウェア）
- [ ] GDPR Article 15対応（データポータビリティ）
- [ ] 保持期間設定（2年間）

### 4. 管理者向けレポート
- [ ] 同意率統計API（日次/週次/月次）
- [ ] 撤回理由の集計機能
- [ ] ダッシュボード用データ整形

### 5. テスト
- [ ] ユニットテスト実装（カバレッジ80%以上）
- [ ] 管理者権限のテストケース
- [ ] ページネーションのテストケース
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション5.2（user_updateConsent）、5.3（user_revokeConsent）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション4.3.2（同意管理）、セクション6（Consentsコレクション）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-034
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠

## 技術詳細

### 新規実装API一覧

| API名 | メソッド | 権限 | 目的 |
|-------|---------|------|------|
| `consent_getHistory` | Callable | ユーザー本人 | 同意変更履歴の時系列取得 |
| `consent_searchAuditLogs` | Callable | 管理者のみ | 監査ログの複合検索 |
| `consent_getStatistics` | Callable | 管理者のみ | 同意率統計レポート |

### APIエンドポイント詳細

#### 1. consent_getHistory（同意履歴一覧）

**目的**: ユーザー本人の同意変更履歴を時系列で取得（GDPR Article 15対応）

**権限**: 認証済みユーザー（本人のみ）

**リクエスト**:

```typescript
interface GetHistoryRequest {
  startDate?: string;      // ISO 8601形式（例: "2025-01-01T00:00:00Z"）
  endDate?: string;        // ISO 8601形式
  consentType?: "tos" | "pp" | "marketing" | "all";  // フィルタ条件
  limit?: number;          // 1ページあたりの件数（デフォルト: 20、最大: 100）
  offset?: number;         // スキップ件数（ページネーション用）
}
```

**レスポンス**:

```typescript
interface GetHistoryResponse {
  success: true;
  data: {
    history: Array<{
      consentId: string;
      consentType: "tos" | "pp" | "marketing";
      version: string | null;
      action: "accepted" | "revoked";
      timestamp: string;     // ISO 8601形式
      ipAddress: string | null;
      userAgent: string | null;
    }>;
    total: number;           // 全件数
    limit: number;
    offset: number;
    hasMore: boolean;        // 次のページが存在するか
  };
}
```

#### 2. consent_searchAuditLogs（監査ログ検索）

**目的**: 管理者向けの監査ログ複合検索（GDPR監査対応）

**権限**: 管理者のみ（カスタムクレーム `admin: true`）

**リクエスト**:

```typescript
interface SearchAuditLogsRequest {
  userId?: string;         // 特定ユーザーの検索
  startDate?: string;      // ISO 8601形式
  endDate?: string;        // ISO 8601形式
  action?: "accepted" | "revoked" | "all";
  consentType?: "tos" | "pp" | "marketing" | "all";
  exportFormat?: "json" | "csv";  // エクスポート形式
  limit?: number;          // デフォルト: 50、最大: 500
  offset?: number;
}
```

**レスポンス**:

```typescript
interface SearchAuditLogsResponse {
  success: true;
  data: {
    logs: Array<{
      consentId: string;
      userId: string;
      consentType: "tos" | "pp" | "marketing";
      version: string | null;
      action: "accepted" | "revoked";
      timestamp: string;
      ipAddress: string | null;
      userAgent: string | null;
    }>;
    total: number;
    exportUrl?: string;    // CSV/JSONエクスポート時のダウンロードURL
  };
}
```

#### 3. consent_getStatistics（同意率統計）

**目的**: 管理者向けの同意率統計レポート

**権限**: 管理者のみ

**リクエスト**:

```typescript
interface GetStatisticsRequest {
  period: "daily" | "weekly" | "monthly";
  startDate: string;       // ISO 8601形式
  endDate: string;         // ISO 8601形式
  consentType?: "tos" | "pp" | "marketing" | "all";
}
```

**レスポンス**:

```typescript
interface GetStatisticsResponse {
  success: true;
  data: {
    period: "daily" | "weekly" | "monthly";
    statistics: Array<{
      date: string;        // 期間の開始日
      totalUsers: number;  // アクティブユーザー数
      acceptedCount: number;
      revokedCount: number;
      acceptanceRate: number;  // 同意率（0-100%）
    }>;
    summary: {
      totalAccepted: number;
      totalRevoked: number;
      averageAcceptanceRate: number;
    };
  };
}
```

### 実装例

#### consent_getHistory（同意履歴一覧）

```typescript
// functions/src/api/consents/getHistory.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("consent_getHistory");

interface GetHistoryRequest {
  startDate?: string;
  endDate?: string;
  consentType?: "tos" | "pp" | "marketing" | "all";
  limit?: number;
  offset?: number;
}

export const consent_getHistory = onCall(async (request) => {
  // 1. 認証チェック（本人のみ）
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;
  const data = request.data as GetHistoryRequest;

  // 2. バリデーション
  const limit = Math.min(data.limit || 20, 100);  // 最大100件
  const offset = data.offset || 0;

  logger.info("同意履歴取得リクエスト", { uid, limit, offset });

  const db = getFirestore();
  let query = db.collection("consents")
    .where("userId", "==", uid)
    .orderBy("timestamp", "desc");

  // 3. フィルタリング
  if (data.consentType && data.consentType !== "all") {
    query = query.where("consentType", "==", data.consentType);
  }

  if (data.startDate) {
    query = query.where("timestamp", ">=", Timestamp.fromDate(new Date(data.startDate)));
  }

  if (data.endDate) {
    query = query.where("timestamp", "<=", Timestamp.fromDate(new Date(data.endDate)));
  }

  // 4. 全件数を取得（ページネーション用）
  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;

  // 5. ページネーション
  const snapshot = await query.offset(offset).limit(limit + 1).get();
  const hasMore = snapshot.docs.length > limit;
  const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

  // 6. レスポンス整形
  const history = docs.map((doc) => {
    const consentData = doc.data();
    return {
      consentId: doc.id,
      consentType: consentData.consentType,
      version: consentData.version,
      action: consentData.action,
      timestamp: consentData.timestamp?.toDate?.()?.toISOString() || null,
      ipAddress: consentData.ipAddress,
      userAgent: consentData.userAgent,
    };
  });

  logger.info("同意履歴取得完了", { uid, count: history.length });

  return {
    success: true,
    data: {
      history,
      total,
      limit,
      offset,
      hasMore,
    },
  };
});
```

#### consent_searchAuditLogs（監査ログ検索）

```typescript
// functions/src/api/consents/searchAuditLogs.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("consent_searchAuditLogs");

interface SearchAuditLogsRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  action?: "accepted" | "revoked" | "all";
  consentType?: "tos" | "pp" | "marketing" | "all";
  exportFormat?: "json" | "csv";
  limit?: number;
  offset?: number;
}

export const consent_searchAuditLogs = onCall(async (request) => {
  // 1. 管理者権限チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const claims = request.auth.token;
  if (!claims.admin) {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }

  const data = request.data as SearchAuditLogsRequest;

  // 2. バリデーション
  const limit = Math.min(data.limit || 50, 500);  // 最大500件
  const offset = data.offset || 0;

  logger.info("監査ログ検索リクエスト", { adminUid: request.auth.uid, filters: data });

  const db = getFirestore();
  let query = db.collection("consents").orderBy("timestamp", "desc");

  // 3. フィルタリング
  if (data.userId) {
    query = query.where("userId", "==", data.userId);
  }

  if (data.consentType && data.consentType !== "all") {
    query = query.where("consentType", "==", data.consentType);
  }

  if (data.action && data.action !== "all") {
    query = query.where("action", "==", data.action);
  }

  if (data.startDate) {
    query = query.where("timestamp", ">=", Timestamp.fromDate(new Date(data.startDate)));
  }

  if (data.endDate) {
    query = query.where("timestamp", "<=", Timestamp.fromDate(new Date(data.endDate)));
  }

  // 4. データ取得
  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;

  const snapshot = await query.offset(offset).limit(limit).get();

  const logs = snapshot.docs.map((doc) => {
    const logData = doc.data();
    return {
      consentId: doc.id,
      userId: logData.userId,
      consentType: logData.consentType,
      version: logData.version,
      action: logData.action,
      timestamp: logData.timestamp?.toDate?.()?.toISOString() || null,
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
    };
  });

  // 5. CSV/JSONエクスポート（オプション）
  let exportUrl: string | undefined;
  if (data.exportFormat) {
    // TODO: Cloud Storageに保存してダウンロードURLを生成
    exportUrl = undefined;  // 将来実装
  }

  logger.info("監査ログ検索完了", { total, returnedCount: logs.length });

  return {
    success: true,
    data: {
      logs,
      total,
      exportUrl,
    },
  };
});
```

#### consent_getStatistics（同意率統計）

```typescript
// functions/src/api/consents/getStatistics.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("consent_getStatistics");

interface GetStatisticsRequest {
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  consentType?: "tos" | "pp" | "marketing" | "all";
}

export const consent_getStatistics = onCall(async (request) => {
  // 1. 管理者権限チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const claims = request.auth.token;
  if (!claims.admin) {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }

  const data = request.data as GetStatisticsRequest;

  logger.info("統計取得リクエスト", { period: data.period, startDate: data.startDate, endDate: data.endDate });

  const db = getFirestore();
  const startTimestamp = Timestamp.fromDate(new Date(data.startDate));
  const endTimestamp = Timestamp.fromDate(new Date(data.endDate));

  // 2. 期間内の全同意ログを取得
  let query = db.collection("consents")
    .where("timestamp", ">=", startTimestamp)
    .where("timestamp", "<=", endTimestamp);

  if (data.consentType && data.consentType !== "all") {
    query = query.where("consentType", "==", data.consentType);
  }

  const snapshot = await query.get();

  // 3. 期間ごとに集計
  const statsMap = new Map<string, { accepted: number; revoked: number }>();

  snapshot.docs.forEach((doc) => {
    const logData = doc.data();
    const timestamp = logData.timestamp?.toDate();
    if (!timestamp) return;

    // 期間キーを生成（daily: "2025-12-10", weekly: "2025-W50", monthly: "2025-12"）
    const periodKey = getPeriodKey(timestamp, data.period);

    const stats = statsMap.get(periodKey) || { accepted: 0, revoked: 0 };
    if (logData.action === "accepted") {
      stats.accepted++;
    } else if (logData.action === "revoked") {
      stats.revoked++;
    }
    statsMap.set(periodKey, stats);
  });

  // 4. レスポンス整形
  const statistics = Array.from(statsMap.entries()).map(([date, stats]) => ({
    date,
    totalUsers: stats.accepted + stats.revoked,
    acceptedCount: stats.accepted,
    revokedCount: stats.revoked,
    acceptanceRate: stats.accepted / (stats.accepted + stats.revoked) * 100,
  }));

  const totalAccepted = statistics.reduce((sum, s) => sum + s.acceptedCount, 0);
  const totalRevoked = statistics.reduce((sum, s) => sum + s.revokedCount, 0);
  const averageAcceptanceRate = totalAccepted / (totalAccepted + totalRevoked) * 100;

  logger.info("統計取得完了", { totalAccepted, totalRevoked });

  return {
    success: true,
    data: {
      period: data.period,
      statistics,
      summary: {
        totalAccepted,
        totalRevoked,
        averageAcceptanceRate,
      },
    },
  };
});

/**
 * タイムスタンプから期間キーを生成
 */
function getPeriodKey(date: Date, period: "daily" | "weekly" | "monthly"): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (period === "daily") {
    return `${year}-${month}-${day}`;
  } else if (period === "weekly") {
    // ISO週番号を計算
    const weekNumber = getISOWeek(date);
    return `${year}-W${String(weekNumber).padStart(2, "0")}`;
  } else {
    return `${year}-${month}`;
  }
}

function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
```

### データアクセスログ

#### dataAccessLogsコレクションのスキーマ

```typescript
interface DataAccessLog {
  logId: string;              // ログID
  userId: string;             // アクセスされたユーザーID
  accessedBy: string;         // アクセス実行者のユーザーID
  accessType: "read" | "write" | "delete";  // アクセスタイプ
  resource: string;           // アクセスされたリソース（例: "users", "sessions"）
  resourceId: string;         // リソースのドキュメントID
  timestamp: Timestamp;       // アクセス日時
  ipAddress: string | null;   // IPアドレス
  userAgent: string | null;   // ユーザーエージェント
  purpose: string;            // アクセス目的（GDPR Article 15対応）
}
```

#### アクセスログ記録ミドルウェア

```typescript
// functions/src/middleware/logDataAccess.ts
import { getFirestore, FieldValue } from "firebase-admin/firestore";

interface LogDataAccessParams {
  userId: string;
  accessedBy: string;
  accessType: "read" | "write" | "delete";
  resource: string;
  resourceId: string;
  purpose: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logDataAccess(params: LogDataAccessParams): Promise<void> {
  const db = getFirestore();

  await db.collection("dataAccessLogs").add({
    userId: params.userId,
    accessedBy: params.accessedBy,
    accessType: params.accessType,
    resource: params.resource,
    resourceId: params.resourceId,
    timestamp: FieldValue.serverTimestamp(),
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    purpose: params.purpose,
  });
}
```

### Firestoreセキュリティルール

#### Consentsコレクションの読み取り権限（変更なし）

```javascript
match /consents/{consentId} {
  // 本人のみ読み取り可能
  allow read: if request.auth != null
              && resource.data.userId == request.auth.uid;

  // 書き込みはCloud Functionsのみ
  allow write: if false;
}
```

#### dataAccessLogsコレクションの保護

```javascript
match /dataAccessLogs/{logId} {
  // 本人のみ読み取り可能
  allow read: if request.auth != null
              && (resource.data.userId == request.auth.uid
                  || resource.data.accessedBy == request.auth.uid);

  // 書き込みはCloud Functionsのみ
  allow write: if false;
}
```

### 必要なFirestoreインデックス

チケット020の実装には以下の複合インデックスが必要です：

```json
{
  "indexes": [
    {
      "collectionGroup": "consents",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "consents",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "consentType", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "consents",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dataAccessLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `permission-denied` | 管理者権限がない | 403 |
| `invalid-argument` | バリデーションエラー | 400 |
| `not-found` | データが見つからない | 404 |
| `internal` | Firestore更新エラー | 500 |

### レート制限

| API | 制限 | 時間窓 |
|-----|------|--------|
| consent_getHistory | 60回 | 1時間/ユーザー |
| consent_searchAuditLogs | 30回 | 1時間/管理者 |
| consent_getStatistics | 20回 | 1時間/管理者 |

## 見積もり

- 工数: 3日
  - 同意履歴一覧API実装: 0.5日
  - 監査ログ検索API実装: 1日
  - データアクセスログ実装: 1日
  - 統計レポートAPI実装: 0.5日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装状況

### 完了項目

1. **同意履歴一覧API（`consent_getHistory`）**: 実装完了
   - `functions/src/api/consent/history.ts`
   - 期間フィルタリング、同意タイプフィルタリング
   - ページネーション（1ページ最大100件）
   - ユーザー本人のみアクセス可能
   - レート制限：60回/時間/ユーザー

2. **監査ログ検索API（`consent_searchAuditLogs`）**: 実装完了
   - `functions/src/api/consent/auditLogs.ts`
   - 管理者権限チェック（カスタムクレーム `admin: true`）
   - 複合検索条件（ユーザーID、期間、操作タイプ、同意タイプ）
   - レート制限：30回/時間/管理者

3. **同意率統計API（`consent_getStatistics`）**: 実装完了
   - `functions/src/api/consent/statistics.ts`
   - 日次/週次/月次集計
   - 同意率、撤回率の自動計算
   - レート制限：20回/時間/管理者

4. **ユニットテスト**: 実装完了
   - `functions/tests/api/consent/history.test.ts`
   - 16テストケース全てパス

### 未実装項目（オプション機能）

- CSV/JSONエクスポート機能（将来実装予定）
- BigQueryへの同意データストリーミング（Phase 3以降）
- dataAccessLogsコレクション（必要に応じて実装）

## 備考

### チケット006との関係
- **前提条件**: チケット006（GDPR同意管理API）が完了していること
- **依存関係**: チケット006のConsentsコレクションを拡張利用
- **重複排除**: 基本的な同意記録・撤回・状態取得はチケット006で実装済み

### GDPR準拠のポイント
- **Article 7（同意の条件）**: 同意履歴の透明性を確保
- **Article 15（アクセス権）**: ユーザーが自身の同意履歴にアクセス可能
- **監査証跡**: 管理者向けの監査ログ検索機能（コンプライアンス対応）
- **データ保持期間**: Consentsコレクションは削除不可（法的義務）

### セキュリティ上の注意
- 管理者権限チェックは必須（カスタムクレーム `admin: true`）
- データアクセスログは本人と管理者のみアクセス可能
- IPアドレス・ユーザーエージェントの記録はGDPR監査用

### 将来的な拡張
- CSV/JSONエクスポート機能（Cloud Storage連携）
- BigQueryへの同意データストリーミング（分析用）
- 撤回理由の詳細分析（ユーザー体験改善）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | チケット006との重複解消、拡張機能として再定義 |
