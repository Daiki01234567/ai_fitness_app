/**
 * レートリミッターミドルウェア
 * Firestore をストレージとして使用したレート制限を実装
 */

import * as admin from "firebase-admin";
import { DocumentReference } from "firebase-admin/firestore";

import { RateLimitError } from "../utils/errors";
import { getFirestore, serverTimestamp } from "../utils/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Firestore に保存されるレート制限レコード
 */
interface RateLimitRecord {
  count: number;
  windowStart: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * 各 API エンドポイント用の定義済みレート制限
 */
export const RateLimits = {
  // 認証
  AUTH_SIGNUP: { maxRequests: 10, windowSeconds: 3600 }, // IP あたり 10/時間
  AUTH_SIGNIN: { maxRequests: 100, windowSeconds: 3600 }, // ユーザーあたり 100/時間

  // ユーザー管理
  USER_GET_PROFILE: { maxRequests: 100, windowSeconds: 60 }, // 100/分
  USER_UPDATE_PROFILE: { maxRequests: 50, windowSeconds: 3600 }, // 50/時間
  USER_UPDATE_CONSENT: { maxRequests: 10, windowSeconds: 3600 }, // 10/時間
  USER_REVOKE_CONSENT: { maxRequests: 5, windowSeconds: 86400 }, // 5/日

  // トレーニング
  TRAINING_CREATE_SESSION: { maxRequests: 100, windowSeconds: 86400 }, // 100/日
  TRAINING_GET_SESSION: { maxRequests: 50, windowSeconds: 3600 }, // 50/時間
  TRAINING_GET_SESSIONS: { maxRequests: 50, windowSeconds: 3600 }, // 50/時間 (listSessions)
  TRAINING_DELETE_SESSION: { maxRequests: 20, windowSeconds: 3600 }, // 20/時間
  TRAINING_GET_STATISTICS: { maxRequests: 50, windowSeconds: 3600 }, // 50/時間

  // GDPR
  GDPR_DATA_EXPORT: { maxRequests: 3, windowSeconds: 86400 }, // 3/日
  GDPR_DELETE_REQUEST: { maxRequests: 3, windowSeconds: 86400 }, // 3/日
  GDPR_RECOVERY_CODE: { maxRequests: 3, windowSeconds: 3600 }, // 3/時間
  GDPR_RECOVERY_VERIFY: { maxRequests: 10, windowSeconds: 3600 }, // 10/時間
  GDPR_RECOVER_ACCOUNT: { maxRequests: 5, windowSeconds: 86400 }, // 5/日

  // Consent Management (Ticket 020)
  CONSENT_HISTORY: { maxRequests: 60, windowSeconds: 3600 }, // 60/時間/ユーザー
  ADMIN_CONSENT_AUDIT: { maxRequests: 30, windowSeconds: 3600 }, // 30/時間/管理者
  ADMIN_CONSENT_STATS: { maxRequests: 20, windowSeconds: 3600 }, // 20/時間/管理者

  // Feedback (Ticket 024)
  FEEDBACK_SUBMIT: { maxRequests: 10, windowSeconds: 86400 }, // 10/日/ユーザー
  FEEDBACK_LIST: { maxRequests: 60, windowSeconds: 3600 }, // 60/時間/ユーザー

  // Notification (Ticket 022, 023, 026)
  NOTIFICATION_SETTINGS: { maxRequests: 10, windowSeconds: 3600 }, // 10/時間/ユーザー
  NOTIFICATION_FCM_UPDATE: { maxRequests: 10, windowSeconds: 3600 }, // 10/時間/ユーザー

  // 設定
  SETTINGS_UPDATE: { maxRequests: 30, windowSeconds: 3600 }, // 30/時間
  USER_SETTINGS: { maxRequests: 50, windowSeconds: 3600 }, // 50/時間 (Ticket 025)

  // デフォルト
  DEFAULT: { maxRequests: 60, windowSeconds: 60 }, // 60/分
} as const;

export type RateLimitKey = keyof typeof RateLimits;

/**
 * レートリミッタークラス
 */
export class RateLimiter {
  private readonly collectionName = "rateLimits";

  /**
   * レート制限ドキュメント参照を取得
   */
  private getDocRef(key: string): DocumentReference {
    return getFirestore().collection(this.collectionName).doc(key);
  }

