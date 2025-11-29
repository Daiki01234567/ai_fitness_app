/**
 * 同意状態取得 API
 *
 * ユーザーの現在の同意状態と同意履歴を取得
 *
 * 法的根拠: GDPR 第7条(1)、第15条(1)(a)
 * 参照: docs/specs/00_要件定義書_v3_3.md (FR-024)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 現在のドキュメントバージョン
const CURRENT_TOS_VERSION = "3.2";
const CURRENT_PP_VERSION = "3.1";

/**
 * 同意状態リクエストデータ
 */
interface GetConsentStatusRequest {
  includeHistory?: boolean;
  historyLimit?: number;
}

/**
 * 同意状態レスポンス
 */
interface ConsentStatus {
  tosAccepted: boolean;
  tosAcceptedAt: string | null;
  tosVersion: string | null;
  tosCurrentVersion: string;
  tosNeedsUpdate: boolean;
  ppAccepted: boolean;
  ppAcceptedAt: string | null;
  ppVersion: string | null;
  ppCurrentVersion: string;
  ppNeedsUpdate: boolean;
  allConsentsValid: boolean;
  needsConsent: boolean;
}

/**
 * 同意履歴エントリ
 */
interface ConsentHistoryEntry {
  consentType: string;
  action: string;
  documentVersion: string;
  createdAt: string;
}

/**
 * 同意状態取得 callable 関数
 *
 * 認証済みユーザーの現在の同意状態を取得
 * オプションで同意履歴を含む
 */
export const getConsentStatus = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Web クライアント用に CORS を有効化
  },
  async (request: CallableRequest<GetConsentStatusRequest>) => {
    // CSRF 保護
    requireCsrfProtection(request);

    // 認証をチェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data || {};
    const includeHistory = data.includeHistory === true;
    const historyLimit = Math.min(Math.max(data.historyLimit || 10, 1), 100);

    logger.info("Getting consent status", {
      userId,
      includeHistory,
    });

    try {
      // ユーザードキュメントを取得
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data()!;

      // 同意状態を構築
      const tosAccepted = userData.tosAccepted === true;
      const ppAccepted = userData.ppAccepted === true;
      const tosVersion = userData.tosVersion || null;
      const ppVersion = userData.ppVersion || null;

      // 更新が必要かチェック
      const tosNeedsUpdate = tosAccepted && tosVersion !== CURRENT_TOS_VERSION;
      const ppNeedsUpdate = ppAccepted && ppVersion !== CURRENT_PP_VERSION;

      const consentStatus: ConsentStatus = {
        tosAccepted,
        tosAcceptedAt: userData.tosAcceptedAt?.toDate?.()?.toISOString() || null,
        tosVersion,
        tosCurrentVersion: CURRENT_TOS_VERSION,
        tosNeedsUpdate,
        ppAccepted,
        ppAcceptedAt: userData.ppAcceptedAt?.toDate?.()?.toISOString() || null,
        ppVersion,
        ppCurrentVersion: CURRENT_PP_VERSION,
        ppNeedsUpdate,
        allConsentsValid: tosAccepted && ppAccepted && !tosNeedsUpdate && !ppNeedsUpdate,
        needsConsent: !tosAccepted || !ppAccepted,
      };

      // リクエストされた場合は同意履歴を取得
      let history: ConsentHistoryEntry[] = [];
      if (includeHistory) {
        const consentsSnapshot = await db
          .collection("consents")
          .where("userId", "==", userId)
          .orderBy("createdAt", "desc")
          .limit(historyLimit)
          .get();

        history = consentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            consentType: data.consentType,
            action: data.action,
            documentVersion: data.documentVersion,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || "",
          };
        });
      }

      logger.info("Consent status retrieved", {
        userId,
        tosAccepted,
        ppAccepted,
        needsConsent: consentStatus.needsConsent,
      });

      return {
        success: true,
        status: consentStatus,
        history: includeHistory ? history : undefined,
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to get consent status", error as Error, { userId });
      throw new HttpsError("internal", "同意状態の取得に失敗しました");
    }
  },
);
