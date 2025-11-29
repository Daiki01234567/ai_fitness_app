/**
 * 同意撤回 API
 *
 * 利用規約またはプライバシーポリシーに対するユーザーの同意を撤回
 * 強制ログアウトをトリガーし、オプションでデータ削除を開始
 *
 * 法的根拠: GDPR 第7条(3)、EDPB ガイドライン 05/2020
 * 参照: docs/specs/00_要件定義書_v3_3.md (FR-002-1)
 *
 * @version 1.0.0
 * @date 2025-11-27
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";

import { requireStrictCsrfProtection } from "../../middleware/csrf";
import { logConsentAction, logSecurityEvent } from "../../services/auditLog";
import { logger } from "../../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * 同意タイプ
 */
type ConsentType = "tos" | "privacy_policy" | "all";

/**
 * 同意撤回リクエストデータ
 */
interface RevokeConsentRequest {
  consentType: ConsentType;
  requestDataDeletion?: boolean;
  reason?: string;
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
 * 撤回用の同意タイプをバリデート
 */
function validateConsentType(type: unknown): ConsentType {
  if (type !== "tos" && type !== "privacy_policy" && type !== "all") {
    throw new HttpsError(
      "invalid-argument",
      "同意タイプが無効です。'tos', 'privacy_policy', または 'all' を指定してください",
    );
  }
  return type;
}

/**
 * 同意撤回 callable 関数
 *
 * ユーザーの同意を撤回し、強制ログアウトをトリガー
 * オプションでデータ削除リクエストを作成
 */
export const revokeConsent = onCall(
  {
    region: "asia-northeast1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true, // Web クライアント用に CORS を有効化
  },
  async (request: CallableRequest<RevokeConsentRequest>) => {
    // センシティブな操作のための厳格な CSRF 保護
    requireStrictCsrfProtection(request);

    // 認証をチェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    const userId = request.auth.uid;
    const data = request.data;

    const consentType = validateConsentType(data.consentType);
    const requestDataDeletion = data.requestDataDeletion === true;
    const reason = typeof data.reason === "string" ? data.reason.substring(0, 500) : undefined;

    // リクエストメタデータを抽出
    const clientIp = getClientIp(request.rawRequest);
    const userAgent = getUserAgent(request.rawRequest);
    const deviceType = detectDeviceType(userAgent);
    const platform = detectPlatform(userAgent);

    logger.info("Revoking consent", {
      userId,
      consentType,
      requestDataDeletion,
    });

    try {
      // ユーザーの存在をチェック
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "ユーザーが見つかりません");
      }

      const userData = userDoc.data();

      // 既に削除済みかチェック
      if (userData?.deletionScheduled) {
        throw new HttpsError(
          "failed-precondition",
          "アカウント削除が既に予定されています",
        );
      }

      // データ保存期限を計算（現在から7年後）
      const dataRetentionDate = new Date();
      dataRetentionDate.setFullYear(dataRetentionDate.getFullYear() + 7);

      // 撤回レコード用の同意詳細
      const consentDetails = {
        ipAddress: hashIpAddress(clientIp),
        userAgent,
        deviceType,
        platform,
      };

      // ユーザー更新を準備
      // クライアント側のログアウトをトリガーするために forceLogout を true に設定
      // これにより、カスタムクレームが失敗しても次の読み取り時にクライアントがログアウトすることを保証
      const userUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        forceLogout: true,
        forceLogoutAt: FieldValue.serverTimestamp(),
      };

      // 作成する同意レコード
      const consentRecords: Record<string, unknown>[] = [];

