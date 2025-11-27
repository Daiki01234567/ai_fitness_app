/**
 * Firestore Mock Helpers
 * Provides mock data and helper functions for testing
 */

import { Timestamp } from "firebase-admin/firestore";

import { User, Session, ExerciseType } from "../../src/types/firestore";

/**
 * Create mock timestamp
 */
export function mockTimestamp(date: Date = new Date()): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: () => true,
    valueOf: () => date.toISOString(),
  } as unknown as Timestamp;
}

/**
 * Create mock user data
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const now = mockTimestamp();
  return {
    nickname: "TestUser",
    email: "test@example.com",
    tosAccepted: true,
    tosAcceptedAt: now,
    tosVersion: "3.2",
    ppAccepted: true,
    ppAcceptedAt: now,
    ppVersion: "3.1",
    deletionScheduled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create mock session data
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  const now = mockTimestamp();
  return {
    exerciseType: "squat" as ExerciseType,
    startTime: now,
    endTime: now,
    repCount: 10,
    totalScore: 850,
    averageScore: 85,
    duration: 300,
    status: "completed",
    sessionMetadata: {
      deviceInfo: {
        platform: "ios",
        model: "iPhone 14",
        osVersion: "17.0",
        screenWidth: 390,
        screenHeight: 844,
      },
      averageFps: 30,
      minFps: 25,
      frameDropCount: 5,
      totalFrames: 9000,
      poseConfidenceAverage: 0.95,
      appVersion: "1.0.0",
      mediaPipeVersion: "0.10.0",
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create mock Firestore document snapshot
 */
export function createMockDocSnapshot<T>(
  id: string,
  data: T | null,
  exists = true,
) {
  return {
    id,
    exists,
    data: () => data,
    ref: {
      path: `test/${id}`,
      id,
      parent: {
        path: "test",
      },
    },
    get: (field: string) => (data as Record<string, unknown>)?.[field],
  };
}

/**
 * Create mock Firestore query snapshot
 */
export function createMockQuerySnapshot<T>(docs: Array<{ id: string; data: T }>) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map(({ id, data }) => createMockDocSnapshot(id, data)),
    forEach: (callback: (doc: ReturnType<typeof createMockDocSnapshot>) => void) => {
      docs.forEach(({ id, data }) => callback(createMockDocSnapshot(id, data)));
    },
  };
}

/**
 * Create mock callable request
 */
export function createMockCallableRequest<T>(
  data: T,
  auth?: { uid: string; token: Record<string, unknown> },
) {
  return {
    data,
    auth: auth ?? {
      uid: "test-uid",
      token: {
        email: "test@example.com",
        email_verified: true,
      },
    },
    rawRequest: {},
  };
}

/**
 * Create mock unauthenticated request
 */
export function createMockUnauthenticatedRequest<T>(data: T) {
  return {
    data,
    auth: null,
    rawRequest: {},
  };
}
