/**
 * createSession API Unit Tests
 *
 * Tests for training session creation functionality
 *
 * @see docs/common/tickets/011-session-save-api.md
 * @see docs/common/specs/04_API_Firebase_Functions_v1_0.md Section 6
 */

import { mockTimestamp } from "../../mocks/firestore";

// Mock Firestore instance with methods - must be defined before firebase-admin mock
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

const mockFirestoreInstance = {
  collection: mockCollection,
  doc: mockDoc,
  set: mockSet,
  get: mockGet,
};

// Configure chained calls
mockCollection.mockReturnValue({
  doc: mockDoc,
});
mockDoc.mockReturnValue({
  collection: mockCollection,
  doc: mockDoc,
  set: mockSet,
  get: mockGet,
  id: "test-session-id",
});

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => mockFirestoreInstance),
    {
      FieldValue: {
        serverTimestamp: jest.fn(() => "server-timestamp"),
      },
      Timestamp: {
        fromDate: jest.fn((date: Date) => mockTimestamp(date)),
      },
    },
  ),
}));

// Mock firebase-admin/firestore
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-timestamp"),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => mockTimestamp(date)),
  },
}));

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: jest.fn(),
  },
}));

// Mock auth middleware
const mockRequireAuthWithWritePermission = jest.fn();
jest.mock("../../../src/middleware/auth", () => ({
  requireAuthWithWritePermission: mockRequireAuthWithWritePermission,
}));

// HttpsError class for tests
class HttpsError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "HttpsError";
  }
}

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => {
    if (typeof options === "function") {
      return options;
    }
    return handler;
  }),
  HttpsError,
}));

// Helper to create mock request
function createMockRequest(
  data: unknown,
  auth: { uid: string; token?: Record<string, unknown> } | null,
) {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: auth.token || { email: "test@example.com", email_verified: true },
        }
      : null,
    rawRequest: {},
  };
}

describe("createSession API", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createSessionHandler: (request: any) => Promise<any>;

  beforeAll(() => {
    jest.isolateModules(() => {
      const module = require("../../../src/api/training/createSession");
      createSessionHandler = module.createSession;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockRequireAuthWithWritePermission.mockResolvedValue({ uid: "test-user-123" });
  });

  describe("Authentication", () => {
    it("should throw unauthenticated error when no auth context", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("unauthenticated", "Authentication required"),
      );

      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        null,
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });

    it("should throw permission-denied when user is scheduled for deletion", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("permission-denied", "Account deletion scheduled"),
      );

      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "deletion-scheduled-user" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });
  });

  describe("Exercise Type Validation", () => {
    it("should accept valid exercise type: squat", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.exerciseType).toBe("squat");
    });

    it("should accept valid exercise type: pushup", async () => {
      const request = createMockRequest(
        {
          exerciseType: "pushup",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.exerciseType).toBe("pushup");
    });

    it("should accept valid exercise type: armcurl", async () => {
      const request = createMockRequest(
        {
          exerciseType: "armcurl",
          cameraSettings: { position: "front", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.exerciseType).toBe("armcurl");
    });

    it("should accept valid exercise type: sidelateral", async () => {
      const request = createMockRequest(
        {
          exerciseType: "sidelateral",
          cameraSettings: { position: "front", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.exerciseType).toBe("sidelateral");
    });

    it("should accept valid exercise type: shoulderpress", async () => {
      const request = createMockRequest(
        {
          exerciseType: "shoulderpress",
          cameraSettings: { position: "front", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data.exerciseType).toBe("shoulderpress");
    });

    it("should reject invalid exercise type", async () => {
      const request = createMockRequest(
        {
          exerciseType: "invalid_exercise",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        // Check error message contains exercise type related text
        expect((error as HttpsError).message).toMatch(/squat|pushup|armcurl|sidelateral|shoulderpress/);
      }
    });

    it("should reject non-string exercise type", async () => {
      const request = createMockRequest(
        {
          exerciseType: 123,
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Camera Settings Validation", () => {
    it("should accept valid camera settings with front position", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "front", resolution: "1920x1080", fps: 60 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
    });

    it("should accept valid camera settings with side position", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
    });

    it("should reject invalid camera position", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "back", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("front");
      }
    });

    it("should reject invalid resolution format", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280-720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        // Check for resolution format error message (WIDTH x HEIGHT)
        expect((error as HttpsError).message).toMatch(/WIDTH|HEIGHT|x|1280x720/i);
      }
    });

    it("should reject non-integer fps", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 29.97 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("FPS");
      }
    });

    it("should reject fps less than 1", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 0 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
        expect((error as HttpsError).message).toContain("FPS");
      }
    });

    it("should reject missing camera settings", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("invalid-argument");
      }
    });
  });

  describe("Session Creation", () => {
    it("should create session with correct data", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      const result = await createSessionHandler(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        sessionId: expect.any(String),
        userId: "test-user-123",
        exerciseType: "squat",
        status: "active",
      });
      expect(result.data.startTime).toBeDefined();
    });

    it("should call Firestore set with correct session data", async () => {
      const request = createMockRequest(
        {
          exerciseType: "pushup",
          cameraSettings: { position: "side", resolution: "1920x1080", fps: 60 },
        },
        { uid: "test-user-123" },
      );

      await createSessionHandler(request);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          userId: "test-user-123",
          exerciseType: "pushup",
          status: "active",
          repCount: 0,
          setCount: 0,
          formFeedback: null,
          sessionMetadata: null,
          bigquerySyncStatus: "pending",
          bigquerySyncedAt: null,
          bigquerySyncError: null,
          bigquerySyncRetryCount: 0,
          cameraSettings: {
            position: "side",
            resolution: "1920x1080",
            fps: 60,
          },
        }),
      );
    });

    it("should log session creation", async () => {
      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await createSessionHandler(request);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Creating session",
        expect.objectContaining({
          userId: "test-user-123",
          exerciseType: "squat",
        }),
      );

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Session created",
        expect.objectContaining({
          userId: "test-user-123",
          sessionId: expect.any(String),
          exerciseType: "squat",
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore write errors", async () => {
      mockSet.mockRejectedValue(new Error("Firestore write error"));

      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("internal");
      }
    });

    it("should re-throw HttpsError as is", async () => {
      mockRequireAuthWithWritePermission.mockRejectedValue(
        new HttpsError("resource-exhausted", "Rate limit exceeded"),
      );

      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      await expect(createSessionHandler(request)).rejects.toThrow();
      try {
        await createSessionHandler(request);
      } catch (error) {
        expect((error as HttpsError).code).toBe("resource-exhausted");
      }
    });

    it("should log errors on failure", async () => {
      mockSet.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest(
        {
          exerciseType: "squat",
          cameraSettings: { position: "side", resolution: "1280x720", fps: 30 },
        },
        { uid: "test-user-123" },
      );

      try {
        await createSessionHandler(request);
      } catch {
        // Expected
      }

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to create session",
        expect.any(Error),
        expect.objectContaining({ userId: "test-user-123" }),
      );
    });
  });
});
