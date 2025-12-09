# 020 GDPR同意追跡API

## 概要

GDPR第6条（同意）を実装するチケットです。利用規約とプライバシーポリシーへの同意を記録・管理し、同意変更履歴を不変の監査ログとして保存します。同意撤回時には強制ログアウト機能も実装します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestoreセキュリティルール実装
- 004: ユーザープロフィールAPI

## 要件

### 機能要件

- FR-034: GDPR第6条（同意）対応

### 非機能要件

- NFR-008: データ最小化原則
- NFR-032: データ保護

## 受け入れ条件（Todo）

- [ ] `user_updateConsent` Callable Functionを実装
- [ ] `user_revokeConsent` Callable Functionを実装
- [ ] Usersコレクションの同意フィールド更新実装（tosAccepted、ppAccepted）
- [ ] Consentsコレクションへの履歴記録実装（不変ログ）
- [ ] IPアドレスとユーザーエージェントの記録実装
- [ ] 同意撤回時の強制ログアウト実装（リフレッシュトークン無効化）
- [ ] カスタムクレームによる強制ログアウト設定実装
- [ ] レート制限（10回/時、5回/日）を実装
- [ ] エラーハンドリング実装
- [ ] ユニットテスト実装（カバレッジ80%以上）
- [ ] ローカルエミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション5.2（user_updateConsent）、5.3（user_revokeConsent）
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セクション4.3.2（同意管理）、セクション6（Consentsコレクション）
- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-034
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠

## 技術詳細

### APIエンドポイント

#### 1. user_updateConsent

**目的**: 利用規約・プライバシーポリシーへの同意を記録

**リクエスト**:

```typescript
interface UpdateConsentRequest {
  tosAccepted: boolean;
  tosVersion: string;  // 例: "1.0"
  ppAccepted: boolean;
  ppVersion: string;   // 例: "1.0"
}
```

**レスポンス**:

```typescript
interface UpdateConsentResponse {
  success: true;
  message: string;
}
```

#### 2. user_revokeConsent

**目的**: 同意撤回と強制ログアウト

**リクエスト**:

```typescript
interface RevokeConsentRequest {
  // リクエストボディなし
}
```

**レスポンス**:

```typescript
interface RevokeConsentResponse {
  success: true;
  message: string;
  forceLogout: true;
}
```

### 実装例

#### user_updateConsent

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

export const user_updateConsent = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const { tosAccepted, tosVersion, ppAccepted, ppVersion } = request.data;

  // 2. バリデーション
  if (typeof tosAccepted !== 'boolean' || typeof ppAccepted !== 'boolean') {
    throw new HttpsError('invalid-argument', '同意フラグが無効です');
  }

  if (!tosVersion || !ppVersion) {
    throw new HttpsError('invalid-argument', 'バージョンが無効です');
  }

  // 3. Usersコレクションを更新（Cloud Functionsのみ可能）
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  await userRef.update({
    tosAccepted,
    tosAcceptedAt: tosAccepted ? FieldValue.serverTimestamp() : null,
    tosVersion: tosAccepted ? tosVersion : null,
    ppAccepted,
    ppAcceptedAt: ppAccepted ? FieldValue.serverTimestamp() : null,
    ppVersion: ppAccepted ? ppVersion : null,
    updatedAt: FieldValue.serverTimestamp()
  });

  // 4. Consentsコレクションに履歴を記録
  await recordConsentHistory(uid, 'tos', tosVersion, tosAccepted, request);
  await recordConsentHistory(uid, 'pp', ppVersion, ppAccepted, request);

  console.log(`Consent updated: userId=${uid}, tosAccepted=${tosAccepted}, ppAccepted=${ppAccepted}`);

  return {
    success: true,
    message: '同意情報を更新しました'
  };
});

/**
 * 同意履歴を記録（不変ログ）
 */