      if (consentType === "tos" || consentType === "all") {
        userUpdate.tosAccepted = false;
        userUpdate.tosAcceptedAt = null;

        consentRecords.push({
          userId,
          consentType: "tos",
          documentVersion: userData?.tosVersion || "unknown",
          action: "revoke",
          consentDetails,
          reason,
          createdAt: FieldValue.serverTimestamp(),
          dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
        });
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        userUpdate.ppAccepted = false;
        userUpdate.ppAcceptedAt = null;

        consentRecords.push({
          userId,
          consentType: "privacy_policy",
          documentVersion: userData?.ppVersion || "unknown",
          action: "revoke",
          consentDetails,
          reason,
          createdAt: FieldValue.serverTimestamp(),
          dataRetentionDate: Timestamp.fromDate(dataRetentionDate),
        });
      }

      // データ削除がリクエストされた場合、削除リクエストを作成
      let deletionRequestId: string | undefined;
      if (requestDataDeletion) {
        const scheduledDeletionDate = new Date();
        scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

        userUpdate.deletionScheduled = true;
        userUpdate.scheduledDeletionDate = Timestamp.fromDate(scheduledDeletionDate);
      }

      // トランザクションを実行
      await db.runTransaction(async (transaction) => {
        // 同意撤回レコードを作成
        for (const record of consentRecords) {
          const consentRef = db.collection("consents").doc();
          transaction.set(consentRef, record);
        }

        // リクエストされた場合はデータ削除リクエストを作成
        if (requestDataDeletion) {
          const scheduledDeletionDate = new Date();
          scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

          const deletionRef = db.collection("dataDeletionRequests").doc();
          deletionRequestId = deletionRef.id;

          transaction.set(deletionRef, {
            userId,
            status: "pending",
            requestedAt: FieldValue.serverTimestamp(),
            scheduledDeletionDate: Timestamp.fromDate(scheduledDeletionDate),
            reason: reason || "consent_revoked",
            exportRequested: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // ユーザードキュメントを更新
        transaction.update(userRef, userUpdate);
      });

      // 強制ログアウトのカスタムクレームを設定
      try {
        await auth.setCustomUserClaims(userId, {
          ...(request.auth.token || {}),
          forceLogout: true,
          forceLogoutAt: Date.now(),
        });
      } catch (claimError) {
        logger.error("Failed to set force logout claim", claimError as Error, { userId });
        // 続行 - Firestore の forceLogoutAt フィールドもログアウトをトリガーする
      }

      // 同意撤回をログ出力（非同期）
      const auditPromises: Promise<string>[] = [];

      if (consentType === "tos" || consentType === "all") {
        auditPromises.push(
          logConsentAction({
            userId,
            action: "consent_withdraw",
            consentType: "tos",
            version: userData?.tosVersion || "unknown",
            ipAddress: clientIp,
            userAgent,
          }),
        );
      }

      if (consentType === "privacy_policy" || consentType === "all") {
        auditPromises.push(
          logConsentAction({
            userId,
            action: "consent_withdraw",
            consentType: "pp",
            version: userData?.ppVersion || "unknown",
            ipAddress: clientIp,
            userAgent,
          }),
        );
      }

      // 同意撤回のセキュリティイベントをログ出力
      auditPromises.push(
        logSecurityEvent({
          userId,
          eventType: "consent_revoked",
          severity: "medium",
          details: {
            consentType,
            requestDataDeletion,
            deletionRequestId,
          },
          ipAddress: clientIp,
          userAgent,
        }),
      );

      Promise.all(auditPromises).catch((error) => {
        logger.warn("Failed to create audit logs for consent revocation", { error });
      });

      logger.info("Consent revoked successfully", {
        userId,
        consentType,
        requestDataDeletion,
        deletionRequestId,
      });

      return {
        success: true,
        message: "同意を撤回しました。ログアウトされます。",
        consentType,
        forceLogout: true,
        deletionScheduled: requestDataDeletion,
        deletionRequestId,
      };
    } catch (error) {
      // HttpsError はそのまま再スロー
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Failed to revoke consent", error as Error, { userId, consentType });
      throw new HttpsError("internal", "同意の撤回に失敗しました");
    }
  },
);
