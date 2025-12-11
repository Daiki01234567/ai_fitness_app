/**
 * Firestore Security Rules Tests
 *
 * Based on:
 * - docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
 * - docs/common/tickets/002-firestore-security-rules.md
 * - firebase/firestore.rules
 *
 * Test Strategy:
 * - Test authentication requirements
 * - Test ownership validation
 * - Test field-level access control
 * - Test GDPR compliance (deletion scheduled users)
 * - Test immutability constraints
 * - Test admin-only collections
 *
 * @version 1.1.0
 * @date 2025-12-10
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  doc,
  Firestore,
} from "firebase/firestore";

// Firestore ルールファイルを読み込み
const rulesPath = resolve(__dirname, "../firestore.rules");
const rules = readFileSync(rulesPath, "utf8");

// テストデータ
const USER_ID = "user123";
const OTHER_USER_ID = "other456";
const ADMIN_USER_ID = "admin789";
const SESSION_ID = "session001";
const CONSENT_ID = "consent001";

// Unique project ID for each test run to avoid conflicts
const PROJECT_ID = `test-ai-fitness-${Date.now()}`;

// テスト環境
let testEnv: RulesTestEnvironment;

// ========================================
// Setup and Teardown
// ========================================

beforeAll(async () => {
  // テスト環境を初期化
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
}, 30000);

afterAll(async () => {
  // テスト環境をクリーンアップ
  if (testEnv) {
    await testEnv.cleanup();
  }
}, 30000);

beforeEach(async () => {
  // 各テスト前にデータベースをクリア
  await testEnv.clearFirestore();
});

afterEach(async () => {
  // Allow pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// ========================================
// ヘルパー関数
// ========================================

/**
 * ユーザードキュメントを作成するヘルパー (Admin SDK経由)
 */
async function createUserDocument(
  userId: string,
  data: Record<string, unknown> = {},
  deletionScheduled = false,
): Promise<void> {
  // Use withSecurityRulesDisabled for admin-like operations
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", userId), {
      email: `${userId}@example.com`,
      tosAccepted: true,
      ppAccepted: true,
      tosAcceptedAt: Timestamp.now(),
      ppAcceptedAt: Timestamp.now(),
      tosVersion: "1.0",
      ppVersion: "1.0",
      deletionScheduled,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...data,
    });
  });
}

/**
 * セッションドキュメントを作成するヘルパー (Admin SDK経由)
 */
async function createSessionDocument(
  userId: string,
  sessionId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", userId, "sessions", sessionId), {
      sessionId,
      userId,
      exerciseType: "squat",
      startTime: Timestamp.now(),
      status: "active",
      createdAt: Timestamp.now(),
      ...data,
    });
  });
}

/**
 * Get user Firestore context
 */
function getUserContext(userId: string): Firestore {
  return testEnv.authenticatedContext(userId).firestore() as unknown as Firestore;
}

/**
 * Get admin Firestore context
 */
function getAdminContext(): Firestore {
  return testEnv
    .authenticatedContext(ADMIN_USER_ID, { admin: true })
    .firestore() as unknown as Firestore;
}

/**
 * Get unauthenticated Firestore context
 */
function getUnauthContext(): Firestore {
  return testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
}

// ========================================
// Users Collection Tests
// ========================================

