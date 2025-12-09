# 002 Firestore Security Rules実装

## 概要

Firestoreデータベースへのアクセスを制御するセキュリティルールを実装するチケットです。「誰が」「どのデータに」「何をできるか」を細かく設定することで、ユーザーのデータを安全に守ります。

例えば、「自分のプロフィールは自分だけが見られる」「他の人のトレーニング記録は見られない」といったルールを設定します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001（Firebase環境確認）

## 要件

### 機能要件

- FR-024: 同意管理 - 同意フィールドの読み取り専用保護
- FR-025: データ削除権 - 削除予定ユーザーの書き込み制限

### 非機能要件

- NFR-012: アクセス制御 - Cloud IAMによる細かなアクセス管理
- NFR-034: Firestoreセキュリティルール詳細 - フィールドレベルの制御

## 受け入れ条件（Todo）

- [x] usersコレクションの基本ルール（本人のみ読み書き）を実装
- [ ] usersコレクションのフィールドレベル制御を実装
  - [ ] tosAccepted, ppAccepted は読み取り専用
  - [ ] deletionScheduled はCloud Functionsのみ変更可能
- [ ] sessionsサブコレクションのルールを実装
- [ ] consentsコレクションのルール（本人読み取り専用、作成はCloud Functionsのみ）を実装
- [ ] dataDeletionRequestsコレクションのルールを実装
- [ ] bigquerySyncFailuresコレクションのルール（管理者のみ）を実装
- [ ] 削除予定ユーザーの書き込み禁止ルールを実装
- [ ] セキュリティルールのユニットテストを作成
- [ ] エミュレータでテストが全て通ることを確認

## 参照ドキュメント

- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データ構造とセキュリティルール詳細
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針

## 技術詳細

### セキュリティルールの基本構造

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // === ヘルパー関数 ===

    // 認証済みかどうか
    function isAuthenticated() {
      return request.auth != null;
    }

    // 本人かどうか
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // 削除予定でないかどうか
    function isNotScheduledForDeletion() {
      return !resource.data.deletionScheduled;
    }

    // 同意フィールドが変更されていないか
    function consentFieldsUnchanged() {
      return request.resource.data.tosAccepted == resource.data.tosAccepted
          && request.resource.data.tosAcceptedAt == resource.data.tosAcceptedAt
          && request.resource.data.tosVersion == resource.data.tosVersion
          && request.resource.data.ppAccepted == resource.data.ppAccepted
          && request.resource.data.ppAcceptedAt == resource.data.ppAcceptedAt
          && request.resource.data.ppVersion == resource.data.ppVersion;
    }

    // === Usersコレクション ===
    match /users/{userId} {
      // 読み取り: 認証済み + 本人のみ
      allow read: if isAuthenticated() && isOwner(userId);

      // 作成: 認証済み + 本人 + 同意必須
      allow create: if isAuthenticated()
                    && isOwner(userId)
                    && request.resource.data.tosAccepted == true
                    && request.resource.data.ppAccepted == true;

      // 更新: 認証済み + 本人 + 削除予定でない + 同意フィールド変更禁止
      allow update: if isAuthenticated()
                    && isOwner(userId)
                    && isNotScheduledForDeletion()
                    && consentFieldsUnchanged();

      // 削除: Cloud Functionsのみ（クライアントからは不可）
      allow delete: if false;

      // === Sessionsサブコレクション ===
      match /sessions/{sessionId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow write: if isAuthenticated()
                     && isOwner(userId)
                     && isNotScheduledForDeletion();

        // === Framesサブコレクション ===
        match /frames/{frameId} {
          allow read: if isAuthenticated() && isOwner(userId);
          allow write: if isAuthenticated()
                       && isOwner(userId)
                       && isNotScheduledForDeletion();
        }
      }

      // === Subscriptionsサブコレクション ===
      match /subscriptions/{subscriptionId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow write: if false;  // Cloud Functionsのみ
      }
    }

    // === Consentsコレクション ===
    match /consents/{consentId} {
      // 読み取り: 認証済み + 本人のデータのみ
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      // 書き込み: Cloud Functionsのみ
      allow write: if false;
    }

    // === DataDeletionRequestsコレクション ===
    match /dataDeletionRequests/{requestId} {
      // 読み取り: 認証済み + 本人のデータのみ
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      // 書き込み: Cloud Functionsのみ
      allow write: if false;
    }

    // === BigQuerySyncFailuresコレクション ===
    match /bigquerySyncFailures/{failureId} {
      // 管理者のみ（Cloud Functions経由）
      allow read, write: if false;
    }
  }
}
```

### テスト方法

```bash
# Firebase エミュレータでテスト
cd firebase
npm test

# または
firebase emulators:exec --only firestore "npm test"
```

### テストコード例

```typescript
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "test-project",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  test("本人は自分のプロフィールを読める", async () => {
    const userId = "user123";
    const context = testEnv.authenticatedContext(userId);
    const db = context.firestore();

    await assertSucceeds(
      db.collection("users").doc(userId).get()
    );
  });

  test("他人のプロフィールは読めない", async () => {
    const userId = "user123";
    const otherId = "other456";
    const context = testEnv.authenticatedContext(userId);
    const db = context.firestore();

    await assertFails(
      db.collection("users").doc(otherId).get()
    );
  });

  test("同意フィールドは変更できない", async () => {
    const userId = "user123";
    const context = testEnv.authenticatedContext(userId);
    const db = context.firestore();

    await assertFails(
      db.collection("users").doc(userId).update({
        tosAccepted: false
      })
    );
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 進行中

## 備考

- 現在は開発用の全許可ルール（`allow read, write: if true;`）になっている
- このチケットで本番用の厳格なルールに置き換える
- セキュリティルールはFirestoreの読み書きを制御するが、Cloud FunctionsからのアクセスはAdmin SDKを使うため制限を受けない

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