async function recordConsentHistory(
  userId: string,
  consentType: 'tos' | 'pp',
  version: string,
  accepted: boolean,
  request: any
): Promise<void> {
  const db = getFirestore();

  await db.collection('consents').add({
    userId,
    consentType,
    version,
    action: accepted ? 'accepted' : 'revoked',
    timestamp: FieldValue.serverTimestamp(),
    ipAddress: request.rawRequest?.ip || null,
    userAgent: request.rawRequest?.headers['user-agent'] || null
  });
}
```

#### user_revokeConsent

```typescript
export const user_revokeConsent = onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // 2. Usersコレクションで同意を撤回
  const db = getFirestore();
  await db.collection('users').doc(uid).update({
    tosAccepted: false,
    tosAcceptedAt: null,
    tosVersion: null,
    ppAccepted: false,
    ppAcceptedAt: null,
    ppVersion: null,
    forceLogout: true,
    forceLogoutAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  // 3. Consentsコレクションに履歴を記録
  await db.collection('consents').add({
    userId: uid,
    consentType: 'tos',
    version: null,
    action: 'revoked',
    timestamp: FieldValue.serverTimestamp(),
    ipAddress: request.rawRequest?.ip || null,
    userAgent: request.rawRequest?.headers['user-agent'] || null
  });

  await db.collection('consents').add({
    userId: uid,
    consentType: 'pp',
    version: null,
    action: 'revoked',
    timestamp: FieldValue.serverTimestamp(),
    ipAddress: request.rawRequest?.ip || null,
    userAgent: request.rawRequest?.headers['user-agent'] || null
  });

  // 4. リフレッシュトークンを無効化
  await admin.auth().revokeRefreshTokens(uid);

  // 5. カスタムクレームで強制ログアウト
  await admin.auth().setCustomUserClaims(uid, {
    forceLogout: true,
    forceLogoutAt: Date.now()
  });

  console.log(`Consent revoked: userId=${uid}`);

  return {
    success: true,
    message: '同意を撤回しました。即座にログアウトされます。',
    forceLogout: true
  };
});
```

### Firestoreセキュリティルール

#### 同意フィールドの保護

```javascript
match /users/{userId} {
  // 同意フィールドはCloud Functionsのみ変更可能
  allow update: if request.auth != null
                && request.auth.uid == userId
                // 同意フィールドは変更禁止
                && request.resource.data.tosAccepted == resource.data.tosAccepted
                && request.resource.data.tosAcceptedAt == resource.data.tosAcceptedAt
                && request.resource.data.tosVersion == resource.data.tosVersion
                && request.resource.data.ppAccepted == resource.data.ppAccepted
                && request.resource.data.ppAcceptedAt == resource.data.ppAcceptedAt
                && request.resource.data.ppVersion == resource.data.ppVersion;
}
```

#### Consentsコレクションの保護

```javascript
match /consents/{consentId} {
  // 本人のみ読み取り可能
  allow read: if request.auth != null
              && resource.data.userId == request.auth.uid;

  // 書き込みはCloud Functionsのみ
  allow write: if false;
}
```

### クライアント側の実装例

#### 強制ログアウトの検出

```typescript
// Expo/React Native
import { getAuth, onIdTokenChanged } from 'firebase/auth';

const auth = getAuth();

onIdTokenChanged(auth, async (user) => {
  if (user) {
    const idTokenResult = await user.getIdTokenResult();

    if (idTokenResult.claims.forceLogout) {
      // 強制ログアウト
      await auth.signOut();
      alert('同意が撤回されたため、ログアウトしました。');
    }
  }
});
```

### エラーハンドリング

| エラーコード | 発生条件 | HTTPステータス |
|------------|---------|---------------|
| `unauthenticated` | 認証されていない | 401 |
| `invalid-argument` | バリデーションエラー | 400 |
| `internal` | Firestore更新エラー | 500 |

### GDPR監査証跡

#### Consentsコレクションの照会

```typescript
// 特定ユーザーの同意履歴を取得
async function getConsentHistory(userId: string) {
  const snapshot = await db.collection('consents')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .get();

  return snapshot.docs.map(doc => doc.data());
}
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- IPアドレスの記録はGDPR監査用（同意取得の証明）
- Consentsコレクションは削除不可（不変ログ）
- 同意撤回後も履歴は保持（法的義務）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
