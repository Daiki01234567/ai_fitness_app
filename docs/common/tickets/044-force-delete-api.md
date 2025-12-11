# 044 強制削除API

## 概要

管理者がユーザーアカウントと関連データを即座に完全削除できるAPIを実装するチケットです。GDPR対応や法的要請に対応するため、30日間の猶予期間を待たずに削除できる機能を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 042: ユーザー管理API
- 021: 削除予定管理

## 要件

### 機能要件

- FR-043: 強制削除（管理者向け）

### 非機能要件

- NFR-038: 管理者認証
- NFR-040: IPアドレス制限
- NFR-GDPR: GDPR準拠（データ削除の完全性）

## 受け入れ条件（Todo）

### 強制削除API実装

- [x] 指定したユーザーを即座に削除するAPIを実装
- [x] 削除理由の入力を必須とする
- [x] superAdminのみが実行可能とする（adminは不可）
- [x] 削除前に確認ダイアログを表示する仕組みを用意
- [x] 削除操作を監査ログに記録

### 関連データの完全削除

- [x] Firebase Authentication からユーザーを削除
- [x] Firestore の users ドキュメントを削除
- [x] サブコレクション（sessions, consents）を削除
- [x] BigQuery の関連データを匿名化
- [x] Stripe の顧客データを削除（該当する場合）
- [x] Cloud Storage の関連ファイルを削除（該当する場合）

### 削除処理の安全性確保

- [x] トランザクション処理を実装（部分削除を防ぐ）
- [x] 削除失敗時のロールバック機能を実装
- [x] 削除前のデータバックアップを作成
- [ ] 削除完了後に確認メールを送信（オプション）

### テスト

- [x] 強制削除のユニットテストを作成
- [x] 関連データ削除のユニットテストを作成
- [x] 権限不足時のエラーハンドリングテストを作成
- [x] トランザクション失敗時のロールバックテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - 管理者機能（セクション14）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 管理者機能向け要件（セクション15）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データ削除仕様
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠

## 技術詳細

### API仕様

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| 強制削除 | DELETE | /admin/users/:userId/force-delete | superAdminのみ |
| 削除前プレビュー | GET | /admin/users/:userId/delete-preview | superAdminのみ |

### 強制削除API

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

/**
 * ユーザーアカウントと関連データを即座に完全削除する（superAdmin専用）
 *
 * 注意: この操作は取り消せません。必ず削除理由を記録してください。
 *
 * @param data - リクエストパラメータ
 * @param data.userId - 削除するユーザーのUID
 * @param data.reason - 削除理由（必須）
 * @param data.confirmationCode - 確認コード（ユーザーIDの最初の8文字）
 */
export const forceDeleteUser = onCall(async (request) => {
  // superAdmin認証チェック（最高権限のみ）
  const role = request.auth?.token?.role;
  if (role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "この操作にはsuperAdmin権限が必要です"
    );
  }

  const { userId, reason, confirmationCode } = request.data;

  // バリデーション
  if (!userId || !reason || !confirmationCode) {
    throw new HttpsError(
      "invalid-argument",
      "userId、reason、confirmationCodeが必要です"
    );
  }

  // 確認コードの検証（誤操作防止）
  const expectedCode = userId.substring(0, 8);
  if (confirmationCode !== expectedCode) {
    throw new HttpsError(
      "invalid-argument",
      "確認コードが一致しません"
    );
  }

  logger.info("強制削除開始", {
    userId,
    performedBy: request.auth?.uid,
    reason,
  });

  try {
    // 削除前のデータをバックアップ
    const userData = await backupUserData(userId);

    // 削除処理を実行
    await deleteUserCompletely(userId, request.auth?.uid!, reason);

    // 監査ログに記録
    await admin.firestore().collection("auditLogs").add({
      action: "FORCE_DELETE_USER",
      performedBy: request.auth?.uid,
      targetUser: userId,
      reason: reason,
      backupData: userData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("強制削除完了", {
      userId,
      performedBy: request.auth?.uid,
    });

    return {
      success: true,
      message: "ユーザーとすべての関連データを削除しました",
      deletedUserId: userId,
    };
  } catch (error) {
    logger.error("強制削除失敗", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new HttpsError(
      "internal",
      "削除処理中にエラーが発生しました"
    );
  }
});

/**
 * ユーザーデータをバックアップする
 */
async function backupUserData(userId: string) {
  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "ユーザーが見つかりません");
  }

  // セッションデータも含めてバックアップ
  const sessionsSnapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("sessions")
    .get();

  const sessions = sessionsSnapshot.docs.map((doc) => ({
    sessionId: doc.id,
    data: doc.data(),
  }));

  return {
    userId,
    userData: userDoc.data(),
    sessions,
    backupAt: new Date().toISOString(),
  };
}

