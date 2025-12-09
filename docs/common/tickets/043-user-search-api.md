# 043 ユーザー検索API

## 概要

管理者が特定のユーザーを素早く見つけるための検索APIを実装するチケットです。メールアドレス、ユーザーID、名前などで検索できる機能を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 042: ユーザー管理API

## 要件

### 機能要件

- FR-041: ユーザー検索（管理者向け）

### 非機能要件

- NFR-038: 管理者認証
- NFR-040: IPアドレス制限

## 受け入れ条件（Todo）

### メールアドレス検索API

- [ ] メールアドレスによる完全一致検索を実装
- [ ] 部分一致検索を実装（例: "test@example"で"test@example.com"が見つかる）
- [ ] 検索結果に基本情報（UID、メール、登録日）を含める
- [ ] 大文字・小文字を区別しない検索を実装

### ユーザーID検索API

- [ ] ユーザーID（Firebase UID）による完全一致検索を実装
- [ ] UIDの前方一致検索を実装
- [ ] 検索結果にユーザーの詳細情報を含める

### 名前検索API

- [ ] 表示名（displayName）による部分一致検索を実装
- [ ] ひらがな・カタカナ・漢字の検索に対応
- [ ] 複数の検索結果を返す機能を実装（最大100件）

### 複合検索API

- [ ] 複数の条件を組み合わせた検索を実装
- [ ] 検索条件: メール、名前、登録日範囲、ステータス、プラン
- [ ] AND/OR条件の指定を可能にする
- [ ] 検索結果のページング機能を実装

### テスト

- [ ] メールアドレス検索のユニットテストを作成
- [ ] ユーザーID検索のユニットテストを作成
- [ ] 名前検索のユニットテストを作成
- [ ] 複合検索のユニットテストを作成
- [ ] 権限不足時のエラーハンドリングテストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - 管理者機能（セクション14）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 管理者機能向け要件（セクション15）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション構造

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| メールアドレス検索 | GET | /admin/users/search/email | admin以上 |
| ユーザーID検索 | GET | /admin/users/search/uid | admin以上 |
| 名前検索 | GET | /admin/users/search/name | admin以上 |
| 複合検索 | POST | /admin/users/search | admin以上 |

### メールアドレス検索API

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * メールアドレスでユーザーを検索する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.email - 検索するメールアドレス（部分一致可）
 * @param data.exactMatch - 完全一致検索かどうか（デフォルト: false）
 */
export const searchUsersByEmail = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { email, exactMatch = false } = request.data;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "検索するメールアドレスを指定してください"
    );
  }

  // メールアドレスを小文字に変換（大文字・小文字を区別しない検索）
  const searchEmail = email.toLowerCase();

  let query = admin.firestore().collection("users");

  if (exactMatch) {
    // 完全一致検索
    query = query.where("email", "==", searchEmail);
  } else {
    // 部分一致検索（前方一致）
    query = query
      .where("email", ">=", searchEmail)
      .where("email", "<=", searchEmail + "\uf8ff");
  }

  const snapshot = await query.limit(100).get();

  const users = snapshot.docs.map((doc) => ({
    userId: doc.id,
    email: doc.data().email,
    displayName: doc.data().displayName,
    createdAt: doc.data().createdAt,
    subscriptionStatus: doc.data().subscriptionStatus,
    disabled: doc.data().disabled || false,
    deletionScheduled: doc.data().deletionScheduled || false,
  }));

  return {
    users,
    count: users.length,
    searchTerm: email,
    exactMatch,
  };
});
```

### ユーザーID検索API

```typescript
/**
 * ユーザーID（Firebase UID）でユーザーを検索する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.userId - 検索するユーザーID（部分一致可）
 */
export const searchUsersByUid = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError(
      "invalid-argument",
      "検索するユーザーIDを指定してください"
    );
  }

  // 完全一致の場合は直接取得
  try {
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      return {
        users: [
          {
            userId: userDoc.id,
            email: userData?.email,
            displayName: userData?.displayName,
            createdAt: userData?.createdAt,
            subscriptionStatus: userData?.subscriptionStatus,
            disabled: userData?.disabled || false,
            deletionScheduled: userData?.deletionScheduled || false,
          },
        ],
        count: 1,
        searchTerm: userId,
      };
    }
  } catch (error) {
    // 完全一致で見つからない場合は部分一致検索を試みる
  }

  // 部分一致検索（UIDの前方一致）
  const snapshot = await admin
    .firestore()
    .collection("users")
    .where(admin.firestore.FieldPath.documentId(), ">=", userId)
    .where(admin.firestore.FieldPath.documentId(), "<=", userId + "\uf8ff")
    .limit(100)
    .get();

  const users = snapshot.docs.map((doc) => ({
    userId: doc.id,
    email: doc.data().email,
    displayName: doc.data().displayName,
    createdAt: doc.data().createdAt,
    subscriptionStatus: doc.data().subscriptionStatus,
    disabled: doc.data().disabled || false,
    deletionScheduled: doc.data().deletionScheduled || false,
  }));

  return {
    users,
    count: users.length,
    searchTerm: userId,
  };
});
```

### 名前検索API

```typescript
/**
 * 表示名でユーザーを検索する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.displayName - 検索する表示名（部分一致）
 */