describe("Users Collection", () => {
  describe("Read Access", () => {
    it("未認証ユーザーは読み取りできない", async () => {
      await createUserDocument(USER_ID);
      const db = getUnauthContext();
      await assertFails(getDoc(doc(db, "users", USER_ID)));
    });

    it("認証済みユーザーは自分のドキュメントを読み取りできる", async () => {
      await createUserDocument(USER_ID);
      const db = getUserContext(USER_ID);
      await assertSucceeds(getDoc(doc(db, "users", USER_ID)));
    });

    it("認証済みユーザーは他人のドキュメントを読み取りできない", async () => {
      await createUserDocument(OTHER_USER_ID);
      const db = getUserContext(USER_ID);
      await assertFails(getDoc(doc(db, "users", OTHER_USER_ID)));
    });

    it("削除予定ユーザーは自分のドキュメントを読み取りできる（GDPR Article 20）", async () => {
      await createUserDocument(USER_ID, {}, true);
      const db = getUserContext(USER_ID);
      await assertSucceeds(getDoc(doc(db, "users", USER_ID)));
    });
  });

  describe("Create Access", () => {
    it("未認証ユーザーは作成できない", async () => {
      const db = getUnauthContext();
      await assertFails(
        setDoc(doc(db, "users", USER_ID), {
          email: "test@example.com",
          tosAccepted: true,
          ppAccepted: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("認証済みユーザーは自分のドキュメントを作成できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        setDoc(doc(db, "users", USER_ID), {
          email: "user@example.com",
          tosAccepted: true,
          ppAccepted: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("ToS/PP未同意では作成できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "users", USER_ID), {
          email: "user@example.com",
          tosAccepted: false,
          ppAccepted: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("不正なメールアドレスでは作成できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "users", USER_ID), {
          email: "invalid-email",
          tosAccepted: true,
          ppAccepted: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );
    });
  });

  describe("Update Access", () => {
    beforeEach(async () => {
      await createUserDocument(USER_ID);
    });

    it("認証済みユーザーは自分のプロフィールを更新できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        updateDoc(doc(db, "users", USER_ID), {
          profile: {
            height: 170,
            weight: 65,
            gender: "male",
            fitnessLevel: "intermediate",
          },
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("同意フィールド（tosAccepted）の撤回（true → false）はできない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          tosAccepted: false,
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("同意フィールド（ppAccepted）の撤回（true → false）はできない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          ppAccepted: false,
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("削除予定フィールドは変更できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          deletionScheduled: true,
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("メールアドレスは変更できない（immutable）", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          email: "newemail@example.com",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("削除予定ユーザーは更新できない", async () => {
      await createUserDocument(USER_ID, {}, true);
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          profile: { height: 175 },
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("プロフィールの身長は100-250の範囲外は拒否", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          profile: { height: 300 },
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("プロフィールの体重は30-300の範囲外は拒否", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          profile: { weight: 10 },
          updatedAt: Timestamp.now(),
        }),
      );
    });
  });

  describe("Initial Consent Update", () => {
    it("初回同意（tosAccepted: false → true）は許可される", async () => {
      // Create user with initial consent = false
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users", USER_ID), {
          email: `${USER_ID}@example.com`,
          tosAccepted: false,
          ppAccepted: false,
          deletionScheduled: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertSucceeds(
        updateDoc(doc(db, "users", USER_ID), {
          tosAccepted: true,
          tosAcceptedAt: Timestamp.now(),
          tosVersion: "1.0",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("初回同意（ppAccepted: false → true）は許可される", async () => {
      // Create user with initial consent = false
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users", USER_ID), {
          email: `${USER_ID}@example.com`,
          tosAccepted: false,
          ppAccepted: false,
          deletionScheduled: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertSucceeds(
        updateDoc(doc(db, "users", USER_ID), {
          ppAccepted: true,
          ppAcceptedAt: Timestamp.now(),
          ppVersion: "1.0",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("両方の初回同意（tosAccepted & ppAccepted: false → true）を同時更新できる", async () => {
      // Create user with initial consent = false
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users", USER_ID), {
          email: `${USER_ID}@example.com`,
          tosAccepted: false,
          ppAccepted: false,
          deletionScheduled: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertSucceeds(
        updateDoc(doc(db, "users", USER_ID), {
          tosAccepted: true,
          tosAcceptedAt: Timestamp.now(),
          tosVersion: "1.0",
          ppAccepted: true,
          ppAcceptedAt: Timestamp.now(),
          ppVersion: "1.0",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("初回同意時にタイムスタンプ未設定は拒否される", async () => {
      // Create user with initial consent = false
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users", USER_ID), {
          email: `${USER_ID}@example.com`,
          tosAccepted: false,
          ppAccepted: false,
          deletionScheduled: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          tosAccepted: true,
          // Missing tosAcceptedAt
          tosVersion: "1.0",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("初回同意時にバージョン未設定は拒否される", async () => {
      // Create user with initial consent = false
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users", USER_ID), {
          email: `${USER_ID}@example.com`,
          tosAccepted: false,
          ppAccepted: false,
          deletionScheduled: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          tosAccepted: true,
          tosAcceptedAt: Timestamp.now(),
          // Missing tosVersion
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("同意済み（true → true）の場合、タイムスタンプ・バージョンは変更不可", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID), {
          tosAcceptedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );
    });
  });

  describe("Delete Access", () => {
    beforeEach(async () => {
      await createUserDocument(USER_ID);
    });

    it("ユーザーは自分のドキュメントを削除できない（Cloud Functions only）", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(deleteDoc(doc(db, "users", USER_ID)));
    });
  });
});

// ========================================
// Sessions Subcollection Tests
// ========================================

describe("Sessions Subcollection", () => {
  beforeEach(async () => {
    await createUserDocument(USER_ID);
  });

  describe("Read Access", () => {
    it("認証済みユーザーは自分のセッションを読み取りできる", async () => {
      await createSessionDocument(USER_ID, SESSION_ID);
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        getDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID)),
      );
    });

    it("認証済みユーザーは他人のセッションを読み取りできない", async () => {
      await createUserDocument(OTHER_USER_ID);
      await createSessionDocument(OTHER_USER_ID, SESSION_ID);
      const db = getUserContext(USER_ID);
      await assertFails(
        getDoc(doc(db, "users", OTHER_USER_ID, "sessions", SESSION_ID)),
      );
    });
  });

  describe("Create Access", () => {
    it("認証済みユーザーは自分のセッションを作成できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        setDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          sessionId: SESSION_ID,
          userId: USER_ID,
          exerciseType: "squat",
          startTime: Timestamp.now(),
          status: "active",
          createdAt: Timestamp.now(),
        }),
      );
    });

    it("削除予定ユーザーはセッションを作成できない", async () => {
      await createUserDocument(USER_ID, {}, true);
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          sessionId: SESSION_ID,
          userId: USER_ID,
          exerciseType: "squat",
          startTime: Timestamp.now(),
          status: "active",
          createdAt: Timestamp.now(),
        }),
      );
    });

    it("無効なexerciseTypeでは作成できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          sessionId: SESSION_ID,
          userId: USER_ID,
          exerciseType: "invalid_exercise",
          startTime: Timestamp.now(),
          status: "active",
          createdAt: Timestamp.now(),
        }),
      );
    });
  });

  describe("Update Access", () => {
    beforeEach(async () => {
      await createSessionDocument(USER_ID, SESSION_ID);
    });

    it("認証済みユーザーは自分のセッションを更新できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        updateDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          status: "completed",
          repCount: 10,
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("削除予定ユーザーはセッションを更新できない", async () => {
      await createUserDocument(USER_ID, {}, true);
      await createSessionDocument(USER_ID, SESSION_ID);
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          status: "completed",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("immutableフィールド（sessionId）は変更できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          sessionId: "new_session_id",
          updatedAt: Timestamp.now(),
        }),
      );
    });

    it("repCountは0-1000の範囲外は拒否", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID), {
          repCount: 1001,
          updatedAt: Timestamp.now(),
        }),
      );
    });
  });

  describe("Delete Access", () => {
    beforeEach(async () => {
      await createSessionDocument(USER_ID, SESSION_ID);
    });

    it("ユーザーはセッションを削除できない（Cloud Functions only）", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        deleteDoc(doc(db, "users", USER_ID, "sessions", SESSION_ID)),
      );
    });
  });
});

// ========================================
// Consents Collection Tests
// ========================================

describe("Consents Collection", () => {
  beforeEach(async () => {
    await createUserDocument(USER_ID);
  });

  describe("Read Access", () => {
    it("認証済みユーザーは自分の同意記録を読み取りできる", async () => {
      // Create consent via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "consents", CONSENT_ID), {
          userId: USER_ID,
          consentType: "tos",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertSucceeds(getDoc(doc(db, "consents", CONSENT_ID)));
    });

    it("認証済みユーザーは他人の同意記録を読み取りできない", async () => {
      // Create consent via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "consents", CONSENT_ID), {
          userId: OTHER_USER_ID,
          consentType: "tos",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(getDoc(doc(db, "consents", CONSENT_ID)));
    });
  });

  describe("Create Access", () => {
    it("認証済みユーザーは自分の同意記録を作成できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        setDoc(doc(db, "consents", CONSENT_ID), {
          userId: USER_ID,
          consentType: "tos",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        }),
      );
    });

    it("無効なconsentTypeでは作成できない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "consents", CONSENT_ID), {
          userId: USER_ID,
          consentType: "invalid_type",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        }),
      );
    });
  });

  describe("Update Access", () => {
    it("同意記録は更新できない（immutable audit log）", async () => {
      // Create consent via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "consents", CONSENT_ID), {
          userId: USER_ID,
          consentType: "tos",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "consents", CONSENT_ID), {
          accepted: false,
        }),
      );
    });
  });

  describe("Delete Access", () => {
    it("同意記録は削除できない（immutable audit log）", async () => {
      // Create consent via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "consents", CONSENT_ID), {
          userId: USER_ID,
          consentType: "tos",
          accepted: true,
          version: "1.0",
          timestamp: Timestamp.now(),
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(deleteDoc(doc(db, "consents", CONSENT_ID)));
    });
  });
});

