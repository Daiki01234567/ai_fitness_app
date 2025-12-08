# 018 GDPR基盤実装

## 概要

GDPR（EU一般データ保護規則）に準拠するための基盤機能を実装します。同意管理、同意履歴の記録、データ削除リクエストの基盤を構築します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 001: Expoプロジェクト初期セットアップ
- 003: Firestoreセキュリティルール実装

## 要件

### 1. 同意管理機能

#### 同意の取得
- 利用規約（ToS）への同意
- プライバシーポリシー（PP）への同意
- 両方の同意が必須（アプリ利用の前提条件）

#### 同意の更新
- 規約改定時に再同意を求める仕組み
- バージョン管理による同意履歴の追跡

#### 同意の撤回
- ユーザーがいつでも同意を撤回できる
- 撤回時は即座にログアウト
- 撤回後はサービス利用不可

### 2. 同意履歴記録（consentsコレクション）

すべての同意アクション（同意・撤回）を記録:

```typescript
interface ConsentRecord {
  userId: string;              // ユーザーID
  consentType: 'tos' | 'privacy_policy';  // 同意の種類
  version: string;             // 同意したバージョン（例: "v3.2"）
  accepted: boolean;           // 同意したか（true）撤回したか（false）
  consentedAt: Timestamp;      // 同意/撤回日時
  ipAddress: string;           // IPアドレス（ハッシュ化）
  userAgent: string;           // アプリ情報
}
```

### 3. データ削除リクエスト基盤

#### リクエストの受付
- ユーザーがアカウント削除をリクエストできる
- リクエスト時に確認ダイアログを表示

#### 30日間の猶予期間
- 削除リクエスト後30日間は復活可能
- 猶予期間中はデータエクスポート可能
- 猶予期間中は読み取り専用モード（新規データ作成不可）

#### 削除リクエストの状態

```typescript
interface DataDeletionRequest {
  userId: string;
  status: 'pending' | 'completed' | 'cancelled';
  requestedAt: Timestamp;
  scheduledDeletionDate: Timestamp;  // リクエストから30日後
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
}
```

### 4. ユーザー権利の実装

| 権利 | 実装内容 | Phase |
|-----|---------|-------|
| アクセス権 | データエクスポート機能 | Phase 2 |
| 訂正権 | プロフィール編集機能 | Phase 1 |
| 削除権 | アカウント削除機能 | Phase 2（基盤はPhase 1） |
| データポータビリティ権 | JSON形式エクスポート | Phase 2 |
| 同意撤回権 | 同意解除機能 | Phase 1 |

## 受け入れ条件

- [ ] 同意記録がconsentsコレクションに保存される
- [ ] 同意記録にバージョン情報が含まれる
- [ ] 同意記録にタイムスタンプが含まれる
- [ ] 同意記録にIPアドレス（ハッシュ化）が含まれる
- [ ] 同意撤回時に即座にログアウトされる
- [ ] 同意撤回の記録がconsentsコレクションに保存される
- [ ] データ削除リクエストがdataDeletionRequestsコレクションに保存される
- [ ] 削除リクエスト時に30日後の日付が設定される
- [ ] 削除予約中のユーザーに警告が表示される
- [ ] 削除予約中のユーザーは新規データ作成が制限される
- [ ] 削除リクエストのキャンセルができる

## 参照ドキュメント

- [要件定義書 Part 5](../specs/05_要件定義書_Expo版_v1_Part5.md) - GDPR対応、データベース設計
- [プライバシーポリシー v3.1](../../specs/プライバシーポリシー_v3.1.md)

## 技術詳細

### Firestoreコレクション構造

```
consents/
  └── {consentId}/
        ├── userId: string
        ├── consentType: 'tos' | 'privacy_policy'
        ├── version: string
        ├── accepted: boolean
        ├── consentedAt: Timestamp
        ├── ipAddress: string (hashed)
        └── userAgent: string

dataDeletionRequests/
  └── {requestId}/
        ├── userId: string
        ├── status: 'pending' | 'completed' | 'cancelled'
        ├── requestedAt: Timestamp
        ├── scheduledDeletionDate: Timestamp
        ├── completedAt?: Timestamp
        └── cancelledAt?: Timestamp
```

### 同意記録の作成

```typescript
// lib/gdpr/consent.ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashIpAddress } from '@/lib/utils/hash';

export async function recordConsent(
  userId: string,
  consentType: 'tos' | 'privacy_policy',
  version: string,
  accepted: boolean,
  ipAddress: string
) {
  await addDoc(collection(db, 'consents'), {
    userId,
    consentType,
    version,
    accepted,
    consentedAt: serverTimestamp(),
    ipAddress: hashIpAddress(ipAddress),
    userAgent: 'AIFitness App/1.0.0',
  });
}
```

### 削除リクエストの作成

```typescript
// lib/gdpr/deletion.ts
import { addDoc, collection, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function requestAccountDeletion(userId: string) {
  const now = new Date();
  const scheduledDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後

  // 削除リクエストを作成
  const requestRef = await addDoc(collection(db, 'dataDeletionRequests'), {
    userId,
    status: 'pending',
    requestedAt: serverTimestamp(),
    scheduledDeletionDate: Timestamp.fromDate(scheduledDate),
  });

  // ユーザードキュメントにフラグを設定
  await updateDoc(doc(db, 'users', userId), {
    deletionScheduled: true,
    deletionRequestId: requestRef.id,
  });

  return requestRef.id;
}

export async function cancelDeletionRequest(userId: string, requestId: string) {
  // 削除リクエストをキャンセル
  await updateDoc(doc(db, 'dataDeletionRequests', requestId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  });

  // ユーザードキュメントのフラグを解除
  await updateDoc(doc(db, 'users', userId), {
    deletionScheduled: false,
    deletionRequestId: null,
  });
}
```

### 削除予約中ユーザーの制限

```typescript
// hooks/useDeletionRestriction.ts
import { useAuthStore } from '@/stores/authStore';

export function useDeletionRestriction() {
  const { userData } = useAuthStore();

  const isDeletionScheduled = userData?.deletionScheduled === true;

  const checkWritePermission = () => {
    if (isDeletionScheduled) {
      throw new Error('アカウント削除予約中のため、新しいデータを作成できません。');
    }
  };

  return {
    isDeletionScheduled,
    checkWritePermission,
  };
}
```

### Firestoreセキュリティルール

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // consentsコレクション - 追加のみ可能（変更・削除不可）
    match /consents/{consentId} {
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    // dataDeletionRequestsコレクション
    match /dataDeletionRequests/{requestId} {
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      // キャンセルのみ許可
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid
        && request.resource.data.status == 'cancelled';
      allow delete: if false;
    }
  }
}
```

## 注意事項

- IPアドレスは必ずハッシュ化して保存すること
- 同意記録は監査目的で永久保存（削除不可）
- 削除リクエストの実際のデータ削除処理はCloud Functions（バックエンド）で実行
- Phase 1では削除リクエストの受付と記録のみ実装
- 実際のデータ削除処理はPhase 2で実装

## 見積もり

- 想定工数: 2〜3日

## 進捗

- [ ] 未着手
