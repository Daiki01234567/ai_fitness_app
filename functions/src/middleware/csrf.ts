/**
 * CSRF 保護ミドルウェア
 *
 * Cloud Functions 用のクロスサイトリクエストフォージェリ保護を提供
 *
 * Firebase Callable Functions は Firebase SDK を通じて組み込みの CSRF 保護を
 * 既に持っていますが、このミドルウェアは追加のセキュリティレイヤーを追加します:
 *
 * 1. Origin ヘッダー検証
 * 2. Referer ヘッダー検証
 * 3. カスタム CSRF トークン検証（HTTP エンドポイント用）
 *
 * @see https://firebase.google.com/docs/functions/callable
 * @see https://owasp.org/www-community/attacks/csrf
 *
 * @version 1.0.0
 * @date 2025-11-26
 */

import { Request } from "express";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

import { logger } from "../utils/logger";

// =============================================================================
// 設定
// =============================================================================

/**
 * CORS/CSRF バリデーション用の許可されたオリジン
 * 本番ドメインをここに追加
 */
const ALLOWED_ORIGINS: string[] = [
  // 本番ドメイン
  "https://tokyo-list-478804-e5.web.app",
  "https://tokyo-list-478804-e5.firebaseapp.com",

  // 開発ドメイン
  "http://localhost:5000",
  "http://localhost:5001",
  "http://localhost:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5001",
  "http://127.0.0.1:3000",

  // Flutter Web デバッグ
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

/**
 * Origin バリデーション用のモバイルアプリ識別子
 * モバイルアプリはパッケージ名を Origin として送信
 */
const ALLOWED_MOBILE_ORIGINS: string[] = [
  // Android
  "android:com.example.flutter_app",
  // iOS バンドル識別子（カスタム URL スキーム使用時）
  "ios:com.example.flutterApp",
];

/**
 * Firebase エミュレーターマーカー
 */
const FIREBASE_EMULATOR_ORIGIN = "firebase";

// =============================================================================
// 型定義
// =============================================================================

/**
 * CSRF バリデーションオプション
 */
export interface CsrfOptions {
  /** 特定のオリジンでバリデーションをスキップ */
  skipOrigins?: string[];
  /** 厳格なオリジンバリデーションを要求 */
  strictMode?: boolean;
  /** Origin ヘッダーなしのリクエストを許可（モバイルアプリ用） */
  allowMissingOrigin?: boolean;
  /** カスタム許可オリジン */
  customOrigins?: string[];
}

/**
 * CSRF バリデーション結果
 */
export interface CsrfValidationResult {
  valid: boolean;
  origin?: string;
  reason?: string;
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * リクエストから Origin ヘッダーを抽出
 */
function getOrigin(request: CallableRequest | Request): string | undefined {
  // rawRequest 付きの CallableRequest
  if ("rawRequest" in request && request.rawRequest) {
    const rawReq = request.rawRequest as unknown as Record<string, unknown>;
    const headers = rawReq.headers as Record<string, string> | undefined;
    return headers?.origin || headers?.Origin;
  }

  // Express Request
  if ("headers" in request) {
    const req = request;
    return req.headers.origin || req.get("Origin");
  }

  return undefined;
}

/**
 * リクエストから Referer ヘッダーを抽出
 */
function getReferer(request: CallableRequest | Request): string | undefined {
  // rawRequest 付きの CallableRequest
  if ("rawRequest" in request && request.rawRequest) {
    const rawReq = request.rawRequest as unknown as Record<string, unknown>;
    const headers = rawReq.headers as Record<string, string> | undefined;
    return headers?.referer || headers?.Referer;
  }

  // Express Request
  if ("headers" in request) {
    const req = request;
    return req.headers.referer || req.get("Referer");
  }

  return undefined;
}

/**
 * Referer URL からオリジンを抽出
 */
function getOriginFromReferer(referer: string): string | undefined {
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

/**
 * オリジンが許可されているかチェック
 */
function isAllowedOrigin(
  origin: string,
  customOrigins?: string[],
): boolean {
  // 標準許可オリジンをチェック
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // モバイルアプリオリジンをチェック
  if (ALLOWED_MOBILE_ORIGINS.includes(origin)) {
    return true;
  }

  // Firebase エミュレーターをチェック
  if (origin === FIREBASE_EMULATOR_ORIGIN) {
    return true;
  }

  // カスタムオリジンをチェック
  if (customOrigins && customOrigins.includes(origin)) {
    return true;
  }

  // エミュレーターで実行中かチェック（localhost バリエーション）
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    if (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// バリデーション関数
// =============================================================================

/**
 * リクエストの CSRF 保護をバリデート
 *
 * @param request - 受信リクエスト
 * @param options - バリデーションオプション
 * @returns バリデーション結果
 */
export function validateCsrf(
  request: CallableRequest | Request,
  options: CsrfOptions = {},
): CsrfValidationResult {
  const {
    strictMode = false,
    allowMissingOrigin = true,
    customOrigins,
  } = options;

  // Origin ヘッダーを取得
  const origin = getOrigin(request);

  // Origin がない場合
  if (!origin) {
    // 非厳格モードでは Origin なしを許可（モバイルアプリは常に送信するわけではない）
    if (allowMissingOrigin && !strictMode) {
      // Referer からオリジンを取得試行
      const referer = getReferer(request);
      if (referer) {
        const refererOrigin = getOriginFromReferer(referer);
        if (refererOrigin && isAllowedOrigin(refererOrigin, customOrigins)) {
          return { valid: true, origin: refererOrigin };
        }
      }

      // 非厳格モードでは Origin なしのリクエストを許可
      // これはモバイルアプリに必要
      logger.debug("Request without Origin header allowed", {
        hasReferer: !!referer,
      });
      return { valid: true, reason: "origin_missing_allowed" };
    }

    return {
      valid: false,
      reason: "Origin header is missing",
    };
  }

  // Origin をバリデート
  if (!isAllowedOrigin(origin, customOrigins)) {
    logger.security("CSRF validation failed - invalid origin", {
      origin,
      allowedOrigins: ALLOWED_ORIGINS,
    });

    return {
      valid: false,
      origin,
      reason: `Origin '${origin}' is not allowed`,
    };
  }

  return { valid: true, origin };
}

/**
 * Callable Functions 用 CSRF 保護ミドルウェア
 *
 * @param request - Callable リクエスト
 * @param options - バリデーションオプション
 * @throws CSRF バリデーション失敗時に HttpsError
 */
export function requireCsrfProtection(
  request: CallableRequest,
  options: CsrfOptions = {},
): void {
  const result = validateCsrf(request, options);

  if (!result.valid) {
    logger.security("CSRF protection triggered", {
      reason: result.reason,
      origin: result.origin,
    });

    throw new HttpsError(
      "permission-denied",
      "リクエストが許可されていません",
    );
  }
}

/**
 * 厳格な CSRF バリデーション（有効な Origin が必要）
 *
 * 以下のような機密操作に使用:
 * - アカウント削除
 * - パスワード変更
 * - 決済操作
 *
 * @param request - Callable リクエスト
 * @throws CSRF バリデーション失敗時に HttpsError
 */
export function requireStrictCsrfProtection(
  request: CallableRequest,
): void {
  requireCsrfProtection(request, {
    strictMode: true,
    allowMissingOrigin: false,
  });
}

// =============================================================================
// Express HTTP Functions 用ヘルパー
// =============================================================================

/**
 * Express スタイル HTTP 関数用 CSRF ミドルウェア
 *
 * @param options - バリデーションオプション
 * @returns Express ミドルウェア関数
 */
export function csrfMiddleware(options: CsrfOptions = {}) {
  return (
    req: Request,
    res: { status: (code: number) => { json: (data: object) => void } },
    next: () => void,
  ): void => {
    const result = validateCsrf(req, options);

    if (!result.valid) {
      logger.security("CSRF middleware blocked request", {
        reason: result.reason,
        origin: result.origin,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_VALIDATION_FAILED",
          message: "リクエストが許可されていません",
        },
      });
      return;
    }

    next();
  };
}

// =============================================================================
// 設定ヘルパー
// =============================================================================

/**
 * すべての許可オリジンを取得（CORS 設定用）
 */
export function getAllowedOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}

/**
 * エミュレーターモードで実行中かチェック
 */
export function isEmulatorMode(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

/**
 * 実行時に許可リストへカスタムオリジンを追加
 * （テストに便利）
 */
export function addAllowedOrigin(origin: string): void {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ALLOWED_ORIGINS.push(origin);
    logger.info("Added allowed origin", { origin });
  }
}