// ========================================
// DataDeletionRequests Collection Tests
// ========================================

describe("DataDeletionRequests Collection", () => {
  const REQUEST_ID = "request001";

  beforeEach(async () => {
    await createUserDocument(USER_ID);
  });

  describe("Read Access", () => {
    it("認証済みユーザーは自分の削除リクエストを読み取りできる", async () => {
      // Create deletion request via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          userId: USER_ID,
          requestedAt: Timestamp.now(),
          status: "pending",
        });
      });

      const db = getUserContext(USER_ID);
      await assertSucceeds(getDoc(doc(db, "dataDeletionRequests", REQUEST_ID)));
    });

    it("認証済みユーザーは他人の削除リクエストを読み取りできない", async () => {
      // Create deletion request via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          userId: OTHER_USER_ID,
          requestedAt: Timestamp.now(),
          status: "pending",
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(getDoc(doc(db, "dataDeletionRequests", REQUEST_ID)));
    });
  });

  describe("Create Access", () => {
    it("認証済みユーザーは自分の削除リクエストを作成できる", async () => {
      const db = getUserContext(USER_ID);
      await assertSucceeds(
        setDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          userId: USER_ID,
          requestedAt: Timestamp.now(),
          status: "pending",
        }),
      );
    });
  });

  describe("Update/Delete Access", () => {
    it("削除リクエストは更新できない（Cloud Functions only）", async () => {
      // Create deletion request via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          userId: USER_ID,
          requestedAt: Timestamp.now(),
          status: "pending",
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(
        updateDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          status: "completed",
        }),
      );
    });

    it("削除リクエストは削除できない（Cloud Functions only）", async () => {
      // Create deletion request via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "dataDeletionRequests", REQUEST_ID), {
          userId: USER_ID,
          requestedAt: Timestamp.now(),
          status: "pending",
        });
      });

      const db = getUserContext(USER_ID);
      await assertFails(deleteDoc(doc(db, "dataDeletionRequests", REQUEST_ID)));
    });
  });
});

