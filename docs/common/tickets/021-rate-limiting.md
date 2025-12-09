# 021 レート制限実装

## 概要

APIへの過剰なアクセスを防ぐため、レート制限（アクセス回数の制限）を実装するチケットです。悪意のあるユーザーがサーバーに負荷をかけたり、パスワードを総当たりで試す攻撃（ブルートフォース攻撃）を防ぐことが目的です。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/003（Firebase Authentication統合）

## 要件

### 機能要件

- なし（セキュリティ強化チケットのため）

### 非機能要件

- NFR-035: レート制限 - 異常なリクエストを検出・遮断する
- NFR-026: DDoS対策 - 分散型サービス拒否攻撃への対策

## 受け入れ条件（Todo）

### 基本実装

- [ ] レート制限ミドルウェアを実装
- [ ] ユーザーIDベースのレート制限を実装
- [ ] IPアドレスベースのレート制限を実装
- [ ] APIごとに異なる制限値を設定できるようにする

### ブルートフォース対策

- [ ] ログイン失敗回数のカウント機能を実装
- [ ] 5回失敗で15分間のロックアウト機能を実装
- [ ] ロックアウト状態の解除機能を実装
- [ ] ロックアウト時の適切なエラーメッセージを返す

### 制限超過時の対応

- [ ] 429 (Too Many Requests) ステータスコードを返す
- [ ] Retry-Afterヘッダーで再試行可能時間を通知
- [ ] ログに制限超過を記録する
- [ ] 異常なパターン検出時にアラートを送信

### テスト

- [ ] レート制限の単体テストを作成
- [ ] 複数ユーザーでの並行テストを実施
- [ ] 制限超過時のレスポンス形式をテスト
- [ ] ロックアウト機能のテストを実施

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - レート制限の制限値一覧
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - レート制限・DDoS対策

## 技術詳細

### レート制限の設定値

API設計書に基づく制限値：

| API | 制限 | 時間窓 | 備考 |
|-----|------|--------|------|
| 認証系（auth_signUp等） | 10回 | 1時間/IP | スパム防止 |
| ユーザー管理系（user_updateProfile等） | 50回 | 1時間/ユーザー | 通常更新 |
| トレーニング系（training_createSession等） | 100回 | 1日/ユーザー | 1日の最大セッション数 |
| GDPR系（gdpr_requestDataExport等） | 3回 | 1ヶ月/ユーザー | 権利行使制限 |

### レート制限ミドルウェア実装例

```typescript
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface RateLimitConfig {
  maxRequests: number;      // 最大リクエスト数
  windowMs: number;         // 時間窓（ミリ秒）
  keyPrefix: string;        // キーのプレフィックス
}

/**
 * レート制限をチェックするミドルウェア
 * @param key ユーザーIDまたはIPアドレス
 * @param config レート制限設定
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<void> {
  const db = admin.firestore();
  const docRef = db.collection('rateLimits').doc(`${config.keyPrefix}_${key}`);

  const now = Date.now();
  const windowStart = now - config.windowMs;

  const doc = await docRef.get();
  const data = doc.data();

  if (data) {
    // 古いカウントをリセット
    if (data.windowStart < windowStart) {
      await docRef.set({
        count: 1,
        windowStart: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    // 制限超過チェック
    if (data.count >= config.maxRequests) {
      const retryAfterSeconds = Math.ceil((data.windowStart + config.windowMs - now) / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `リクエスト制限を超えました。${retryAfterSeconds}秒後に再試行してください。`
      );
    }

    // カウント増加
    await docRef.update({
      count: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // 新規カウント作成
    await docRef.set({
      count: 1,
      windowStart: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// 使用例
export const rateLimitConfigs = {
  auth: { maxRequests: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'auth' },
  user: { maxRequests: 50, windowMs: 60 * 60 * 1000, keyPrefix: 'user' },
  training: { maxRequests: 100, windowMs: 24 * 60 * 60 * 1000, keyPrefix: 'training' },
  gdpr: { maxRequests: 3, windowMs: 30 * 24 * 60 * 60 * 1000, keyPrefix: 'gdpr' }
};
```

### ブルートフォース対策実装例

```typescript
interface LoginAttempt {
  failedCount: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分

/**
 * ログイン失敗をチェックし、必要ならロックアウト
 * @param email メールアドレス
 */
async function checkLoginAttempts(email: string): Promise<void> {
  const db = admin.firestore();
  const docRef = db.collection('loginAttempts').doc(email);

  const doc = await docRef.get();
  const data = doc.data() as LoginAttempt | undefined;

  if (data) {
    const now = Date.now();

    // ロックアウト中かチェック
    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingMinutes = Math.ceil((data.lockedUntil - now) / 60000);
      throw new HttpsError(
        'resource-exhausted',
        `アカウントが一時的にロックされています。${remainingMinutes}分後に再試行してください。`
      );
    }
  }
}

/**
 * ログイン失敗を記録
 * @param email メールアドレス
 */
async function recordLoginFailure(email: string): Promise<void> {
  const db = admin.firestore();
  const docRef = db.collection('loginAttempts').doc(email);

  const doc = await docRef.get();
  const data = doc.data() as LoginAttempt | undefined;
  const now = Date.now();

  const failedCount = (data?.failedCount || 0) + 1;
  const lockedUntil = failedCount >= MAX_LOGIN_ATTEMPTS
    ? now + LOCKOUT_DURATION_MS
    : null;

  await docRef.set({
    failedCount,
    lockedUntil,
    lastAttempt: now
  });

  if (lockedUntil) {
    console.warn(`アカウントロックアウト: ${email} - ${MAX_LOGIN_ATTEMPTS}回の失敗`);
  }
}

/**
 * ログイン成功時に失敗カウントをリセット
 * @param email メールアドレス
 */
async function clearLoginAttempts(email: string): Promise<void> {
  const db = admin.firestore();
  await db.collection('loginAttempts').doc(email).delete();
}
```

### Firestoreコレクション構造

```
rateLimits/
├── auth_{ipAddress}/
│   ├── count: number
│   ├── windowStart: number (timestamp)
│   └── updatedAt: timestamp
├── user_{userId}/
│   └── ...
└── training_{userId}/
    └── ...

loginAttempts/
├── {email}/
│   ├── failedCount: number
│   ├── lockedUntil: number | null
│   └── lastAttempt: number
```

### エラーレスポンス形式

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_EXHAUSTED",
    "message": "リクエスト制限を超えました。3600秒後に再試行してください。",
    "details": {
      "retryAfter": 3600,
      "limitType": "auth",
      "maxRequests": 10,
      "windowMs": 3600000
    }
  }
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

- Firebase App Checkとの併用を検討（Phase 2後半）
- 本番環境では制限値を調整する可能性あり
- Cloud Armorとの連携はPhase 3で検討

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
