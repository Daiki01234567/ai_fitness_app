# 021 削除予定管理

## 概要

アカウント削除を予定しているユーザーの状態を管理し、30日間の猶予期間中は読み取り専用モードに切り替える機能を実装するチケットです。削除予定フラグ（`deletionScheduled`）の設定・解除と、それに応じたアクセス制御を行います。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestore セキュリティルール実装
- 018: GDPR データ削除リクエスト API

## 要件

### 機能要件

- FR-036: 削除予定フラグ（`deletionScheduled`）によるアクセス制御
- FR-037: 削除猶予期間中の通知

### 非機能要件

- NFR-010: GDPR準拠（削除権の実装）
- NFR-002: データ整合性の保証

## 受け入れ条件（Todo）

- [ ] `deletionScheduled`フラグをtrueに設定する機能を実装
- [ ] 削除予定日（`scheduledDeletionDate`）を30日後に設定
- [ ] 削除予定ユーザーの書き込み操作を拒否する機能を実装
- [ ] 削除予定ユーザーの読み取り操作は許可する
- [ ] 削除キャンセル機能を実装（`deletionScheduled`をfalseに戻す）
- [ ] Firestoreセキュリティルールで削除予定ユーザーの書き込みを制限
- [ ] 削除予定日時を記録する`deletionScheduledAt`フィールドの更新
- [ ] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-036, FR-037
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - GDPR対応API

## 技術詳細

### データモデル

Usersコレクションのフィールド:

```typescript
interface User {
  userId: string;
  deletionScheduled: boolean;  // 削除予定フラグ
  deletionScheduledAt: Timestamp | null;  // 削除予定設定日時
  scheduledDeletionDate: Timestamp | null;  // 削除実行予定日（30日後）
  // 他のフィールド...
}
```

### 実装例: 削除予定設定

```typescript
export const gdpr_requestAccountDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const now = admin.firestore.Timestamp.now();
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 30);  // 30日後

  await admin.firestore().collection('users').doc(uid).update({
    deletionScheduled: true,
    deletionScheduledAt: now,
    scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDate),
    updatedAt: now
  });

  return {
    success: true,
    data: {
      scheduledDeletionDate: scheduledDate.toISOString()
    },
    message: 'アカウント削除を予約しました。30日以内ならキャンセルできます。'
  };
});
```

### 実装例: 削除予定チェックミドルウェア

```typescript
async function checkDeletionScheduled(uid: string): Promise<boolean> {
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(uid)
    .get();

  return userDoc.data()?.deletionScheduled === true;
}

// 全ての書き込み系APIで使用
export const user_updateProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 削除予定ユーザーチェック
  if (await checkDeletionScheduled(uid)) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、データを変更できません。'
    );
  }

  // 処理...
});
```

### Firestoreセキュリティルール

```javascript
match /users/{userId} {
  // 削除予定ユーザーの書き込み禁止
  allow update: if request.auth.uid == userId
    && !resource.data.deletionScheduled;

  // 読み取りは許可
  allow read: if request.auth.uid == userId;
}
```

### 削除キャンセル機能

```typescript
export const gdpr_cancelAccountDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  await admin.firestore().collection('users').doc(uid).update({
    deletionScheduled: false,
    deletionScheduledAt: null,
    scheduledDeletionDate: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: 'アカウント削除をキャンセルしました。'
  };
});
```

## テスト観点

- 削除予定設定時に`scheduledDeletionDate`が30日後に設定されること
- 削除予定ユーザーが書き込み操作を実行すると`permission-denied`エラーが返ること
- 削除予定ユーザーが読み取り操作は正常に実行できること
- 削除キャンセル後は書き込み操作が再び可能になること
- Firestoreルールで削除予定ユーザーの書き込みが拒否されること

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

- この機能はGDPR第17条（削除権）の実装に必要です
- 削除予定ユーザーは30日間の猶予期間中にデータを確認できます
- 30日経過後のアカウント削除は、チケット019（データ削除スケジューラ）で実装します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