export const searchUsersByName = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const { displayName } = request.data;

  if (!displayName) {
    throw new HttpsError(
      "invalid-argument",
      "検索する名前を指定してください"
    );
  }

  // 部分一致検索（前方一致）
  const snapshot = await admin
    .firestore()
    .collection("users")
    .where("displayName", ">=", displayName)
    .where("displayName", "<=", displayName + "\uf8ff")
    .limit(100)
    .get();

  const users = snapshot.docs.map((doc) => ({
    userId: doc.id,
    email: doc.data().email,
    displayName: doc.data().displayName,
    createdAt: doc.data().createdAt,
    subscriptionStatus: doc.data().subscriptionStatus,
    disabled: doc.data().disabled || false,
    deletionScheduled: doc.data().deletionScheduled || false,
  }));

  return {
    users,
    count: users.length,
    searchTerm: displayName,
  };
});
```

### 複合検索API

```typescript
/**
 * 複数条件でユーザーを検索する（管理者専用）
 *
 * @param data - リクエストパラメータ
 * @param data.email - メールアドレス（部分一致）
 * @param data.displayName - 表示名（部分一致）
 * @param data.status - ステータス（active, disabled, deletionScheduled）
 * @param data.plan - プラン（free, premium）
 * @param data.createdAfter - 登録日（この日以降）
 * @param data.createdBefore - 登録日（この日以前）
 * @param data.page - ページ番号（デフォルト: 1）
 * @param data.limit - 1ページあたりの件数（デフォルト: 50、最大: 100）
 */
export const searchUsers = onCall(async (request) => {
  // 管理者認証チェック
  const role = request.auth?.token?.role;
  if (!role || !["admin", "superAdmin", "readOnlyAdmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "この操作には管理者権限が必要です"
    );
  }

  const {
    email,
    displayName,
    status,
    plan,
    createdAfter,
    createdBefore,
    page = 1,
    limit = 50,
  } = request.data;

  // バリデーション
  if (limit > 100) {
    throw new HttpsError(
      "invalid-argument",
      "limitは最大100までです"
    );
  }

  // Firestoreクエリを構築
  let query = admin.firestore().collection("users");

  // 各条件を適用
  if (email) {
    const searchEmail = email.toLowerCase();
    query = query
      .where("email", ">=", searchEmail)
      .where("email", "<=", searchEmail + "\uf8ff");
  }

  if (displayName) {
    query = query
      .where("displayName", ">=", displayName)
      .where("displayName", "<=", displayName + "\uf8ff");
  }

  if (status) {
    if (status === "deletionScheduled") {
      query = query.where("deletionScheduled", "==", true);
    } else if (status === "disabled") {
      query = query.where("disabled", "==", true);
    } else if (status === "active") {
      query = query
        .where("deletionScheduled", "==", false)
        .where("disabled", "==", false);
    }
  }

  if (plan) {
    query = query.where("subscriptionStatus", "==", plan);
  }

  if (createdAfter) {
    query = query.where("createdAt", ">=", new Date(createdAfter));
  }

  if (createdBefore) {
    query = query.where("createdAt", "<=", new Date(createdBefore));
  }

  // ページング
  const offset = (page - 1) * limit;
  query = query.offset(offset).limit(limit);

  // データ取得
  const snapshot = await query.get();
  const users = snapshot.docs.map((doc) => ({
    userId: doc.id,
    email: doc.data().email,
    displayName: doc.data().displayName,
    createdAt: doc.data().createdAt,
    subscriptionStatus: doc.data().subscriptionStatus,
    disabled: doc.data().disabled || false,
    deletionScheduled: doc.data().deletionScheduled || false,
  }));

  return {
    users,
    count: users.length,
    page,
    limit,
    filters: {
      email,
      displayName,
      status,
      plan,
      createdAfter,
      createdBefore,
    },
  };
});
```

### Firestoreインデックス設定

複合検索を効率的に行うため、以下のインデックスを設定します。

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "displayName", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subscriptionStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Firestoreの検索機能は限定的なため、部分一致検索は前方一致のみ対応しています
- より高度な全文検索が必要な場合は、Algolia や Elasticsearch の導入を検討してください
- 検索結果は最大100件までに制限されています（パフォーマンス考慮）
- 日本語名の検索は、入力された文字と完全に一致する形式（ひらがな・カタカナ・漢字）で検索されます

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