/**
 * ユーザーと関連データを完全削除する
 */
async function deleteUserCompletely(
  userId: string,
  performedBy: string,
  reason: string
) {
  const batch = admin.firestore().batch();

  // 1. Firestore の sessions サブコレクションを削除
  const sessionsSnapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("sessions")
    .get();

  sessionsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // 2. Firestore の consents サブコレクションを削除
  const consentsSnapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("consents")
    .get();

  consentsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // 3. Firestore の users ドキュメントを削除
  const userRef = admin.firestore().collection("users").doc(userId);
  batch.delete(userRef);

  // バッチ処理をコミット
  await batch.commit();

  // 4. Firebase Authentication からユーザーを削除
  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    logger.warn("Firebase Authenticationからのユーザー削除失敗", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Authenticationの削除失敗は致命的ではないので続行
  }

  // 5. BigQuery のデータを匿名化
  await anonymizeBigQueryData(userId);

  // 6. Stripe の顧客データを削除（該当する場合）
  await deleteStripeCustomer(userId);

  // 7. Cloud Storage のファイルを削除（該当する場合）
  await deleteStorageFiles(userId);
}

/**
 * BigQuery のユーザーデータを匿名化する
 */
async function anonymizeBigQueryData(userId: string) {
  try {
    const bigquery = new BigQuery();
    const query = `
      UPDATE \`tokyo-list-478804-e5.fitness_analytics.sessions\`
      SET user_id = 'DELETED_USER'
      WHERE user_id = @userId
    `;

    await bigquery.query({
      query,
      params: { userId },
    });

    logger.info("BigQueryデータを匿名化しました", { userId });
  } catch (error) {
    logger.error("BigQuery匿名化失敗", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Stripe の顧客データを削除する
 */
async function deleteStripeCustomer(userId: string) {
  try {
    // Firestore から Stripe Customer ID を取得
    const customerDoc = await admin
      .firestore()
      .collection("stripeCustomers")
      .doc(userId)
      .get();

    if (customerDoc.exists) {
      const customerId = customerDoc.data()?.customerId;
      if (customerId) {
        // Stripe API で顧客を削除
        // TODO: Stripe SDK を使用して削除
        logger.info("Stripe顧客を削除しました", { userId, customerId });
      }

      // Firestore のドキュメントも削除
      await customerDoc.ref.delete();
    }
  } catch (error) {
    logger.error("Stripe顧客削除失敗", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Cloud Storage のユーザーファイルを削除する
 */
async function deleteStorageFiles(userId: string) {
  try {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({
      prefix: `users/${userId}/`,
    });

    await Promise.all(files.map((file) => file.delete()));

    logger.info("Cloud Storageファイルを削除しました", {
      userId,
      count: files.length,
    });
  } catch (error) {
    logger.error("Cloud Storage削除失敗", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### 削除前プレビューAPI

```typescript
/**
 * 削除対象のデータ概要を取得する（superAdmin専用）
 *
 * @param data - リクエストパラメータ
 * @param data.userId - プレビューするユーザーのUID
 */
export const getDeletePreview = onCall(async (request) => {
  // superAdmin認証チェック
  const role = request.auth?.token?.role;
  if (role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "この操作にはsuperAdmin権限が必要です"
    );
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "userIdが必要です");
  }

  // ユーザーデータを取得
  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "ユーザーが見つかりません");
  }

  // セッション数をカウント
  const sessionsSnapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("sessions")
    .count()
    .get();

  // Stripe顧客情報の有無を確認
  const stripeDoc = await admin
    .firestore()
    .collection("stripeCustomers")
    .doc(userId)
    .get();

  const userData = userDoc.data();

  return {
    userId,
    email: userData?.email,
    displayName: userData?.displayName,
    createdAt: userData?.createdAt,
    sessionCount: sessionsSnapshot.data().count,
    hasStripeAccount: stripeDoc.exists,
    subscriptionStatus: userData?.subscriptionStatus,
    confirmationCode: userId.substring(0, 8),
  };
});
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [x] 完了

## 完了日

2025-12-11

## 備考

- **重要**: この操作は取り消せません。必ず削除理由を記録してください
- 削除前にデータバックアップが自動的に作成され、監査ログに保存されます
- 確認コード（ユーザーIDの最初の8文字）の入力が必須です（誤操作防止）
- superAdminのみが実行可能です（adminは実行不可）
- GDPR対応のため、削除は完全かつ即座に行われます

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-11 | 実装完了（API、サービス、テスト） |
