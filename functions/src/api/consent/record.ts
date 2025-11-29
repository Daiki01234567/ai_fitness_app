/**
 * 同意記録 API
 *
 * 利用規約とプライバシーポリシーに対するユーザーの同意を記録
 * consents コレクションに不変の同意レコードを作成
 *
 * 法的根拠: GDPR 第7条、EDPB ガイドライン 05/2020
 * 参照: docs/specs/02_Firestoreデータベース設計書_v3_3.md Section 6
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireCsrfProtection } from "../../middleware/csrf";
import { logConsentAction } from "../../services/auditLog";
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
 * 同意タイプ
 */
type ConsentType = "tos" | "privacy_policy";

/**
 * 同意記録リクエストデータ
 */
interface RecordConsentRequest {
  consentType: ConsentType;
  accepted: boolean;
}

/**
 * 監査証跡用の同意詳細
 */
interface ConsentDetails {
  ipAddress: string;
  userAgent: string;
  deviceType: "mobile" | "tablet" | "desktop";
  platform: "iOS" | "Android" | "Web";
}

/**
 * リクエストからクライアント IP を抽出
 */
function getClientIp(rawRequest: unknown): string {
  if (!rawRequest || typeof rawRequest !== "object") {
    return "unknown";
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  const xForwardedFor = headers?.["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = headers?.["x-real-ip"];
  if (typeof xRealIp === "string") {
    return xRealIp;
  }

  return "unknown";
}

/**
 * リクエストからユーザーエージェントを抽出
 */
function getUserAgent(rawRequest: unknown): string {
  if (!rawRequest || typeof rawRequest !== "object") {
    return "unknown";
  }

  const req = rawRequest as Record<string, unknown>;
  const headers = req.headers as Record<string, string> | undefined;

  return headers?.["user-agent"] || "unknown";
}

/**
 * ユーザーエージェントからデバイスタイプを検出
 */
function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  return "desktop";
}

/**
 * ユーザーエージェントからプラットフォームを検出
 */
function detectPlatform(userAgent: string): "iOS" | "Android" | "Web" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    return "iOS";
  }
  if (ua.includes("android")) {
    return "Android";
  }
  return "Web";
}

/**
 * プライバシーのために IP アドレスをハッシュ化
 */
function hashIpAddress(ip: string): string {
  const crypto = require("crypto");
  const salt = process.env.CONSENT_SALT || "consent_default_salt";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .substring(0, 16);
}

/**
 * 同意タイプに対応するドキュメントバージョンを取得
 */
function getDocumentVersion(consentType: ConsentType): string {
  return consentType === "tos" ? CURRENT_TOS_VERSION : CURRENT_PP_VERSION;
}

/**
 * 同意タイプをバリデート
 */
function validateConsentType(type: unknown): ConsentType {
  if (type !== "tos" && type !== "privacy_policy") {
    throw new HttpsError(
      "invalid-argument",
      "同意タイプが無効です。'tos' または 'privacy_policy' を指定してください",
    );
  }
  return type;
}

/**
 * 同意記録 callable 関数
 *
 * 利用規約またはプライバシーポリシーに対するユーザーの同意を記録
 * 不変の同意レコードを作成し、ユーザードキュメントを更新
 */
export const recordConsent = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true, // Web クライアント用に CORS を有効化
  },
  async (request: CallableRequest<RecordConsentRequest>) => {
    // CSRF 保護
    requireCsrfProtection(request);

    // 認証をチェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data;

    // 入力をバリデート
    if (data.accepted !== true) {
      throw new HttpsError("invalid-argument", "同意が必要です");
    }

    const consentType = validateConsentType(data.consentType);
    const documentVersion = getDocumentVersion(consentType);

    // リクエストメタデータを抽出
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);
    const deviceType = detectDeviceType(userAgent);
    const platform = detectPlatform(userAgent);

    logger.info("Recording consent", {
      userId,
      consentType,
      documentVersion,
    });

    try {
      // ユーザーの存在をチェック
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // 削除予定かチェック
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が予定されているため、同意を記録できません",
        );
      }

      // 同意詳細を作成
      const consentDetails: ConsentDetails = {
        ipAddress: hashIpAddress(clientIp),
        userAgent,
        deviceType,
        platform,
      };

      // データ保存期限を計算（現在から7年後）
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      // 同意レコードを作成
      const consentRecord = {
        userId,
        consentType,
        documentVersion,
        action: "accept",
        consentDetails,
        createdAt: FieldValue.serverTimestamp(),
        dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
      };

      // 同意タイプに基づいてユーザー更新を準備
      const userUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (consentType === "tos") {
        userUpdate.tosAccepted = true;
        userUpdate.tosAcceptedAt = FieldValue.serverTimestamp();
        userUpdate.tosVersion = documentVersion;
      } else {
        userUpdate.ppAccepted = true;
        userUpdate.ppAcceptedAt = FieldValue.serverTimestamp();
        userUpdate.ppVersion = documentVersion;
      }

      // トランザクションを実行
      await db.runTransaction(async (transaction) => {
        // 同意レコードを作成
        const consentRef = db.collection("consents").doc();
        transaction.set(consentRef, consentRecord);

        // ユーザードキュメントを更新
        transaction.update(userRef, userUpdate);
      });

      // 同意アクションをログ出力（非同期）
      logConsentAction({
        userId,
        action: "consent_accept",
        consentType: consentType === "tos" ? "tos" : "pp",
        version: documentVersion,
        ipAddress: clientIp,
        userAgent,
      }).catch((error) => {
        logger.warn("Failed to create audit log for consent", { error });
      });

      logger.info("Consent recorded successfully", {
        userId,
        consentType,
        documentVersion,
      });

      return {
        success: true,
        message: "同意を記録しました",
        consentType,
        documentVersion,
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to record consent", error as Error, { userId, consentType });
      throw new HttpsError("internal", "同意の記録に失敗しました");
    }
  },
);
