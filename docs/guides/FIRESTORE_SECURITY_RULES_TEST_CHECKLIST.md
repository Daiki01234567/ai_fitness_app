# Firestore Security Rules エミュレータテスト検証項目

**ドキュメントバージョン**: v1.0
**作成日**: 2025年12月1日
**対象ファイル**: `firebase/firestore.rules`
**参照仕様書**:
- `docs/specs/02_Firestoreデータベース設計書_v3_3.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

---

## 目次

1. [テスト環境セットアップ](#1-テスト環境セットアップ)
2. [ヘルパー関数テスト](#2-ヘルパー関数テスト)
3. [Usersコレクション検証項目](#3-usersコレクション検証項目)
4. [Sessionsサブコレクション検証項目](#4-sessionsサブコレクション検証項目)
5. [Framesサブコレクション検証項目](#5-framesサブコレクション検証項目)
6. [Settingsサブコレクション検証項目](#6-settingsサブコレクション検証項目)
7. [Subscriptionsサブコレクション検証項目](#7-subscriptionsサブコレクション検証項目)
8. [Consentsコレクション検証項目](#8-consentsコレクション検証項目)
9. [Notificationsコレクション検証項目](#9-notificationsコレクション検証項目)
10. [DataDeletionRequestsコレクション検証項目](#10-datadeletionrequestsコレクション検証項目)
11. [管理者専用コレクション検証項目](#11-管理者専用コレクション検証項目)
12. [バリデーション関数テスト](#12-バリデーション関数テスト)
13. [テストデータテンプレート](#13-テストデータテンプレート)

---

## 1. テスト環境セットアップ

### 1.1 必要なパッケージ

```bash
npm install --save-dev @firebase/rules-unit-testing firebase-admin
```

### 1.2 テストファイル構成

```
functions/tests/
├── rules/
│   ├── setup.ts           # テストセットアップ
│   ├── users.rules.test.ts
│   ├── sessions.rules.test.ts
│   ├── frames.rules.test.ts
│   ├── settings.rules.test.ts
│   ├── subscriptions.rules.test.ts
│   ├── consents.rules.test.ts
│   ├── notifications.rules.test.ts
│   ├── dataDeletionRequests.rules.test.ts
│   ├── adminCollections.rules.test.ts
│   └── validation.rules.test.ts
```

### 1.3 テストセットアップコード

```typescript
// functions/tests/rules/setup.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";

let testEnv: RulesTestEnvironment;

