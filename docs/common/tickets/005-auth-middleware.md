# 005 認証ミドルウェア実装

## 概要

Firebase Cloud Functionsの全Callable関数で使用する認証ミドルウェアを実装するチケットです。JWT（JSON Web Token）の検証、認証チェック、カスタムクレームの検証、削除予定ユーザーのアクセス制御などを共通化し、セキュリティを強化します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 003: Firebase Authentication 統合

## 要件

### 機能要件

- FR-038: アクセス制御 - ユーザー自身のデータのみアクセス可能

### 非機能要件

- NFR-011: 認証 - JWT, OAuth 2.0による認証
- NFR-012: アクセス制御 - Cloud IAMによる細かいアクセス管理

## 受け入れ条件（Todo）

- [ ] 認証チェックミドルウェアの実装（`requireAuth`）
- [ ] カスタムクレーム検証ミドルウェアの実装（`requireRole`）
- [ ] 削除予定ユーザーのアクセス制御ミドルウェアの実装（`checkDeletionScheduled`）
- [ ] ユーザー自身のデータのみアクセス可能にするミドルウェアの実装（`requireOwnership`）
- [ ] 管理者権限チェックミドルウェアの実装（`requireAdmin`）
- [ ] ミドルウェアの単体テスト（カバレッジ80%以上）
- [ ] エラーハンドリングのテスト（未認証、権限不足、削除予定ユーザー）
- [ ] ドキュメント作成（JSDoc、使用例）

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - 認証・アクセス制御の詳細
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-011, NFR-012
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件

## 技術詳細

### ミドルウェア構成

#### 1. requireAuth（認証必須チェック）

全ての認証が必要なAPIで使用します。

```typescript
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/**
 * 認証チェックミドルウェア
 * @param request - Callable関数のリクエスト
 * @returns ユーザーID (uid)
 * @throws HttpsError - 認証されていない場合
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です。ログインしてください。');
  }
  return request.auth.uid;
}
```

#### 2. requireOwnership（所有権チェック）

リクエストしたユーザーが、操作対象のリソースの所有者であることを確認します。

```typescript
/**
 * 所有権チェックミドルウェア
 * @param request - Callable関数のリクエスト
 * @param resourceUserId - リソースの所有者のユーザーID
 * @throws HttpsError - 所有者でない場合
 */
export function requireOwnership(request: CallableRequest, resourceUserId: string): void {
  const uid = requireAuth(request);
  if (uid !== resourceUserId) {
    throw new HttpsError(
      'permission-denied',
      '他のユーザーのデータにアクセスする権限がありません。'
    );
  }
}
```

#### 3. checkDeletionScheduled（削除予定ユーザーチェック）

削除予定のユーザーは読み取り専用モードに制限します（書き込み操作を禁止）。

```typescript
import * as admin from 'firebase-admin';

/**
 * 削除予定ユーザーチェックミドルウェア
 * @param uid - ユーザーID
 * @throws HttpsError - 削除予定のユーザーの場合
 */
export async function checkDeletionScheduled(uid: string): Promise<void> {
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(uid)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません。');
  }

  const userData = userDoc.data();
  if (userData?.deletionScheduled === true) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、データを変更できません。削除をキャンセルする場合は設定画面から操作してください。'
    );
  }
}
```

#### 4. requireRole（ロールベースアクセス制御）

カスタムクレームで設定されたロール（管理者など）をチェックします。

```typescript
/**
 * ロールチェックミドルウェア
 * @param request - Callable関数のリクエスト
 * @param role - 必要なロール（例: 'admin', 'moderator'）
 * @throws HttpsError - 必要なロールがない場合
 */
export function requireRole(request: CallableRequest, role: string): void {
  requireAuth(request);

  const customClaims = request.auth?.token;
  if (!customClaims || customClaims[role] !== true) {
    throw new HttpsError(
      'permission-denied',
      `この操作には${role}権限が必要です。`
    );
  }
}
```

#### 5. requireAdmin（管理者権限チェック）

管理者のみがアクセスできる操作で使用します。

```typescript
/**
 * 管理者権限チェックミドルウェア
 * @param request - Callable関数のリクエスト
 * @throws HttpsError - 管理者でない場合
 */
export function requireAdmin(request: CallableRequest): void {
  requireRole(request, 'admin');
}
```

### 使用例

#### API関数での使用例

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { requireAuth, requireOwnership, checkDeletionScheduled } from '../middleware/auth';

export const user_updateProfile = onCall(async (request) => {
  // 1. 認証チェック
  const uid = requireAuth(request);

  // 2. 所有権チェック（自分のプロファイルのみ更新可能）
  requireOwnership(request, request.data.userId);

  // 3. 削除予定ユーザーチェック
  await checkDeletionScheduled(uid);

  // 4. ビジネスロジック
  // プロファイル更新処理...

  return { success: true };
});
```

### ディレクトリ構成

```
functions/
├── src/
│   ├── middleware/
│   │   ├── auth.ts              # 認証ミドルウェア
│   │   ├── index.ts             # エクスポート
│   └── tests/
│       └── middleware/
│           └── auth.test.ts     # 認証ミドルウェアのテスト
```

### テストケース

#### 認証チェックのテスト

- ✅ 認証済みユーザー: UIDを正しく返す
- ❌ 未認証ユーザー: `unauthenticated` エラーを投げる

#### 所有権チェックのテスト

- ✅ 所有者: チェックが通る
- ❌ 他のユーザー: `permission-denied` エラーを投げる

#### 削除予定ユーザーチェックのテスト

- ✅ 削除予定でないユーザー: チェックが通る
- ❌ 削除予定のユーザー: `permission-denied` エラーを投げる
- ❌ 存在しないユーザー: `not-found` エラーを投げる

#### ロールチェックのテスト

- ✅ 必要なロールを持つユーザー: チェックが通る
- ❌ ロールがないユーザー: `permission-denied` エラーを投げる
- ❌ 未認証ユーザー: `unauthenticated` エラーを投げる

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### セキュリティ上の注意点

- **認証チェックは必ず最初に実行**: すべての書き込み系APIで `requireAuth` を最初に呼び出してください
- **削除予定ユーザーは読み取り専用**: データ変更操作（create, update, delete）では必ず `checkDeletionScheduled` を呼び出してください
- **所有権チェックを忘れずに**: ユーザー自身のデータのみアクセスできるように `requireOwnership` を使用してください

### カスタムクレームについて

カスタムクレームは、Firebase Authenticationのトークンに追加情報を含める仕組みです。管理者権限などをトークンに含めることで、Cloud Functionsでの権限チェックが高速化されます。

**設定例**:

```typescript
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

### GDPR対応

削除予定ユーザーのアクセス制御は、GDPR第17条（削除権）に対応するための重要な機能です。30日間の猶予期間中は読み取り専用とすることで、ユーザーが誤って削除を依頼した場合に復旧できるようにしています。

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
