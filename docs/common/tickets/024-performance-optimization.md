# 024 パフォーマンス最適化

## 概要

Cloud FunctionsのレスポンスタイムをAPI設計書の要件（95パーセンタイル200ms以内）を満たすように最適化するチケットです。コールドスタート対策、Firestore読み取りの最適化、メモリ使用量の調整などを行います。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/003（Firebase Authentication統合）

## 要件

### 機能要件

- なし（パフォーマンス改善チケットのため）

### 非機能要件

- NFR-021: レスポンス時間 - 95パーセンタイル200ms以内
- NFR-037: コールドスタート - 5秒以内（目標3秒以内）

## 受け入れ条件（Todo）

### コールドスタート対策

- [ ] 関数のグローバルスコープで重い初期化を避ける
- [ ] 必要に応じて関数を分割（バンドルサイズ削減）
- [ ] 依存パッケージの見直し（不要なパッケージ削除）
- [ ] 最小インスタンス数の設定（minInstances）

### Firestore読み取り最適化

- [ ] 必要なフィールドのみ取得（select句使用）
- [ ] バッチ読み取りの活用（getAll使用）
- [ ] クエリの最適化（複合インデックス活用）
- [ ] キャッシュ戦略の実装

### メモリ・CPU設定

- [ ] 各関数の適切なメモリ設定を決定
- [ ] CPU設定の最適化
- [ ] タイムアウト設定の見直し

### パフォーマンス計測

- [ ] レスポンスタイム計測の仕組みを実装
- [ ] パフォーマンスダッシュボードの作成
- [ ] アラートの設定（200ms超過時）
- [ ] 定期的なベンチマークテストの仕組み

### テスト

- [ ] 負荷テストの実施
- [ ] コールドスタート時間の計測
- [ ] 同時接続テストの実施
- [ ] メモリリークのチェック

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - パフォーマンス要件
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-021、NFR-037

## 技術詳細

### コールドスタートの原因と対策

コールドスタートとは、Cloud Functionsが一定時間使われないとインスタンスが終了し、次の呼び出し時に新しいインスタンスを起動する時間のことです。

**主な原因と対策**:

| 原因 | 対策 |
|------|------|
| 依存パッケージが多い | 必要最小限のパッケージに絞る |
| インポートが多い | 動的インポート（lazy import）を使う |
| グローバル初期化が重い | 初期化を遅延させる |
| メモリ設定が低い | 適切なメモリを設定する |

### グローバルスコープの最適化

```typescript
// NG: グローバルスコープで重い初期化
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { BigQuery } from '@google-cloud/bigquery';

admin.initializeApp();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const bigquery = new BigQuery();

// OK: 遅延初期化パターン
import * as admin from 'firebase-admin';

let stripeInstance: Stripe | null = null;
let bigqueryInstance: BigQuery | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const Stripe = require('stripe').default;
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeInstance;
}

function getBigQuery(): BigQuery {
  if (!bigqueryInstance) {
    const { BigQuery } = require('@google-cloud/bigquery');
    bigqueryInstance = new BigQuery();
  }
  return bigqueryInstance;
}

// 使用する関数でのみ初期化
export const stripe_createCheckoutSession = onCall(async (request) => {
  const stripe = getStripe();
  // ...
});
```

### 関数設定の最適化

```typescript
import { onCall } from 'firebase-functions/v2/https';

// 軽量なAPIの設定
export const user_getProfile = onCall({
  region: 'asia-northeast1',
  memory: '256MiB',          // デフォルトで十分
  timeoutSeconds: 30,
  maxInstances: 10,
  minInstances: 0            // コスト優先
}, async (request) => {
  // ...
});

// 重要なAPIの設定（コールドスタート軽減）
export const user_updateProfile = onCall({
  region: 'asia-northeast1',
  memory: '512MiB',          // 少し余裕を持たせる
  timeoutSeconds: 60,
  maxInstances: 10,
  minInstances: 1            // 常に1インスタンス維持
}, async (request) => {
  // ...
});

// 処理が重いAPIの設定
export const gdpr_requestDataExport = onCall({
  region: 'asia-northeast1',
  memory: '1GiB',            // データ処理に必要
  timeoutSeconds: 540,       // 9分（最大）
  maxInstances: 5,           // 同時実行を制限
  minInstances: 0
}, async (request) => {
  // ...
});
```

