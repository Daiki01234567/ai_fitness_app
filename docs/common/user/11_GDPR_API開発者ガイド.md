# GDPR API 開発者ガイド

このガイドでは、GDPR関連APIの使用方法を開発者向けに解説します。

## 目次

1. [概要](#概要)
2. [API一覧](#api一覧)
3. [同意管理API](#同意管理api)
4. [データ削除API](#データ削除api)
5. [データエクスポートAPI](#データエクスポートapi)
6. [管理者向けAPI](#管理者向けapi)
7. [エラーハンドリング](#エラーハンドリング)
8. [テスト方法](#テスト方法)

---

## 概要

### 対応するGDPR権利

| GDPR条項 | 権利 | 対応API |
|---------|------|---------|
| 第7条 | 同意の条件 | `consent_record`, `consent_revoke` |
| 第15条 | アクセス権 | `gdpr_exportData`, `consent_getHistory` |
| 第17条 | 削除権 | `gdpr_requestAccountDeletion`, `gdpr_executeImmediateDeletion` |
| 第20条 | データポータビリティ | `gdpr_exportData` |

### アーキテクチャ

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Mobile App    │ ──→  │ Cloud Functions │ ──→  │    Firestore    │
│  (Expo/Flutter) │      │  (GDPR APIs)    │      │   + BigQuery    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ↓
                         ┌─────────────────┐
                         │  Cloud Tasks    │
                         │  (非同期削除)    │
                         └─────────────────┘
```

---

## API一覧

### ユーザー向けAPI

| API名 | 説明 | ファイル |
|-------|------|---------|
| `consent_record` | 同意を記録 | `api/consent/record.ts` |
| `consent_getStatus` | 同意状態を取得 | `api/consent/status.ts` |
| `consent_revoke` | 同意を撤回 | `api/consent/revoke.ts` |
| `consent_getHistory` | 同意履歴を取得 | `api/consent/history.ts` |
| `gdpr_requestAccountDeletion` | アカウント削除リクエスト | `api/gdpr/deleteData.ts` |
| `gdpr_cancelDeletion` | 削除キャンセル | `api/gdpr/deleteData.ts` |
| `gdpr_getDeletionStatus` | 削除状態を取得 | `api/gdpr/deleteData.ts` |
| `gdpr_exportData` | データエクスポート | `api/gdpr/exportData.ts` |

### 管理者向けAPI

| API名 | 説明 | ファイル |
|-------|------|---------|
| `consent_searchAuditLogs` | 監査ログ検索 | `api/consent/auditLogs.ts` |
| `consent_getStatistics` | 同意統計情報 | `api/consent/statistics.ts` |
| `gdpr_executeImmediateDeletion` | 即座削除（管理者のみ） | `api/gdpr/deleteData.ts` |

---

## 同意管理API

### consent_record - 同意を記録

ユーザーの同意を記録します。

**リクエスト：**
```typescript
interface ConsentRecordRequest {
  consentType: 'tos' | 'privacy_policy' | 'marketing';
  documentVersion: string;
  action: 'accept';
}
```

**レスポンス：**
```typescript
interface ConsentRecordResponse {
  success: true;
  data: {
    consentId: string;
    timestamp: string;
  };
}
```

**使用例（React Native）：**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'asia-northeast1');
const consentRecord = httpsCallable(functions, 'consent_record');

const result = await consentRecord({
  consentType: 'tos',
  documentVersion: '1.0',
  action: 'accept',
});

console.log('同意ID:', result.data.data.consentId);
```

**使用例（Flutter）：**
```dart
final functions = FirebaseFunctions.instanceFor(region: 'asia-northeast1');
final consentRecord = functions.httpsCallable('consent_record');

final result = await consentRecord.call({
  'consentType': 'tos',
  'documentVersion': '1.0',
  'action': 'accept',
});

print('同意ID: ${result.data['data']['consentId']}');
```

### consent_getHistory - 同意履歴を取得

ユーザーの同意履歴を取得します。

**リクエスト：**
```typescript
interface GetHistoryRequest {
  consentType?: 'tos' | 'privacy_policy' | 'marketing' | 'all';
  startDate?: string;  // ISO 8601形式
  endDate?: string;    // ISO 8601形式
  limit?: number;      // デフォルト: 20, 最大: 100
  offset?: number;     // デフォルト: 0
}
```

**レスポンス：**
```typescript
interface GetHistoryResponse {
  success: true;
  data: {
    history: Array<{
      consentId: string;
      consentType: string;
      documentVersion: string;
      action: string;
      timestamp: string;
      ipAddress: string | null;
      userAgent: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**使用例：**
```typescript
const consentGetHistory = httpsCallable(functions, 'consent_getHistory');

// 全履歴を取得
const result = await consentGetHistory({});

// 特定の同意タイプでフィルタ
const tosHistory = await consentGetHistory({
  consentType: 'tos',
  limit: 50,
});

// 日付範囲でフィルタ
const recentHistory = await consentGetHistory({
  startDate: '2025-12-01T00:00:00Z',
  endDate: '2025-12-31T23:59:59Z',
});
```

---

## データ削除API

### gdpr_requestAccountDeletion - アカウント削除リクエスト

30日間の猶予期間付きでアカウント削除をリクエストします。

**リクエスト：**
```typescript
interface DeleteAccountRequest {
  reason?: string;  // 削除理由（任意）
}
```

**レスポンス：**
```typescript
interface DeleteAccountResponse {
  success: true;
  data: {
    scheduledDeletionDate: string;  // ISO 8601形式
    requestId: string;
  };
  message: string;
}
```

**使用例：**
```typescript
const requestDeletion = httpsCallable(functions, 'gdpr_requestAccountDeletion');

const result = await requestDeletion({
  reason: 'サービスを使用しなくなったため',
});

console.log('削除予定日:', result.data.data.scheduledDeletionDate);
// 出力例: "2025-01-10T10:00:00.000Z" （30日後）
```

### gdpr_cancelDeletion - 削除キャンセル

30日以内であれば削除をキャンセルできます。

**リクエスト：** なし

**レスポンス：**
```typescript
interface CancelDeletionResponse {
  success: true;
  message: string;
}
```

**使用例：**
```typescript
const cancelDeletion = httpsCallable(functions, 'gdpr_cancelDeletion');

const result = await cancelDeletion({});
console.log(result.data.message);  // "アカウント削除をキャンセルしました。"
```

### gdpr_getDeletionStatus - 削除状態を取得

現在の削除状態を確認します。

**レスポンス：**
```typescript
interface DeletionStatusResponse {
  success: true;
  data: {
    deletionScheduled: boolean;
    scheduledDeletionDate: string | null;
    deletionScheduledAt: string | null;
    daysRemaining: number | null;
  };
}
```

**使用例：**
```typescript
const getDeletionStatus = httpsCallable(functions, 'gdpr_getDeletionStatus');

const result = await getDeletionStatus({});

if (result.data.data.deletionScheduled) {
  console.log('削除予定日:', result.data.data.scheduledDeletionDate);
  console.log('残り日数:', result.data.data.daysRemaining);
}
```

---

## データエクスポートAPI

### gdpr_exportData - データエクスポート

ユーザーのすべてのデータをJSON形式でエクスポートします。

**リクエスト：**
```typescript
interface ExportDataRequest {
  format?: 'json';  // 現在はJSONのみ対応
  includeTrainingSessions?: boolean;  // デフォルト: true
  includeConsents?: boolean;          // デフォルト: true
}
```

**レスポンス：**
```typescript
interface ExportDataResponse {
  success: true;
  data: {
    profile: {
      userId: string;
      email: string;
      displayName: string;
      createdAt: string;
      // ...その他のプロフィール情報
    };
    trainingSessions?: Array<{
      sessionId: string;
      exerciseType: string;
      startedAt: string;
      // ...セッション情報
    }>;
    consents?: Array<{
      consentId: string;
      consentType: string;
      timestamp: string;
      // ...同意情報
    }>;
    exportedAt: string;
  };
}
```

**使用例：**
```typescript
const exportData = httpsCallable(functions, 'gdpr_exportData');

const result = await exportData({
  format: 'json',
  includeTrainingSessions: true,
  includeConsents: true,
});

// データをファイルとして保存
const jsonString = JSON.stringify(result.data.data, null, 2);
// ファイル保存処理...
```

---

## 管理者向けAPI

### consent_searchAuditLogs - 監査ログ検索

管理者権限が必要です（`admin: true` カスタムクレーム）。

**リクエスト：**
```typescript
interface SearchAuditLogsRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  action?: 'accept' | 'revoke' | 'all';
  consentType?: 'tos' | 'privacy_policy' | 'marketing' | 'all';
  limit?: number;   // デフォルト: 50, 最大: 500
  offset?: number;
}
```

**レスポンス：**
```typescript
interface SearchAuditLogsResponse {
  success: true;
  data: {
    logs: Array<{
      consentId: string;
      userId: string;
      consentType: string;
      documentVersion: string | null;
      action: string;
      timestamp: string | null;
      ipAddress: string | null;
      userAgent: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  };
}
```

### consent_getStatistics - 同意統計情報

管理者権限が必要です。

**リクエスト：**
```typescript
interface GetStatisticsRequest {
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
}
```

**レスポンス：**
```typescript
interface GetStatisticsResponse {
  success: true;
  data: {
    summary: {
      totalConsents: number;
      acceptCount: number;
      revokeCount: number;
      acceptRate: number;  // パーセンテージ
    };
    byType: {
      [consentType: string]: {
        total: number;
        accepted: number;
        revoked: number;
      };
    };
    period: string;
    generatedAt: string;
  };
}
```

---

## エラーハンドリング

### エラーコード一覧

| コード | 説明 | 対処方法 |
|--------|------|---------|
| `unauthenticated` | 未認証 | ログインが必要 |
| `permission-denied` | 権限なし | 管理者権限が必要、または削除予定中 |
| `invalid-argument` | 引数不正 | リクエストパラメータを確認 |
| `not-found` | データなし | 対象データが存在しない |
| `resource-exhausted` | レート制限 | 時間をおいて再試行 |
| `internal` | 内部エラー | サポートに連絡 |

### エラーハンドリング例

```typescript
import { FirebaseError } from 'firebase/app';

try {
  const result = await gdprRequestDeletion({});
} catch (error) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/unauthenticated':
        // ログイン画面へリダイレクト
        break;
      case 'functions/permission-denied':
        // 削除予定中の場合、書き込みは禁止
        showAlert('アカウント削除予定中のため、この操作はできません');
        break;
      case 'functions/resource-exhausted':
        // レート制限
        showAlert('リクエスト数の上限に達しました。しばらくお待ちください');
        break;
      default:
        showAlert('エラーが発生しました');
    }
  }
}
```

---

## テスト方法

### ユニットテストの実行

```bash
cd functions
npm test -- --grep "gdpr"   # GDPR関連テストのみ
npm test -- --grep "consent" # 同意関連テストのみ
```

### エミュレータでのテスト

```bash
# エミュレータ起動
firebase emulators:start

# 別ターミナルでテスト実行
npm run test:emulator
```

### テストデータの作成

```typescript
// テスト用のモックリクエスト
const mockRequest = {
  auth: {
    uid: 'test-user-123',
    token: { email: 'test@example.com' },
  },
  data: {
    consentType: 'tos',
    documentVersion: '1.0',
    action: 'accept',
  },
};
```

---

## レート制限

| API | 制限 | 対象 |
|-----|------|------|
| `consent_getHistory` | 60リクエスト/時間 | ユーザーごと |
| `consent_searchAuditLogs` | 30リクエスト/時間 | 管理者ごと |
| `consent_getStatistics` | 20リクエスト/時間 | 管理者ごと |
| `gdpr_exportData` | 5リクエスト/日 | ユーザーごと |
| `gdpr_requestAccountDeletion` | 3リクエスト/日 | ユーザーごと |

---

## 関連ファイル

- `functions/src/api/consent/` - 同意管理API
- `functions/src/api/gdpr/` - GDPR API
- `functions/src/services/gdprService.ts` - GDPRサービスクラス
- `functions/src/services/gdprDeletion.ts` - 削除処理サービス
- `functions/src/services/gdprExport.ts` - エクスポートサービス
- `functions/tests/api/consent/` - 同意APIテスト
- `functions/tests/api/gdpr/` - GDPR APIテスト

---

*このガイドは2025年12月10日に作成されました。*