  /**
   * レート制限をチェックして更新
   * リクエストが許可される場合は true を返し、許可されない場合は RateLimitError をスロー
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<boolean> {
    const key = this.sanitizeKey(identifier);
    const docRef = this.getDocRef(key);
    const now = admin.firestore.Timestamp.now();
    const windowStart = new Date(now.toMillis() - config.windowSeconds * 1000);
    const windowStartTimestamp = admin.firestore.Timestamp.fromDate(windowStart);

    try {
      const result = await getFirestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          // 初回リクエスト - レコードを作成
          transaction.set(docRef, {
            count: 1,
            windowStart: now,
            updatedAt: serverTimestamp(),
          });
          return true;
        }

        const data = doc.data() as RateLimitRecord;

        // ウィンドウが期限切れかチェック
        if (data.windowStart.toMillis() < windowStartTimestamp.toMillis()) {
          // ウィンドウをリセット
          transaction.set(docRef, {
            count: 1,
            windowStart: now,
            updatedAt: serverTimestamp(),
          });
          return true;
        }

        // 制限を超えたかチェック
        if (data.count >= config.maxRequests) {
          return false;
        }

        // カウントをインクリメント
        transaction.update(docRef, {
          count: admin.firestore.FieldValue.increment(1),
          updatedAt: serverTimestamp(),
        });
        return true;
      });

      if (!result) {
        logger.warn("Rate limit exceeded", {
          identifier: key,
          maxRequests: config.maxRequests,
          windowSeconds: config.windowSeconds,
        });
        throw new RateLimitError();
      }

      return true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      // レート制限エラーの場合はログ出力するがブロックしない
      logger.error("Rate limit check failed", error as Error, { identifier: key });
      return true;
    }
  }

  /**
   * 定義済み設定でレート制限をチェック
   */
  async check(
    limitKey: RateLimitKey,
    identifier: string,
  ): Promise<boolean> {
    const config = RateLimits[limitKey];
    const fullKey = `${limitKey}:${identifier}`;
    return this.checkLimit(fullKey, config);
  }

  /**
   * 残りリクエスト数を取得
   */
  async getRemaining(
    limitKey: RateLimitKey,
    identifier: string,
  ): Promise<{ remaining: number; resetAt: Date }> {
    const config = RateLimits[limitKey];
    const fullKey = `${limitKey}:${identifier}`;
    const key = this.sanitizeKey(fullKey);
    const docRef = this.getDocRef(key);

    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      };
    }

    const data = doc.data() as RateLimitRecord;
    const now = Date.now();
    const windowStart = data.windowStart.toMillis();
    const windowEnd = windowStart + config.windowSeconds * 1000;

    if (now > windowEnd) {
      return {
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowSeconds * 1000),
      };
    }

    return {
      remaining: Math.max(0, config.maxRequests - data.count),
      resetAt: new Date(windowEnd),
    };
  }

  /**
   * 識別子のレート制限をリセット
   */
  async reset(limitKey: RateLimitKey, identifier: string): Promise<void> {
    const fullKey = `${limitKey}:${identifier}`;
    const key = this.sanitizeKey(fullKey);
    const docRef = this.getDocRef(key);
    await docRef.delete();
    logger.info("Rate limit reset", { identifier: key });
  }

  /**
   * 期限切れのレート制限レコードをクリーンアップ
   * スケジュール関数から呼び出されるべき
   */
  async cleanup(maxAgeSeconds = 86400): Promise<number> {
    const db = getFirestore();
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - maxAgeSeconds * 1000),
    );

    const snapshot = await db
      .collection(this.collectionName)
      .where("updatedAt", "<", cutoff)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    logger.info("Rate limit records cleaned up", { count: snapshot.size });
    return snapshot.size;
  }

  /**
   * Firestore ドキュメント ID 用にキーをサニタイズ
   */
  private sanitizeKey(key: string): string {
    // Firestore ドキュメント ID で許可されていない文字を置換
    return key.replace(/[/.#$[\]]/g, "_");
  }
}

// シングルトンインスタンスをエクスポート
export const rateLimiter = new RateLimiter();

/**
 * 関数用レート制限デコレーター
 */
export function withRateLimit(
  limitKey: RateLimitKey,
  getIdentifier: (request: unknown) => string,
) {
  return function <T extends unknown[], R>(
    target: (...args: T) => Promise<R>,
  ) {
    return async function (...args: T): Promise<R> {
      const identifier = getIdentifier(args[0]);
      await rateLimiter.check(limitKey, identifier);
      return target(...args);
    };
  };
}