### Firestore読み取り最適化

```typescript
// NG: 全フィールド取得
const userDoc = await db.collection('users').doc(userId).get();
const displayName = userDoc.data()?.displayName;

// OK: 必要なフィールドのみ取得（select句使用）
const userDoc = await db.collection('users')
  .doc(userId)
  .select('displayName', 'email')
  .get();

// NG: 1件ずつ取得
const user1 = await db.collection('users').doc('user1').get();
const user2 = await db.collection('users').doc('user2').get();
const user3 = await db.collection('users').doc('user3').get();

// OK: バッチ取得（getAll使用）
const refs = ['user1', 'user2', 'user3'].map(id =>
  db.collection('users').doc(id)
);
const snapshots = await db.getAll(...refs);
```

### キャッシュ戦略

```typescript
// メモリ内キャッシュ（コールドスタート後のみ有効）
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

async function getCachedUser(userId: string): Promise<UserData | null> {
  // キャッシュチェック
  const cached = cache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as UserData;
  }

  // Firestoreから取得
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data() as UserData;

  // キャッシュに保存
  cache.set(userId, {
    data: userData,
    expiry: Date.now() + CACHE_TTL_MS
  });

  return userData;
}

// キャッシュクリア（更新時に呼び出す）
function clearUserCache(userId: string): void {
  cache.delete(userId);
}
```

### パフォーマンス計測

```typescript
import { performance } from 'perf_hooks';
import * as logger from 'firebase-functions/logger';

/**
 * 処理時間を計測するラッパー
 */
async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    logger.info(`[Performance] ${name}`, {
      durationMs: Math.round(duration),
      success: true
    });

    // 200ms超過時は警告
    if (duration > 200) {
      logger.warn(`[Performance] ${name} が200msを超過`, {
        durationMs: Math.round(duration),
        threshold: 200
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`[Performance] ${name} でエラー`, {
      durationMs: Math.round(duration),
      error: error instanceof Error ? error.message : 'unknown'
    });
    throw error;
  }
}

// 使用例
export const user_getProfile = onCall(async (request) => {
  return await measurePerformance('user_getProfile', async () => {
    // 実際の処理
    const userId = request.auth?.uid;
    const user = await getCachedUser(userId!);
    return { success: true, data: user };
  });
});
```

### 依存パッケージの見直し

```bash
# バンドルサイズの確認
npm run build
ls -lh lib/index.js

# 未使用パッケージの検出
npx depcheck

# バンドル分析（webpack-bundle-analyzerがある場合）
npm run analyze
```

**削除検討リスト**:

| パッケージ | サイズ | 代替案 |
|-----------|--------|--------|
| lodash | 大 | 必要な関数のみインポート |
| moment | 大 | date-fns または Day.js |
| axios | 中 | node-fetch（Node 18以降は標準fetch） |

### 負荷テスト例

```bash
# Artillery.ioを使用した負荷テスト
npm install -g artillery

# テスト設定ファイル（load-test.yml）
# config:
#   target: "https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net"
#   phases:
#     - duration: 60
#       arrivalRate: 10
# scenarios:
#   - flow:
#       - post:
#           url: "/user_getProfile"
#           json:
#             data: {}

# テスト実行
artillery run load-test.yml
```

## 見積もり

- 工数: 5日
- 難易度: 中〜高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 本番環境でのパフォーマンス計測はPhase 2後半で実施
- minInstancesの設定はコストに影響するため、優先度の高いAPIのみに適用
- BigQueryへの書き込みは非同期化（Cloud Tasks使用）で対応済み

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
