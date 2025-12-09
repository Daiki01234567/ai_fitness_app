# 009 レート制限・DDoS対策

## 概要

Firebase Cloud FunctionsのAPIエンドポイントに対するレート制限を実装し、DDoS攻撃やスパム行為からシステムを保護するチケットです。Firebase App CheckとCloud Armorを統合し、IPベースのレート制限、ユーザーベースのレート制限、エンドポイントごとの制限を実装します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築
- 005: 認証ミドルウェア実装

## 要件

### 機能要件

- なし（基盤機能のため）

### 非機能要件

- NFR-026: DDoS対策 - レート制限、IPブロック

## 受け入れ条件（Todo）

- [ ] レート制限ミドルウェアの実装（Redis使用）
- [ ] IPベースのレート制限実装
- [ ] ユーザーベースのレート制限実装
- [ ] エンドポイント別のレート制限設定
- [ ] Firebase App Check統合（モバイルアプリ認証）
- [ ] レート制限超過時のエラーレスポンス実装
- [ ] レート制限状況の監視ダッシュボード作成
- [ ] IPブロックリスト管理機能の実装
- [ ] レート制限のテスト（単体テスト、負荷テスト）
- [ ] ドキュメント作成（レート制限ポリシー、対応手順）

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - レート制限詳細
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-026
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件

## 技術詳細

### レート制限ポリシー

#### API別のレート制限

| API | 制限 | 時間窓 | 対象 |
|-----|------|--------|------|
| **認証系** | | | |
| `auth_signUp` | 10回 | 1時間 | IP |
| `auth_login` | 20回 | 1時間 | IP |
| `auth_resetPassword` | 5回 | 1時間 | IP |
| **ユーザー管理系** | | | |
| `user_updateProfile` | 50回 | 1時間 | ユーザー |
| `user_getProfile` | 100回 | 1時間 | ユーザー |
| **トレーニング系** | | | |
| `training_createSession` | 100回 | 1日 | ユーザー |
| `training_completeSession` | 100回 | 1日 | ユーザー |
| **GDPR系** | | | |
| `gdpr_requestDataExport` | 3回 | 1ヶ月 | ユーザー |
| `gdpr_requestAccountDeletion` | 3回 | 1ヶ月 | ユーザー |

### レート制限ミドルウェア実装

#### Redisを使用したレート制限

```typescript
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import Redis from 'ioredis';

// Redis接続（Cloud Memorystore）
const redis = new Redis(process.env.REDIS_URL!);

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  maxRequests: number;  // 最大リクエスト数
  windowMs: number;     // 時間窓（ミリ秒）
  keyPrefix: string;    // Redisキープレフィックス
  skipSuccessfulRequests?: boolean;  // 成功リクエストをスキップ
}

/**
 * レート制限ミドルウェア
 * @param config - レート制限設定
 * @param request - Callable関数のリクエスト
 * @throws HttpsError - レート制限超過時
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  request: CallableRequest
): Promise<void> {
  const key = buildRateLimitKey(config, request);

  // 現在のリクエスト数を取得
  const currentCount = await redis.get(key);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  if (count >= config.maxRequests) {
    // TTLを取得（残り時間）
    const ttl = await redis.ttl(key);
    const retryAfter = Math.ceil(ttl);

    throw new HttpsError(
      'resource-exhausted',
      `レート制限に達しました。${retryAfter}秒後に再試行してください。`,
      {
        retryAfter,
        limit: config.maxRequests,
        windowMs: config.windowMs,
      }
    );
  }

  // カウンターをインクリメント
  const multi = redis.multi();
  multi.incr(key);

  // 初回リクエストの場合、有効期限を設定
  if (count === 0) {
    multi.pexpire(key, config.windowMs);
  }

  await multi.exec();
}

/**
 * レート制限キーを生成
 * @param config - レート制限設定
 * @param request - Callable関数のリクエスト
 * @returns Redisキー
 */
function buildRateLimitKey(config: RateLimitConfig, request: CallableRequest): string {
  const ip = request.rawRequest.ip || 'unknown';
  const userId = request.auth?.uid || 'anonymous';

  // IPベースのレート制限（認証前のAPI）
  if (!request.auth) {
    return `${config.keyPrefix}:ip:${ip}`;
  }

  // ユーザーベースのレート制限（認証後のAPI）
  return `${config.keyPrefix}:user:${userId}`;
}
```

#### エンドポイント別の設定

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { checkRateLimit } from '../middleware/rate-limit';

// 1時間に10回まで（IP単位）
export const auth_signUp = onCall(async (request) => {
  await checkRateLimit({
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,  // 1時間
    keyPrefix: 'auth_signUp',
  }, request);

  // ビジネスロジック
  // ...
});

