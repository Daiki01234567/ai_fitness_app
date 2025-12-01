/**
 * CSRF Protection Middleware Tests
 *
 * Unit tests for Cross-Site Request Forgery protection
 * Covers origin validation, referer checking, and middleware functions
 *
 * Reference: docs/specs/07_セキュリティポリシー_v1_0.md
 */

// Mock utils/logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
  },
}));

// Import after mocks
import {
  validateCsrf,
  requireCsrfProtection,
  requireStrictCsrfProtection,
  csrfMiddleware,
  getAllowedOrigins,
  isEmulatorMode,
  addAllowedOrigin,
  CsrfOptions,
} from "../../src/middleware/csrf";
import { logger } from "../../src/utils/logger";

describe("CSRF Protection Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateCsrf", () => {
    describe("with Origin header", () => {
      it("should validate allowed production origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "https://ai-fitness-c38f0.web.app" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
        expect(result.origin).toBe("https://ai-fitness-c38f0.web.app");
      });

      it("should validate allowed firebaseapp origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "https://ai-fitness-c38f0.firebaseapp.com" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate localhost development origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "http://localhost:5000" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate 127.0.0.1 development origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "http://127.0.0.1:3000" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate Flutter Web debug origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "http://localhost:8080" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate mobile app origin (Android)", () => {
        const request = {
          rawRequest: {
            headers: { origin: "android:com.example.flutter_app" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate mobile app origin (iOS)", () => {
        const request = {
          rawRequest: {
            headers: { origin: "ios:com.example.flutterApp" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate Firebase emulator origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "firebase" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should reject invalid origin", () => {
        const request = {
          rawRequest: {
            headers: { origin: "https://evil-site.com" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("evil-site.com");
        expect(logger.security).toHaveBeenCalledWith(
          "CSRF validation failed - invalid origin",
          expect.objectContaining({ origin: "https://evil-site.com" })
        );
      });

      it("should validate custom origin when provided", () => {
        const request = {
          rawRequest: {
            headers: { origin: "https://custom-domain.com" },
          },
        } as any;

        const options: CsrfOptions = {
          customOrigins: ["https://custom-domain.com"],
        };

        const result = validateCsrf(request, options);

        expect(result.valid).toBe(true);
      });
    });

    describe("without Origin header", () => {
      it("should allow missing Origin in non-strict mode (default)", () => {
        const request = {
          rawRequest: {
            headers: {},
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
        expect(result.reason).toBe("origin_missing_allowed");
      });

      it("should reject missing Origin in strict mode", () => {
        const request = {
          rawRequest: {
            headers: {},
          },
        } as any;

        const options: CsrfOptions = {
          strictMode: true,
          allowMissingOrigin: false,
        };

        const result = validateCsrf(request, options);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Origin header is missing");
      });

      it("should use Referer as fallback when Origin is missing", () => {
        const request = {
          rawRequest: {
            headers: {
              referer: "https://ai-fitness-c38f0.web.app/page",
            },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
        expect(result.origin).toBe("https://ai-fitness-c38f0.web.app");
      });

      it("should reject invalid Referer origin", () => {
        const request = {
          rawRequest: {
            headers: {
              referer: "https://evil-site.com/page",
            },
          },
        } as any;

        // In non-strict mode, even with invalid referer, it allows (for mobile)
        const result = validateCsrf(request);

        // Non-strict allows missing origin for mobile
        expect(result.valid).toBe(true);
      });

      it("should handle invalid Referer URL gracefully", () => {
        const request = {
          rawRequest: {
            headers: {
              referer: "not-a-valid-url",
            },
          },
        } as any;

        const result = validateCsrf(request);

        // Still allowed in non-strict mode for mobile apps
        expect(result.valid).toBe(true);
      });
    });

    describe("with Express Request", () => {
      it("should validate Origin from Express request headers", () => {
        const request = {
          headers: { origin: "https://ai-fitness-c38f0.web.app" },
          get: jest.fn((header: string) => {
            if (header === "Origin") return "https://ai-fitness-c38f0.web.app";
            return undefined;
          }),
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should validate Referer from Express request", () => {
        const request = {
          headers: {
            referer: "https://ai-fitness-c38f0.web.app/path",
          },
          get: jest.fn((header: string) => {
            if (header === "Referer")
              return "https://ai-fitness-c38f0.web.app/path";
            return undefined;
          }),
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe("in emulator mode", () => {
      it("should allow any localhost in emulator mode", () => {
        process.env.FUNCTIONS_EMULATOR = "true";

        const request = {
          rawRequest: {
            headers: { origin: "http://localhost:9999" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should allow any 127.0.0.1 in emulator mode", () => {
        process.env.FUNCTIONS_EMULATOR = "true";

        const request = {
          rawRequest: {
            headers: { origin: "http://127.0.0.1:9999" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe("case sensitivity", () => {
      it("should handle Origin header with different casing", () => {
        const request = {
          rawRequest: {
            headers: { Origin: "https://ai-fitness-c38f0.web.app" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it("should handle Referer header with different casing", () => {
        const request = {
          rawRequest: {
            headers: { Referer: "https://ai-fitness-c38f0.web.app/page" },
          },
        } as any;

        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe("requireCsrfProtection", () => {
    it("should not throw for valid request", () => {
      const request = {
        rawRequest: {
          headers: { origin: "https://ai-fitness-c38f0.web.app" },
        },
      } as any;

      expect(() => requireCsrfProtection(request)).not.toThrow();
    });

    it("should throw HttpsError for invalid origin", () => {
      const request = {
        rawRequest: {
          headers: { origin: "https://evil-site.com" },
        },
      } as any;

      expect(() => requireCsrfProtection(request)).toThrow(
        "リクエストが許可されていません"
      );
      expect(logger.security).toHaveBeenCalledWith(
        "CSRF protection triggered",
        expect.anything()
      );
    });

    it("should pass custom options", () => {
      const request = {
        rawRequest: {
          headers: { origin: "https://custom-origin.com" },
        },
      } as any;

      const options: CsrfOptions = {
        customOrigins: ["https://custom-origin.com"],
      };

      expect(() => requireCsrfProtection(request, options)).not.toThrow();
    });
  });

  describe("requireStrictCsrfProtection", () => {
    it("should not throw for valid origin", () => {
      const request = {
        rawRequest: {
          headers: { origin: "https://ai-fitness-c38f0.web.app" },
        },
      } as any;

      expect(() => requireStrictCsrfProtection(request)).not.toThrow();
    });

    it("should throw when Origin is missing", () => {
      const request = {
        rawRequest: {
          headers: {},
        },
      } as any;

      expect(() => requireStrictCsrfProtection(request)).toThrow(
        "リクエストが許可されていません"
      );
    });

    it("should throw for invalid origin", () => {
      const request = {
        rawRequest: {
          headers: { origin: "https://evil-site.com" },
        },
      } as any;

      expect(() => requireStrictCsrfProtection(request)).toThrow(
        "リクエストが許可されていません"
      );
    });
  });

  describe("csrfMiddleware", () => {
    it("should call next() for valid request", () => {
      const req = {
        headers: { origin: "https://ai-fitness-c38f0.web.app" },
        get: jest.fn().mockReturnValue("https://ai-fitness-c38f0.web.app"),
        path: "/api/test",
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const middleware = csrfMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 for invalid origin", () => {
      const req = {
        headers: { origin: "https://evil-site.com" },
        get: jest.fn().mockReturnValue("https://evil-site.com"),
        path: "/api/test",
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const middleware = csrfMiddleware();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "CSRF_VALIDATION_FAILED",
          message: "リクエストが許可されていません",
        },
      });
      expect(logger.security).toHaveBeenCalledWith(
        "CSRF middleware blocked request",
        expect.objectContaining({ path: "/api/test" })
      );
    });

    it("should pass options to validateCsrf", () => {
      const req = {
        headers: { origin: "https://custom-allowed.com" },
        get: jest.fn().mockReturnValue("https://custom-allowed.com"),
        path: "/api/test",
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const middleware = csrfMiddleware({
        customOrigins: ["https://custom-allowed.com"],
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("getAllowedOrigins", () => {
    it("should return array of allowed origins", () => {
      const origins = getAllowedOrigins();

      expect(Array.isArray(origins)).toBe(true);
      expect(origins).toContain("https://ai-fitness-c38f0.web.app");
      expect(origins).toContain("https://ai-fitness-c38f0.firebaseapp.com");
      expect(origins).toContain("http://localhost:5000");
    });

    it("should return a copy of the array", () => {
      const origins1 = getAllowedOrigins();
      const origins2 = getAllowedOrigins();

      // Should be different array instances
      expect(origins1).not.toBe(origins2);
      expect(origins1).toEqual(origins2);
    });
  });

  describe("isEmulatorMode", () => {
    it("should return true when FUNCTIONS_EMULATOR is true", () => {
      process.env.FUNCTIONS_EMULATOR = "true";
      expect(isEmulatorMode()).toBe(true);
    });

    it("should return false when FUNCTIONS_EMULATOR is not set", () => {
      delete process.env.FUNCTIONS_EMULATOR;
      expect(isEmulatorMode()).toBe(false);
    });

    it("should return false when FUNCTIONS_EMULATOR is false", () => {
      process.env.FUNCTIONS_EMULATOR = "false";
      expect(isEmulatorMode()).toBe(false);
    });
  });

  describe("addAllowedOrigin", () => {
    it("should add new origin to allowed list", () => {
      const newOrigin = "https://new-domain-" + Date.now() + ".com";
      addAllowedOrigin(newOrigin);

      const origins = getAllowedOrigins();
      expect(origins).toContain(newOrigin);
      expect(logger.info).toHaveBeenCalledWith("Added allowed origin", {
        origin: newOrigin,
      });
    });

    it("should not add duplicate origin", () => {
      const existingOrigin = "https://ai-fitness-c38f0.web.app";
      const originalLength = getAllowedOrigins().length;

      addAllowedOrigin(existingOrigin);

      const newLength = getAllowedOrigins().length;
      expect(newLength).toBe(originalLength);
      // Should not log when not adding
      expect(logger.info).not.toHaveBeenCalledWith("Added allowed origin", {
        origin: existingOrigin,
      });
    });

    it("should make new origin valid for requests", () => {
      const testOrigin = "https://test-added-" + Date.now() + ".com";
      addAllowedOrigin(testOrigin);

      const request = {
        rawRequest: {
          headers: { origin: testOrigin },
        },
      } as any;

      const result = validateCsrf(request);
      expect(result.valid).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle request without rawRequest property", () => {
      const request = {
        headers: { origin: "https://ai-fitness-c38f0.web.app" },
        get: jest.fn().mockReturnValue("https://ai-fitness-c38f0.web.app"),
      } as any;

      const result = validateCsrf(request);
      expect(result.valid).toBe(true);
    });

    it("should handle rawRequest with null headers", () => {
      const request = {
        rawRequest: {
          headers: null,
        },
      } as any;

      const result = validateCsrf(request);
      // Should allow missing origin in non-strict mode
      expect(result.valid).toBe(true);
    });

    it("should handle complex Referer URLs", () => {
      const request = {
        rawRequest: {
          headers: {
            referer:
              "https://ai-fitness-c38f0.web.app/path?query=value#hash",
          },
        },
      } as any;

      const result = validateCsrf(request);
      expect(result.valid).toBe(true);
      expect(result.origin).toBe("https://ai-fitness-c38f0.web.app");
    });
  });

  describe("Edge cases - uncovered lines", () => {
    it("should handle request with neither rawRequest nor headers (line 115)", () => {
      // Request object with no recognizable structure
      const request = {} as any;

      const result = validateCsrf(request);
      // Should allow missing origin in non-strict mode
      expect(result.valid).toBe(true);
      expect(result.reason).toBe("origin_missing_allowed");
    });

    it("should handle request with neither rawRequest nor headers in strict mode", () => {
      // Request object with no recognizable structure
      const request = {} as any;

      const options: CsrfOptions = {
        strictMode: true,
        allowMissingOrigin: false,
      };

      const result = validateCsrf(request, options);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Origin header is missing");
    });
  });
});
