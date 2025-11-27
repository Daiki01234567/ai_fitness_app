/**
 * Jest Test Setup
 * Configures the test environment before running tests
 */

// Mock Firebase Admin
jest.mock("firebase-admin", () => {
  const mockTimestamp = {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
    increment: jest.fn((n) => n),
    delete: jest.fn(() => null),
    arrayUnion: jest.fn((...args) => args),
    arrayRemove: jest.fn((...args) => args),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockFirestore),
    doc: jest.fn(() => mockFirestore),
    get: jest.fn(() =>
      Promise.resolve({
        exists: true,
        id: "test-id",
        data: () => ({}),
        ref: { path: "test/path" },
      }),
    ),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    add: jest.fn(() => Promise.resolve({ id: "new-id" })),
    where: jest.fn(() => mockFirestore),
    orderBy: jest.fn(() => mockFirestore),
    limit: jest.fn(() => mockFirestore),
    startAfter: jest.fn(() => mockFirestore),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(() => Promise.resolve()),
    })),
    runTransaction: jest.fn((fn) => fn(mockFirestore)),
  };

  const mockAuth = {
    verifyIdToken: jest.fn(() =>
      Promise.resolve({
        uid: "test-uid",
        email: "test@example.com",
        email_verified: true,
      }),
    ),
    getUser: jest.fn(() =>
      Promise.resolve({
        uid: "test-uid",
        email: "test@example.com",
        customClaims: {},
      }),
    ),
    getUserByEmail: jest.fn(() =>
      Promise.resolve({
        uid: "test-uid",
        email: "test@example.com",
      }),
    ),
    setCustomUserClaims: jest.fn(() => Promise.resolve()),
    revokeRefreshTokens: jest.fn(() => Promise.resolve()),
    deleteUser: jest.fn(() => Promise.resolve()),
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    app: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    auth: jest.fn(() => mockAuth),
    credential: {
      applicationDefault: jest.fn(),
    },
  };
});

// Mock Firebase Functions
jest.mock("firebase-functions", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  config: jest.fn(() => ({})),
}));

// Mock Firebase Functions v2
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((handler) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

// Mock Google Cloud Tasks
jest.mock("@google-cloud/tasks", () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    queuePath: jest.fn(
      (project, location, queue) => `projects/${project}/locations/${location}/queues/${queue}`,
    ),
    createTask: jest.fn(() => Promise.resolve([{ name: "task-name" }])),
    deleteTask: jest.fn(() => Promise.resolve()),
    pauseQueue: jest.fn(() => Promise.resolve()),
    resumeQueue: jest.fn(() => Promise.resolve()),
  })),
}));

// Mock Google Cloud BigQuery
jest.mock("@google-cloud/bigquery", () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    dataset: jest.fn(() => ({
      table: jest.fn(() => ({
        insert: jest.fn(() => Promise.resolve()),
      })),
    })),
    query: jest.fn(() => Promise.resolve([[]])),
  })),
}));

// Set environment variables for testing
process.env.GCLOUD_PROJECT = "test-project";
process.env.FUNCTIONS_BASE_URL = "https://test.cloudfunctions.net";
process.env.ANONYMIZATION_SALT = "test-salt";

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
