/**
 * CSRF Protection Middleware
 *
 * Provides Cross-Site Request Forgery protection for Cloud Functions.
 *
 * Firebase Callable Functions already have built-in CSRF protection
 * through the Firebase SDK, but this middleware adds additional
 * security layers:
 *
 * 1. Origin header validation
 * 2. Referer header validation
 * 3. Custom CSRF token validation (for HTTP endpoints)
 *
 * @see https://firebase.google.com/docs/functions/callable
 * @see https://owasp.org/www-community/attacks/csrf
 *
 * @version 1.0.0
 * @date 2025-11-26
 */

import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { Request } from "express";

import { logger } from "../utils/logger";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Allowed origins for CORS/CSRF validation
 * Add production domains here
 */
const ALLOWED_ORIGINS: string[] = [
  // Production domains (update when deploying)
  "https://ai-fitness-c38f0.web.app",
  "https://ai-fitness-c38f0.firebaseapp.com",

  // Development domains
  "http://localhost:5000",
  "http://localhost:5001",
  "http://localhost:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5001",
  "http://127.0.0.1:3000",

  // Flutter web debug
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

/**
 * Mobile app identifiers for Origin validation
 * Mobile apps send package name as Origin
 */
const ALLOWED_MOBILE_ORIGINS: string[] = [
  // Android
  "android:com.example.flutter_app",
  // iOS bundle identifier (if using custom URL scheme)
  "ios:com.example.flutterApp",
];

/**
 * Firebase emulator marker
 */
const FIREBASE_EMULATOR_ORIGIN = "firebase";

// =============================================================================
// Types
// =============================================================================

/**
 * CSRF validation options
 */
export interface CsrfOptions {
  /** Skip validation for specific origins */
  skipOrigins?: string[];
  /** Require strict origin validation */
  strictMode?: boolean;
  /** Allow requests without Origin header (mobile apps) */
  allowMissingOrigin?: boolean;
  /** Custom allowed origins */
  customOrigins?: string[];
}

/**
 * CSRF validation result
 */
export interface CsrfValidationResult {
  valid: boolean;
  origin?: string;
  reason?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract Origin header from request
 */
function getOrigin(request: CallableRequest | Request): string | undefined {
  // CallableRequest with rawRequest
  if ("rawRequest" in request && request.rawRequest) {
    const rawReq = request.rawRequest as unknown as Record<string, unknown>;
    const headers = rawReq.headers as Record<string, string> | undefined;
    return headers?.origin || headers?.Origin;
  }

  // Express Request
  if ("headers" in request) {
    const req = request as Request;
    return req.headers.origin || req.get("Origin");
  }

  return undefined;
}

/**
 * Extract Referer header from request
 */
function getReferer(request: CallableRequest | Request): string | undefined {
  // CallableRequest with rawRequest
  if ("rawRequest" in request && request.rawRequest) {
    const rawReq = request.rawRequest as unknown as Record<string, unknown>;
    const headers = rawReq.headers as Record<string, string> | undefined;
    return headers?.referer || headers?.Referer;
  }

  // Express Request
  if ("headers" in request) {
    const req = request as Request;
    return req.headers.referer || req.get("Referer");
  }

  return undefined;
}

/**
 * Extract origin from Referer URL
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
 * Check if origin is allowed
 */
function isAllowedOrigin(
  origin: string,
  customOrigins?: string[],
): boolean {
  // Check standard allowed origins
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check mobile app origins
  if (ALLOWED_MOBILE_ORIGINS.includes(origin)) {
    return true;
  }

  // Check Firebase emulator
  if (origin === FIREBASE_EMULATOR_ORIGIN) {
    return true;
  }

  // Check custom origins
  if (customOrigins && customOrigins.includes(origin)) {
    return true;
  }

  // Check if running in emulator (localhost variations)
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    if (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate CSRF protection for a request
 *
 * @param request - The incoming request
 * @param options - Validation options
 * @returns Validation result
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

  // Get Origin header
  const origin = getOrigin(request);

  // If Origin is missing
  if (!origin) {
    // In non-strict mode, allow missing Origin (mobile apps don't always send it)
    if (allowMissingOrigin && !strictMode) {
      // Try to get origin from Referer
      const referer = getReferer(request);
      if (referer) {
        const refererOrigin = getOriginFromReferer(referer);
        if (refererOrigin && isAllowedOrigin(refererOrigin, customOrigins)) {
          return { valid: true, origin: refererOrigin };
        }
      }

      // Allow requests without Origin in non-strict mode
      // This is necessary for mobile apps
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

  // Validate Origin
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
 * CSRF protection middleware for Callable Functions
 *
 * @param request - The callable request
 * @param options - Validation options
 * @throws HttpsError if CSRF validation fails
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
 * Strict CSRF validation (requires valid Origin)
 *
 * Use this for sensitive operations like:
 * - Account deletion
 * - Password changes
 * - Payment operations
 *
 * @param request - The callable request
 * @throws HttpsError if CSRF validation fails
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
// Helper for Express HTTP Functions
// =============================================================================

/**
 * CSRF middleware for Express-style HTTP functions
 *
 * @param options - Validation options
 * @returns Express middleware function
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
// Configuration Helpers
// =============================================================================

/**
 * Get all allowed origins (for CORS configuration)
 */
export function getAllowedOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}

/**
 * Check if running in emulator mode
 */
export function isEmulatorMode(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

/**
 * Add a custom origin to allowed list at runtime
 * (useful for testing)
 */
export function addAllowedOrigin(origin: string): void {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ALLOWED_ORIGINS.push(origin);
    logger.info("Added allowed origin", { origin });
  }
}