// 1時間に50回まで（ユーザー単位）
export const user_updateProfile = onCall(async (request) => {
  await checkRateLimit({
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,  // 1時間
    keyPrefix: 'user_updateProfile',
  }, request);

  // ビジネスロジック
  // ...
});
```

### Firebase App Check統合

#### Firebase App Check設定

Firebase App Checkは、モバイルアプリが正規のアプリであることを検証する仕組みです。

```typescript
import { onCall } from 'firebase-functions/v2/https';

// App Check必須のAPI
export const user_updateProfile = onCall(
  { consumeAppCheckToken: true },
  async (request) => {
    // request.app には App Check トークンの情報が含まれる
    if (!request.app) {
      throw new HttpsError(
        'failed-precondition',
        'このAPIは正規のアプリからのみ呼び出せます。'
      );
    }

    // ビジネスロジック
    // ...
  }
);
```

#### Expo版（React Native）でのApp Check設定

```typescript
// app/_layout.tsx
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('<RECAPTCHA_SITE_KEY>'),
  isTokenAutoRefreshEnabled: true,
});
```

#### Flutter版でのApp Check設定

```dart
// lib/main.dart
import 'package:firebase_app_check/firebase_app_check.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.playIntegrity,
    appleProvider: AppleProvider.deviceCheck,
  );

  runApp(MyApp());
}
```

### IPブロックリスト管理

#### Firestoreでのブロックリスト管理

```typescript
// ブロックリストの追加
await admin.firestore().collection('blockedIPs').doc(ip).set({
  ip,
  reason: 'Suspicious activity detected',
  blockedAt: admin.firestore.FieldValue.serverTimestamp(),
  expiresAt: admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24時間後
  ),
});

// ブロックリストのチェック
async function isIPBlocked(ip: string): Promise<boolean> {
  const doc = await admin.firestore().collection('blockedIPs').doc(ip).get();
  if (!doc.exists) return false;

  const data = doc.data();
  const now = admin.firestore.Timestamp.now();

  // 有効期限切れの場合は削除
  if (data?.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
    await doc.ref.delete();
    return false;
  }

  return true;
}
```

### レート制限監視ダッシュボード

#### Cloud Monitoringでの監視

- **レート制限超過回数**: 時系列グラフ（API別）
- **ブロックされたIP数**: 日次グラフ
- **App Check失敗回数**: 時系列グラフ

#### アラート設定

| アラート名 | 条件 | 通知先 | 対応 |
|-----------|------|--------|------|
| **レート制限超過急増** | 超過回数 > 100回/分 | Slack | DDoS攻撃の可能性を調査 |
| **App Check失敗急増** | 失敗回数 > 50回/分 | Slack | 不正アプリの可能性を調査 |
| **特定IPからの大量リクエスト** | 同一IP > 500回/分 | メール | IPブロックを検討 |

### ディレクトリ構成

```
functions/
├── src/
│   ├── middleware/
│   │   ├── rate-limit.ts        # レート制限ミドルウェア
│   │   ├── app-check.ts         # App Checkミドルウェア
│   │   └── index.ts             # エクスポート
│   └── tests/
│       └── middleware/
│           └── rate-limit.test.ts  # テスト
```

## 見積もり

- 工数: 3日
- 難易度: 中〜高

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### Redisのセットアップ

レート制限にはRedis（Cloud Memorystore）を使用します。

```bash
# Cloud Memorystore インスタンス作成
gcloud redis instances create fitness-app-redis \
  --size=1 \
  --region=asia-northeast1 \
  --redis-version=redis_6_x

# 接続情報の取得
gcloud redis instances describe fitness-app-redis \
  --region=asia-northeast1 \
  --format="value(host)"
```

### レート制限のベストプラクティス

- **柔軟な設定**: API別に適切な制限値を設定
- **ユーザーへの通知**: レート制限に達した場合、`retryAfter`を返す
- **監視の重要性**: レート制限の状況を常に監視し、調整する
- **ホワイトリスト**: 管理者やテストユーザーはレート制限を緩和

### DDoS攻撃への対応フロー

1. **異常検知**: Cloud Monitoringのアラートで検知
2. **攻撃元特定**: ログから攻撃元のIPを特定
3. **IPブロック**: 攻撃元のIPをブロックリストに追加
4. **レート制限強化**: 一時的にレート制限を強化
5. **事後分析**: 攻撃パターンを分析し、対策を改善

### GDPR対応

レート制限のログには個人情報が含まれる可能性があるため、以下の対応が必要です：

- **IPアドレスの匿名化**: ログにIPアドレスを記録する場合は匿名化
- **保存期間制限**: ログは30日間で自動削除
- **アクセス制限**: ログへのアクセスは管理者のみに制限

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