export async function setupTestEnv(): Promise<RulesTestEnvironment> {
  testEnv = await initializeTestEnvironment({
    projectId: "test-project",
    firestore: {
      rules: readFileSync("../firebase/firestore.rules", "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
  return testEnv;
}

export async function teardownTestEnv(): Promise<void> {
  await testEnv.cleanup();
}

export function getTestEnv(): RulesTestEnvironment {
  return testEnv;
}

export { assertFails, assertSucceeds };
```

### 1.4 エミュレータ起動コマンド

```bash
firebase emulators:start --only firestore
```

---

## 2. ヘルパー関数テスト

### 2.1 isAuthenticated()

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| HF-001 | 認証済みユーザーでのアクセス | 成功 | 高 |
| HF-002 | 未認証ユーザーでのアクセス | 失敗 | 高 |

### 2.2 isOwner(userId)

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| HF-003 | 自分自身のドキュメントへのアクセス | 成功 | 高 |
| HF-004 | 他人のドキュメントへのアクセス | 失敗 | 高 |
| HF-005 | 未認証ユーザーが任意のドキュメントにアクセス | 失敗 | 高 |

### 2.3 isAdmin()

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| HF-006 | admin=true のカスタムクレームを持つユーザー | 成功 | 高 |
| HF-007 | admin クレームなしのユーザー | 失敗 | 高 |
| HF-008 | admin=false のカスタムクレームを持つユーザー | 失敗 | 高 |
| HF-009 | 未認証ユーザー | 失敗 | 高 |

### 2.4 isNotScheduledForDeletion(userId)

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| HF-010 | deletionScheduled=false のユーザー | 成功 | 高 |
| HF-011 | deletionScheduled=true のユーザー | 失敗 | 高 |
| HF-012 | deletionScheduled フィールドなしのユーザー | 成功 | 中 |
| HF-013 | ユーザードキュメントが存在しない場合 | 成功 | 中 |

### 2.5 isNotForcedLogout(userId)

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| HF-014 | forceLogout=false のユーザー | 成功 | 高 |
| HF-015 | forceLogout=true のユーザー | 失敗 | 高 |
| HF-016 | forceLogout フィールドなしのユーザー | 成功 | 中 |

---

## 3. Usersコレクション検証項目

**パス**: `/users/{userId}`

### 3.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| U-R-001 | 認証済みユーザーが自分のドキュメントを読み取り | 成功 | 高 | - |
| U-R-002 | 認証済みユーザーが他人のドキュメントを読み取り | 失敗 | 高 | - |
| U-R-003 | 未認証ユーザーがドキュメントを読み取り | 失敗 | 高 | - |
| U-R-004 | 管理者が他人のドキュメントを読み取り | 失敗 | 高 | - |

### 3.2 Create操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| U-C-001 | 有効なデータで自分のドキュメントを作成 | 成功 | 高 | - |
| U-C-002 | 必須フィールド欠落で作成 | 失敗 | 高 | - |
| U-C-003 | nickname が空文字で作成 | 失敗 | 中 | - |
| U-C-004 | nickname が51文字以上で作成 | 失敗 | 中 | - |
| U-C-005 | 無効なメール形式で作成 | 失敗 | 中 | - |
| U-C-006 | tosAccepted=false で作成 | 失敗 | 高 | GDPR同意 |
| U-C-007 | ppAccepted=false で作成 | 失敗 | 高 | GDPR同意 |
| U-C-008 | deletionScheduled=true で作成 | 失敗 | 高 | - |
| U-C-009 | 他人のUID でドキュメントを作成 | 失敗 | 高 | - |
| U-C-010 | 未認証ユーザーがドキュメントを作成 | 失敗 | 高 | - |

### 3.3 Update操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| U-U-001 | 許可されたフィールド(nickname等)を更新 | 成功 | 高 | - |
| U-U-002 | email フィールドを変更 | 失敗 | 高 | 不変フィールド |
| U-U-003 | createdAt フィールドを変更 | 失敗 | 高 | 不変フィールド |
| U-U-004 | tosAccepted フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-005 | ppAccepted フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-006 | tosAcceptedAt フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-007 | ppAcceptedAt フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-008 | tosVersion フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-009 | ppVersion フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-010 | deletionScheduled フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-011 | deletionScheduledAt フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-012 | scheduledDeletionDate フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-013 | forceLogout フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-014 | forceLogoutAt フィールドを変更 | 失敗 | 高 | 読取専用 |
| U-U-015 | deletionScheduled=true のユーザーが更新 | 失敗 | 高 | 削除猶予期間 |
| U-U-016 | 他人のドキュメントを更新 | 失敗 | 高 | - |
| U-U-017 | 未認証ユーザーが更新 | 失敗 | 高 | - |

### 3.4 Delete操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| U-D-001 | 認証済みユーザーが自分のドキュメントを削除 | 失敗 | 高 | CF経由のみ |
| U-D-002 | 管理者がドキュメントを削除 | 失敗 | 高 | CF経由のみ |
| U-D-003 | 未認証ユーザーがドキュメントを削除 | 失敗 | 高 | - |

### 3.5 プロフィールバリデーション

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| U-P-001 | profile.height=100 で更新 | 成功 | 中 |
| U-P-002 | profile.height=250 で更新 | 成功 | 中 |
| U-P-003 | profile.height=99 で更新 | 失敗 | 中 |
| U-P-004 | profile.height=251 で更新 | 失敗 | 中 |
| U-P-005 | profile.weight=30 で更新 | 成功 | 中 |
| U-P-006 | profile.weight=300 で更新 | 成功 | 中 |
| U-P-007 | profile.weight=29 で更新 | 失敗 | 中 |
| U-P-008 | profile.weight=301 で更新 | 失敗 | 中 |
| U-P-009 | profile.gender='male' で更新 | 成功 | 中 |
| U-P-010 | profile.gender='female' で更新 | 成功 | 中 |
| U-P-011 | profile.gender='other' で更新 | 成功 | 中 |
| U-P-012 | profile.gender='prefer_not_to_say' で更新 | 成功 | 中 |
| U-P-013 | profile.gender='invalid' で更新 | 失敗 | 中 |
| U-P-014 | profile.fitnessLevel='beginner' で更新 | 成功 | 中 |
| U-P-015 | profile.fitnessLevel='intermediate' で更新 | 成功 | 中 |
| U-P-016 | profile.fitnessLevel='advanced' で更新 | 成功 | 中 |
| U-P-017 | profile.fitnessLevel='invalid' で更新 | 失敗 | 中 |
| U-P-018 | profile.height=null で更新 | 成功 | 低 |
| U-P-019 | profile.weight=null で更新 | 成功 | 低 |

---

## 4. Sessionsサブコレクション検証項目

**パス**: `/users/{userId}/sessions/{sessionId}`

### 4.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| S-R-001 | 認証済みユーザーが自分のセッションを読み取り | 成功 | 高 | - |
| S-R-002 | 他人のセッションを読み取り | 失敗 | 高 | - |
| S-R-003 | 未認証ユーザーがセッションを読み取り | 失敗 | 高 | - |
| S-R-004 | deletionScheduled=true のユーザーがセッションを読み取り | 失敗 | 高 | 削除猶予期間 |

### 4.2 Create操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| S-C-001 | 有効なデータでセッションを作成 | 成功 | 高 | - |
| S-C-002 | 必須フィールド欠落で作成 | 失敗 | 高 | - |
| S-C-003 | exerciseType='squat' で作成 | 成功 | 高 | - |
| S-C-004 | exerciseType='armcurl' で作成 | 成功 | 高 | - |
| S-C-005 | exerciseType='sideraise' で作成 | 成功 | 高 | - |
| S-C-006 | exerciseType='shoulderpress' で作成 | 成功 | 高 | - |
| S-C-007 | exerciseType='pushup' で作成 | 成功 | 高 | - |
| S-C-008 | 無効な exerciseType で作成 | 失敗 | 高 | - |
| S-C-009 | status='active' 以外で作成 | 失敗 | 高 | - |
| S-C-010 | userId が認証ユーザーと異なる値で作成 | 失敗 | 高 | - |
| S-C-011 | deletionScheduled=true のユーザーが作成 | 失敗 | 高 | 削除猶予期間 |
| S-C-012 | 他人のセッションコレクションに作成 | 失敗 | 高 | - |
| S-C-013 | startTime が無効なタイムスタンプで作成 | 失敗 | 中 | - |
| S-C-014 | createdAt が無効なタイムスタンプで作成 | 失敗 | 中 | - |

### 4.3 Update操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| S-U-001 | 許可されたフィールド(status, repCount等)を更新 | 成功 | 高 | - |
| S-U-002 | status='completed' に更新 | 成功 | 高 | - |
| S-U-003 | status='cancelled' に更新 | 成功 | 高 | - |
| S-U-004 | 無効な status に更新 | 失敗 | 高 | - |
| S-U-005 | sessionId を変更 | 失敗 | 高 | 不変フィールド |
| S-U-006 | userId を変更 | 失敗 | 高 | 不変フィールド |
| S-U-007 | exerciseType を変更 | 失敗 | 高 | 不変フィールド |
| S-U-008 | startTime を変更 | 失敗 | 高 | 不変フィールド |
| S-U-009 | createdAt を変更 | 失敗 | 高 | 不変フィールド |
| S-U-010 | repCount=0 で更新 | 成功 | 中 | - |
| S-U-011 | repCount=1000 で更新 | 成功 | 中 | - |
| S-U-012 | repCount=-1 で更新 | 失敗 | 中 | - |
| S-U-013 | repCount=1001 で更新 | 失敗 | 中 | - |
| S-U-014 | setCount=1 で更新 | 成功 | 中 | - |
| S-U-015 | setCount=10 で更新 | 成功 | 中 | - |
| S-U-016 | setCount=0 で更新 | 失敗 | 中 | - |
| S-U-017 | setCount=11 で更新 | 失敗 | 中 | - |
| S-U-018 | deletionScheduled=true のユーザーが更新 | 失敗 | 高 | 削除猶予期間 |
| S-U-019 | 他人のセッションを更新 | 失敗 | 高 | - |

### 4.4 Delete操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| S-D-001 | 認証済みユーザーが自分のセッションを削除 | 失敗 | 高 | CF経由のみ |
| S-D-002 | 管理者がセッションを削除 | 失敗 | 高 | CF経由のみ |

---

## 5. Framesサブコレクション検証項目

**パス**: `/users/{userId}/sessions/{sessionId}/frames/{frameId}`

### 5.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| F-R-001 | 認証済みユーザーが自分のフレームを読み取り | 成功 | 高 | - |
| F-R-002 | 他人のフレームを読み取り | 失敗 | 高 | - |
| F-R-003 | 未認証ユーザーがフレームを読み取り | 失敗 | 高 | - |
| F-R-004 | deletionScheduled=true のユーザーがフレームを読み取り | 失敗 | 高 | 削除猶予期間 |

### 5.2 Create操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| F-C-001 | 有効なデータでフレームを作成 | 成功 | 高 | - |
| F-C-002 | 必須フィールド欠落で作成 | 失敗 | 高 | - |
| F-C-003 | landmarks が33要素の配列で作成 | 成功 | 高 | MediaPipe |
| F-C-004 | landmarks が32要素の配列で作成 | 失敗 | 高 | MediaPipe |
| F-C-005 | landmarks が34要素の配列で作成 | 失敗 | 高 | MediaPipe |
| F-C-006 | landmarks が空配列で作成 | 失敗 | 高 | MediaPipe |
| F-C-007 | frameNumber=0 で作成 | 成功 | 中 | - |
| F-C-008 | frameNumber=-1 で作成 | 失敗 | 中 | - |
| F-C-009 | deletionScheduled=true のユーザーが作成 | 失敗 | 高 | 削除猶予期間 |
| F-C-010 | 他人のフレームコレクションに作成 | 失敗 | 高 | - |

### 5.3 Update操作（不変）

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| F-U-001 | 認証済みユーザーが自分のフレームを更新 | 失敗 | 高 | 不変データ |
| F-U-002 | 管理者がフレームを更新 | 失敗 | 高 | 不変データ |

### 5.4 Delete操作（不変）

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| F-D-001 | 認証済みユーザーが自分のフレームを削除 | 失敗 | 高 | 不変データ |
| F-D-002 | 管理者がフレームを削除 | 失敗 | 高 | 不変データ |

---

## 6. Settingsサブコレクション検証項目

**パス**: `/users/{userId}/settings/{settingId}`

### 6.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| ST-R-001 | 認証済みユーザーが自分の設定を読み取り | 成功 | 高 |
| ST-R-002 | 他人の設定を読み取り | 失敗 | 高 |
| ST-R-003 | 未認証ユーザーが設定を読み取り | 失敗 | 高 |

### 6.2 Create操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| ST-C-001 | 認証済みユーザーが自分の設定を作成 | 成功 | 高 | - |
| ST-C-002 | deletionScheduled=true のユーザーが作成 | 失敗 | 高 | 削除猶予期間 |
| ST-C-003 | 他人の設定コレクションに作成 | 失敗 | 高 | - |

### 6.3 Update操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| ST-U-001 | 認証済みユーザーが自分の設定を更新 | 成功 | 高 | - |
| ST-U-002 | deletionScheduled=true のユーザーが更新 | 失敗 | 高 | 削除猶予期間 |
| ST-U-003 | 他人の設定を更新 | 失敗 | 高 | - |

### 6.4 Delete操作

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| ST-D-001 | 認証済みユーザーが自分の設定を削除 | 成功 | 高 |
| ST-D-002 | 他人の設定を削除 | 失敗 | 高 |

---

## 7. Subscriptionsサブコレクション検証項目

**パス**: `/users/{userId}/subscriptions/{subscriptionId}`

### 7.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| SUB-R-001 | 認証済みユーザーが自分のサブスクリプションを読み取り | 成功 | 高 |
| SUB-R-002 | 他人のサブスクリプションを読み取り | 失敗 | 高 |
| SUB-R-003 | 未認証ユーザーがサブスクリプションを読み取り | 失敗 | 高 |

### 7.2 Create/Update/Delete操作（CF専用）

| テストID | テスト項目 | 期待結果 | 優先度 | 備考 |
|---------|----------|---------|--------|------|
| SUB-C-001 | 認証済みユーザーがサブスクリプションを作成 | 失敗 | 高 | CF経由のみ |
| SUB-U-001 | 認証済みユーザーがサブスクリプションを更新 | 失敗 | 高 | CF経由のみ |
| SUB-D-001 | 認証済みユーザーがサブスクリプションを削除 | 失敗 | 高 | CF経由のみ |
| SUB-C-002 | 管理者がサブスクリプションを作成 | 失敗 | 高 | CF経由のみ |

---

## 8. Consentsコレクション検証項目

**パス**: `/consents/{consentId}`

### 8.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| CON-R-001 | ドキュメントの userId と一致するユーザーが読み取り | 成功 | 高 | データエクスポート |
| CON-R-002 | ドキュメントの userId と異なるユーザーが読み取り | 失敗 | 高 | - |
| CON-R-003 | 未認証ユーザーが読み取り | 失敗 | 高 | - |
| CON-R-004 | 管理者が他人の同意履歴を読み取り | 失敗 | 高 | プライバシー保護 |

### 8.2 Create/Update/Delete操作（CF専用）

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| CON-C-001 | 認証済みユーザーが同意を作成 | 失敗 | 高 | CF経由のみ |
| CON-U-001 | 認証済みユーザーが同意を更新 | 失敗 | 高 | 不変監査ログ |
| CON-D-001 | 認証済みユーザーが同意を削除 | 失敗 | 高 | 不変監査ログ |
| CON-C-002 | 管理者が同意を作成 | 失敗 | 高 | CF経由のみ |

---

## 9. Notificationsコレクション検証項目

**パス**: `/notifications/{notificationId}`

### 9.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| NOT-R-001 | ドキュメントの userId と一致するユーザーが読み取り | 成功 | 高 |
| NOT-R-002 | ドキュメントの userId と異なるユーザーが読み取り | 失敗 | 高 |
| NOT-R-003 | 未認証ユーザーが読み取り | 失敗 | 高 |

### 9.2 Update操作（既読ステータスのみ）

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| NOT-U-001 | isRead=true, readAt, updatedAt のみ更新 | 成功 | 高 |
| NOT-U-002 | isRead=false に更新 | 失敗 | 高 |
| NOT-U-003 | title を更新 | 失敗 | 高 |
| NOT-U-004 | body を更新 | 失敗 | 高 |
| NOT-U-005 | type を更新 | 失敗 | 高 |
| NOT-U-006 | 他人の通知を更新 | 失敗 | 高 |
| NOT-U-007 | isRead, readAt, updatedAt 以外のフィールドを含む更新 | 失敗 | 高 |

### 9.3 Create/Delete操作（CF専用）

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| NOT-C-001 | 認証済みユーザーが通知を作成 | 失敗 | 高 |
| NOT-D-001 | 認証済みユーザーが通知を削除 | 失敗 | 高 |

---

## 10. DataDeletionRequestsコレクション検証項目

**パス**: `/dataDeletionRequests/{requestId}`

### 10.1 Read操作

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| DDR-R-001 | ドキュメントの userId と一致するユーザーが読み取り | 成功 | 高 | 削除状態確認 |
| DDR-R-002 | ドキュメントの userId と異なるユーザーが読み取り | 失敗 | 高 | - |
| DDR-R-003 | 未認証ユーザーが読み取り | 失敗 | 高 | - |

### 10.2 Create/Update/Delete操作（CF専用）

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| DDR-C-001 | 認証済みユーザーが削除リクエストを作成 | 失敗 | 高 | CF経由のみ |
| DDR-U-001 | 認証済みユーザーが削除リクエストを更新 | 失敗 | 高 | CF経由のみ |
| DDR-D-001 | 認証済みユーザーが削除リクエストを削除 | 失敗 | 高 | CF経由のみ |

---

## 11. 管理者専用コレクション検証項目

### 11.1 AuditLogs コレクション

**パス**: `/auditLogs/{logId}`

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| AL-R-001 | admin=true のユーザーが読み取り | 成功 | 高 |
| AL-R-002 | admin=false のユーザーが読み取り | 失敗 | 高 |
| AL-R-003 | 未認証ユーザーが読み取り | 失敗 | 高 |
| AL-C-001 | admin=true のユーザーが作成 | 失敗 | 高 |
| AL-U-001 | admin=true のユーザーが更新 | 失敗 | 高 |
| AL-D-001 | admin=true のユーザーが削除 | 失敗 | 高 |

### 11.2 CustomClaimsLogs コレクション

**パス**: `/customClaimsLogs/{logId}`

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| CCL-R-001 | admin=true のユーザーが読み取り | 成功 | 高 |
| CCL-R-002 | admin=false のユーザーが読み取り | 失敗 | 高 |
| CCL-C-001 | admin=true のユーザーが作成 | 失敗 | 高 |

### 11.3 AdminUsers コレクション

**パス**: `/adminUsers/{userId}`

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| AU-R-001 | admin=true のユーザーが読み取り | 成功 | 高 |
| AU-R-002 | admin=false のユーザーが読み取り | 失敗 | 高 |
| AU-C-001 | admin=true のユーザーが作成 | 成功 | 高 |
| AU-U-001 | admin=true のユーザーが更新 | 成功 | 高 |
| AU-D-001 | admin=true のユーザーが削除 | 成功 | 高 |
| AU-C-002 | admin=false のユーザーが作成 | 失敗 | 高 |

### 11.4 BigQuerySyncFailures コレクション

**パス**: `/bigquerySyncFailures/{failureId}`

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| BQSF-R-001 | admin=true のユーザーが読み取り | 成功 | 高 |
| BQSF-R-002 | admin=false のユーザーが読み取り | 失敗 | 高 |
| BQSF-C-001 | admin=true のユーザーが作成 | 成功 | 高 |
| BQSF-U-001 | admin=true のユーザーが更新 | 成功 | 高 |
| BQSF-D-001 | admin=true のユーザーが削除 | 成功 | 高 |

### 11.5 SecurityIncidents コレクション

**パス**: `/securityIncidents/{incidentId}`

| テストID | テスト項目 | 期待結果 | 優先度 | GDPR関連 |
|---------|----------|---------|--------|---------|
| SI-R-001 | admin=true のユーザーが読み取り | 成功 | 高 | インシデント管理 |
| SI-R-002 | admin=false のユーザーが読み取り | 失敗 | 高 | - |
| SI-C-001 | admin=true のユーザーが作成 | 成功 | 高 | - |
| SI-U-001 | admin=true のユーザーが更新 | 成功 | 高 | - |
| SI-D-001 | admin=true のユーザーが削除 | 成功 | 高 | - |

### 11.6 RateLimits コレクション

**パス**: `/rateLimits/{limitId}`

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| RL-R-001 | admin=true のユーザーが読み取り | 失敗 | 高 |
| RL-R-002 | 認証済みユーザーが読み取り | 失敗 | 高 |
| RL-R-003 | 未認証ユーザーが読み取り | 失敗 | 高 |
| RL-C-001 | admin=true のユーザーが作成 | 失敗 | 高 |
| RL-U-001 | admin=true のユーザーが更新 | 失敗 | 高 |

---

## 12. バリデーション関数テスト

### 12.1 validateUserCreate()

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| VUC-001 | 全必須フィールドを含む有効なデータ | 成功 | 高 |
| VUC-002 | nickname フィールド欠落 | 失敗 | 高 |
| VUC-003 | email フィールド欠落 | 失敗 | 高 |
| VUC-004 | tosAccepted フィールド欠落 | 失敗 | 高 |
| VUC-005 | ppAccepted フィールド欠落 | 失敗 | 高 |
| VUC-006 | createdAt フィールド欠落 | 失敗 | 高 |
| VUC-007 | updatedAt フィールド欠落 | 失敗 | 高 |
| VUC-008 | nickname="" (空文字) | 失敗 | 中 |
| VUC-009 | nickname が50文字 | 成功 | 中 |
| VUC-010 | nickname が51文字 | 失敗 | 中 |

### 12.2 validateSessionCreate()

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| VSC-001 | 全必須フィールドを含む有効なデータ | 成功 | 高 |
| VSC-002 | sessionId フィールド欠落 | 失敗 | 高 |
| VSC-003 | userId フィールド欠落 | 失敗 | 高 |
| VSC-004 | exerciseType フィールド欠落 | 失敗 | 高 |
| VSC-005 | startTime フィールド欠落 | 失敗 | 高 |
| VSC-006 | status フィールド欠落 | 失敗 | 高 |
| VSC-007 | createdAt フィールド欠落 | 失敗 | 高 |
| VSC-008 | userId が認証ユーザーと異なる | 失敗 | 高 |
| VSC-009 | status='active' 以外の値 | 失敗 | 高 |

### 12.3 validateFrameCreate()

| テストID | テスト項目 | 期待結果 | 優先度 |
|---------|----------|---------|--------|
| VFC-001 | 全必須フィールドを含む有効なデータ | 成功 | 高 |
| VFC-002 | landmarks が33要素 | 成功 | 高 |
| VFC-003 | landmarks が32要素 | 失敗 | 高 |
| VFC-004 | landmarks が34要素 | 失敗 | 高 |
| VFC-005 | landmarks が配列でない | 失敗 | 高 |
| VFC-006 | frameNumber=0 | 成功 | 中 |
| VFC-007 | frameNumber=-1 | 失敗 | 中 |

---

## 13. テストデータテンプレート

### 13.1 有効なユーザーデータ

```typescript
const validUserData = {
  nickname: "TestUser",
  email: "test@example.com",
  tosAccepted: true,
  ppAccepted: true,
  deletionScheduled: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
};
```

### 13.2 有効なセッションデータ

```typescript
const validSessionData = {
  sessionId: "session123",
  userId: "user123", // 認証ユーザーのUID
  exerciseType: "squat",
  startTime: firebase.firestore.FieldValue.serverTimestamp(),
  status: "active",
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
};
```

### 13.3 有効なフレームデータ

```typescript
const validFrameData = {
  frameId: "frame123",
  sessionId: "session123",
  frameNumber: 0,
  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  landmarks: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1.0 }),
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
};
```

### 13.4 削除予定ユーザーデータ

```typescript
const deletionScheduledUserData = {
  ...validUserData,
  deletionScheduled: true,
  deletionScheduledAt: firebase.firestore.FieldValue.serverTimestamp(),
  scheduledDeletionDate: firebase.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  ),
};
```

### 13.5 テスト用認証コンテキスト

```typescript
// 通常ユーザー
const authenticatedUser = testEnv.authenticatedContext("user123");

// 管理者ユーザー
const adminUser = testEnv.authenticatedContext("admin123", {
  admin: true,
});

// 未認証ユーザー
const unauthenticatedUser = testEnv.unauthenticatedContext();

// 削除予定ユーザー（事前にFirestoreにデータ設定が必要）
const deletionScheduledUser = testEnv.authenticatedContext("deletionUser123");
```

---

## テスト実行コマンド

```bash
# エミュレータ起動（別ターミナル）
firebase emulators:start --only firestore

# テスト実行
npm run test:rules

# カバレッジ付きテスト実行
npm run test:rules:coverage
```

---

## 検証項目サマリー

| コレクション | Read | Create | Update | Delete | 合計 |
|-------------|------|--------|--------|--------|------|
| Users | 4 | 10 | 17 | 3 | 34 |
| Users (Profile) | - | - | 19 | - | 19 |
| Sessions | 4 | 14 | 19 | 2 | 39 |
| Frames | 4 | 10 | 2 | 2 | 18 |
| Settings | 3 | 3 | 3 | 2 | 11 |
| Subscriptions | 3 | 2 | 1 | 1 | 7 |
| Consents | 4 | 2 | 1 | 1 | 8 |
| Notifications | 3 | 1 | 7 | 1 | 12 |
| DataDeletionRequests | 3 | 1 | 1 | 1 | 6 |
| AuditLogs | 3 | 1 | 1 | 1 | 6 |
| CustomClaimsLogs | 2 | 1 | - | - | 3 |
| AdminUsers | 2 | 2 | 1 | 1 | 6 |
| BigQuerySyncFailures | 2 | 1 | 1 | 1 | 5 |
| SecurityIncidents | 2 | 1 | 1 | 1 | 5 |
| RateLimits | 3 | 1 | 1 | - | 5 |
| ヘルパー関数 | - | - | - | - | 16 |
| バリデーション関数 | - | - | - | - | 17 |
| **合計** | **42** | **50** | **73** | **17** | **217** |

---

## 参考リンク

- [Firebase Security Rules ドキュメント](https://firebase.google.com/docs/rules)
- [@firebase/rules-unit-testing](https://firebase.google.com/docs/rules/unit-tests)
- [Firestore Security Rules Cookbook](https://firebase.google.com/docs/firestore/security/rules-structure)
