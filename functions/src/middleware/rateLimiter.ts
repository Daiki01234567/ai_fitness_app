/**
 * Rate Limiter Middleware
 * Implements rate limiting using Firestore for storage
 */

import * as admin from "firebase-admin";
import { DocumentReference } from "firebase-admin/firestore";

import { RateLimitError } from "../utils/errors";
import { getFirestore, serverTimestamp } from "../utils/firestore";
import { logger } from "../utils/logger";

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Rate limit record stored in Firestore
 */
interface RateLimitRecord {
  count: number;
  windowStart: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Predefined rate limits for different API endpoints
 */
export const RateLimits = {
  // Authentication
  AUTH_SIGNUP: { maxRequests: 10, windowSeconds: 3600 }, // 10/hour per IP
  AUTH_SIGNIN: { maxRequests: 100, windowSeconds: 3600 }, // 100/hour per user

  // User management
  USER_GET_PROFILE: { maxRequests: 100, windowSeconds: 60 }, // 100/min
  USER_UPDATE_PROFILE: { maxRequests: 50, windowSeconds: 3600 }, // 50/hour
  USER_UPDATE_CONSENT: { maxRequests: 10, windowSeconds: 3600 }, // 10/hour
  USER_REVOKE_CONSENT: { maxRequests: 5, windowSeconds: 86400 }, // 5/day

  // Training
  TRAINING_CREATE_SESSION: { maxRequests: 100, windowSeconds: 86400 }, // 100/day
  TRAINING_GET_SESSIONS: { maxRequests: 100, windowSeconds: 3600 }, // 100/hour
  TRAINING_GET_STATISTICS: { maxRequests: 50, windowSeconds: 3600 }, // 50/hour

  // GDPR
  GDPR_DATA_EXPORT: { maxRequests: 3, windowSeconds: 86400 }, // 3/day
  GDPR_DELETE_REQUEST: { maxRequests: 3, windowSeconds: 86400 }, // 3/day

  // Settings
  SETTINGS_UPDATE: { maxRequests: 30, windowSeconds: 3600 }, // 30/hour

  // Default
  DEFAULT: { maxRequests: 60, windowSeconds: 60 }, // 60/min
} as const;

export type RateLimitKey = keyof typeof RateLimits;

/**
 * Rate limiter class
 */
export class RateLimiter {
  private readonly collectionName = "rateLimits";

  /**
   * Get rate limit document reference
   */
  private getDocRef(key: string): DocumentReference {
    return getFirestore().collection(this.collectionName).doc(key);
  }

  /**
   * Check and update rate limit
   * Returns true if request is allowed, throws RateLimitError if not
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
          // First request - create record
          transaction.set(docRef, {
            count: 1,
            windowStart: now,
            updatedAt: serverTimestamp(),
          });
          return true;
        }

        const data = doc.data() as RateLimitRecord;

        // Check if window has expired
        if (data.windowStart.toMillis() < windowStartTimestamp.toMillis()) {
          // Reset window
          transaction.set(docRef, {
            count: 1,
            windowStart: now,
            updatedAt: serverTimestamp(),
          });
          return true;
        }

        // Check if limit exceeded
        if (data.count >= config.maxRequests) {
          return false;
        }

        // Increment count
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
      // Log but don't block on rate limit errors
      logger.error("Rate limit check failed", error as Error, { identifier: key });
      return true;
    }
  }

  /**
   * Check rate limit with predefined config
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
   * Get remaining requests
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
   * Reset rate limit for identifier
   */
  async reset(limitKey: RateLimitKey, identifier: string): Promise<void> {
    const fullKey = `${limitKey}:${identifier}`;
    const key = this.sanitizeKey(fullKey);
    const docRef = this.getDocRef(key);
    await docRef.delete();
    logger.info("Rate limit reset", { identifier: key });
  }

  /**
   * Clean up expired rate limit records
   * Should be called by a scheduled function
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
   * Sanitize key for Firestore document ID
   */
  private sanitizeKey(key: string): string {
    // Replace characters not allowed in Firestore document IDs
    return key.replace(/[/.#$[\]]/g, "_");
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit decorator for functions
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