// ========================================
// Admin-only Collections Tests
// ========================================

describe("Admin-only Collections", () => {
  beforeEach(async () => {
    await createUserDocument(USER_ID);
  });

  describe("BigQuerySyncFailures Collection", () => {
    const FAILURE_ID = "failure001";

    it("通常ユーザーは読み取りできない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(getDoc(doc(db, "bigquerySyncFailures", FAILURE_ID)));
    });

    it("通常ユーザーは書き込みできない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(
        setDoc(doc(db, "bigquerySyncFailures", FAILURE_ID), {
          error: "test error",
          timestamp: Timestamp.now(),
        }),
      );
    });

    it("管理者は読み書きできる", async () => {
      const db = getAdminContext();
      await assertSucceeds(
        setDoc(doc(db, "bigquerySyncFailures", FAILURE_ID), {
          error: "test error",
          timestamp: Timestamp.now(),
        }),
      );

      await assertSucceeds(getDoc(doc(db, "bigquerySyncFailures", FAILURE_ID)));
    });
  });

  describe("AuditLogs Collection", () => {
    const LOG_ID = "log001";

    it("通常ユーザーは読み取りできない", async () => {
      const db = getUserContext(USER_ID);
      await assertFails(getDoc(doc(db, "auditLogs", LOG_ID)));
    });

    it("管理者は読み取りできる", async () => {
      // Create audit log via admin context (Cloud Functions would do this)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "auditLogs", LOG_ID), {
          action: "test_action",
          timestamp: Timestamp.now(),
        });
      });

      const db = getAdminContext();
      await assertSucceeds(getDoc(doc(db, "auditLogs", LOG_ID)));
    });
  });
});

// ========================================
// Catch-all Deny Rule Tests
// ========================================

describe("Catch-all Deny Rule", () => {
  it("未定義のコレクションへのアクセスは拒否される", async () => {
    const db = getUserContext(USER_ID);
    await assertFails(getDoc(doc(db, "undefinedCollection", "doc001")));
  });

  it("未定義のコレクションへの書き込みは拒否される", async () => {
    const db = getUserContext(USER_ID);
    await assertFails(
      setDoc(doc(db, "undefinedCollection", "doc001"), {
        data: "test",
      }),
    );
  });
});
