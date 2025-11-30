/**
 * Firestore Utilities Tests
 * 
 * firestore.tsの各ヘルパー関数のユニットテスト
 * 参照仕様: docs/specs/02_Firestoreデータベース設計書_v3_3.md
 */

import * as admin from "firebase-admin";

// firebase-adminのモック設定（インポート前に実行）
jest.mock("firebase-admin", () => {
  const mockTimestamp = {
    toDate: jest.fn(() => new Date("2024-01-01T00:00:00Z")),
    toMillis: jest.fn(() => 1704067200000),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => mockTimestamp),
  };

  const mockDocRef = {
    id: "doc-123",
    path: "users/user-123",
    get: jest.fn(() => Promise.resolve({
      exists: true,
      id: "doc-123",
      data: () => ({ name: "Test User" }),
    })),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    collection: jest.fn(),
  };

  const mockQuerySnapshot = {
    docs: [
      {
        id: "doc-1",
        ref: { path: "users/doc-1" },
        data: () => ({ name: "User 1" }),
      },
      {
        id: "doc-2",
        ref: { path: "users/doc-2" },
        data: () => ({ name: "User 2" }),
      },
    ],
    empty: false,
  };

  const mockCountSnapshot = {
    data: () => ({ count: 2 }),
  };

  const mockQuery = {
    where: jest.fn(function() { return this; }),
    orderBy: jest.fn(function() { return this; }),
    limit: jest.fn(function() { return this; }),
    startAfter: jest.fn(function() { return this; }),
    get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
    count: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve(mockCountSnapshot)),
    })),
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(() => Promise.resolve(mockDocRef)),
    where: jest.fn(() => mockQuery),
    orderBy: jest.fn(() => mockQuery),
    limit: jest.fn(() => mockQuery),
    get: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
  };

  // Set up circular reference after declaration
  mockDocRef.collection = jest.fn(() => mockCollectionRef);

  const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  };

  const mockTransaction = {
    get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollectionRef),
    doc: jest.fn(() => mockDocRef),
    batch: jest.fn(() => mockBatch),
    runTransaction: jest.fn((callback) => callback(mockTransaction)),
    FieldValue: mockFieldValue,
    Timestamp: {
      fromDate: jest.fn((date) => ({
        toDate: () => date,
        toMillis: () => date.getTime(),
      })),
    },
  };

  return {
    apps: [{ name: "test-app" }],
    initializeApp: jest.fn(),
    app: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
  };
});

// ���b�N��ɃC���|�[�g
import {
  getFirestore,
  serverTimestamp,
  timestampToISOString,
  dateToTimestamp,
  batchWrite,
  runTransaction,
  documentExists,
  getDocument,
  getDocumentOrThrow,
  createDocument,
  updateDocument,
  deleteDocumentWithSubcollections,
  queryBuilder,
  usersCollection,
  userRef,
  sessionsCollection,
  sessionRef,
  consentsCollection,
  dataDeletionRequestsCollection,
  bigquerySyncFailuresCollection,
} from "../../src/utils/firestore";

describe("Firestore Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getFirestore", () => {
    it("Firestore�C���X�^���X���擾�ł��邱��", () => {
      const db = getFirestore();
      expect(db).toBeDefined();
      expect(admin.firestore).toHaveBeenCalled();
    });
  });

  describe("serverTimestamp", () => {
    it("�T�[�o�[�^�C���X�^���v���擾�ł��邱��", () => {
      const timestamp = serverTimestamp();
      expect(timestamp).toBeDefined();
    });
  });

  describe("timestampToISOString", () => {
    it("Timestamp�𐳂���ISO������ɕϊ��ł��邱��", () => {
      const mockTs = {
        toDate: () => new Date("2024-01-01T00:00:00Z"),
      } as admin.firestore.Timestamp;

      const isoString = timestampToISOString(mockTs);
      expect(isoString).toBe("2024-01-01T00:00:00.000Z");
    });

    it("null�̏ꍇ��undefined��Ԃ�����", () => {
      expect(timestampToISOString(null)).toBeUndefined();
    });

    it("undefined�̏ꍇ��undefined��Ԃ�����", () => {
      expect(timestampToISOString(undefined)).toBeUndefined();
    });
  });

  describe.skip("dateToTimestamp", () => {
    it("Date��Timestamp�ɕϊ��ł��邱��", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const timestamp = dateToTimestamp(date);
      expect(timestamp).toBeDefined();
    });
  });

  describe("batchWrite", () => {
    it("�A�C�e�����o�b�`�ŏ������݂ł��邱��", async () => {
      const items = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ];

      const operation = jest.fn();
      const totalWrites = await batchWrite(items, operation);

      expect(totalWrites).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("runTransaction", () => {
    it("�g�����U�N�V�����𐳏�Ɏ��s�ł��邱��", async () => {
      const operation = jest.fn(async () => "success");

      const result = await runTransaction(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("documentExists", () => {
    it("�h�L�������g�����݂���ꍇ��true��Ԃ�����", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");

      const exists = await documentExists(docRef);

      expect(exists).toBe(true);
    });
  });

  describe("getDocument", () => {
    it("�h�L�������g�����݂���ꍇ�̓f�[�^��Ԃ�����", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");

      const doc = await getDocument(docRef);

      expect(doc).toEqual({
        id: "doc-123",
        name: "Test User",
      });
    });
  });

  describe("getDocumentOrThrow", () => {
    it("�h�L�������g�����݂���ꍇ�̓f�[�^��Ԃ�����", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");

      const doc = await getDocumentOrThrow(docRef);

      expect(doc).toEqual({
        id: "doc-123",
        name: "Test User",
      });
    });
  });

  describe("createDocument", () => {
    it("����ID�Ńh�L�������g���쐬�ł��邱��", async () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const data = { name: "New User" };
      const docId = await createDocument(collection, data);

      expect(docId).toBe("doc-123");
    });
  });

  describe("updateDocument", () => {
    it("updatedAt�^�C���X�^���v�t���Ńh�L�������g���X�V�ł��邱��", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");
      
      const data = { name: "Updated User" };
      await updateDocument(docRef, data);

      expect(docRef.update).toHaveBeenCalled();
    });
  });

  describe("deleteDocumentWithSubcollections", () => {
    it("�h�L�������g�ƃT�u�R���N�V�������폜�ł��邱��", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");
      
      await deleteDocumentWithSubcollections(docRef, ["sessions"]);

      expect(docRef.delete).toHaveBeenCalled();
    });
  });

  describe("QueryBuilder", () => {
    it("�N�G�����\�z�ł��邱��", async () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const builder = queryBuilder(collection);
      await builder.where("age", ">=", 18).get();

      expect(collection.where).toHaveBeenCalled();
    });
  });

  describe("Collection References", () => {
    it("usersCollection��Users�R���N�V�����Q�Ƃ��擾�ł��邱��", () => {
      const collection = usersCollection();
      expect(collection).toBeDefined();
    });

    it("userRef��User�h�L�������g�Q�Ƃ��擾�ł��邱��", () => {
      const docRef = userRef("user-123");
      expect(docRef).toBeDefined();
    });

    it("sessionsCollection��Sessions�R���N�V�����Q�Ƃ��擾�ł��邱��", () => {
      const collection = sessionsCollection("user-123");
      expect(collection).toBeDefined();
    });

    it("sessionRef��Session�h�L�������g�Q�Ƃ��擾�ł��邱��", () => {
      const docRef = sessionRef("user-123", "session-456");
      expect(docRef).toBeDefined();
    });

    it("consentsCollection��Consents�R���N�V�����Q�Ƃ��擾�ł��邱��", () => {
      const collection = consentsCollection();
      expect(collection).toBeDefined();
    });

    it("dataDeletionRequestsCollection�ō폜���N�G�X�g�R���N�V�����Q�Ƃ��擾�ł��邱��", () => {
      const collection = dataDeletionRequestsCollection();
      expect(collection).toBeDefined();
    });

    it("bigquerySyncFailuresCollection��BigQuery�������s�R���N�V�����Q�Ƃ��擾�ł��邱��", () => {
      const collection = bigquerySyncFailuresCollection();
      expect(collection).toBeDefined();
    });
  });
});


  describe("runTransaction - �G���[�n���h�����O", () => {
    it("Error�I�u�W�F�N�g�ȊO�̃G���[�������ł��邱��", async () => {
      const db = getFirestore();
      db.runTransaction = jest.fn(() => {
        throw "string error";
      }) as any;

      const operation = jest.fn();
      await expect(runTransaction(operation, 1)).rejects.toThrow();
    });
  });

  describe("getDocument - null����", () => {
    it("�h�L�������g�����݂��Ȃ��ꍇ��null��Ԃ�����", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/non-existent");
      
      docRef.get = jest.fn(() => Promise.resolve({
        exists: false,
      })) as any;

      const result = await getDocument(docRef);
      expect(result).toBeNull();
    });
  });

  describe("deleteDocumentWithSubcollections - �����T�u�R���N�V����", () => {
    it("�����̃T�u�R���N�V�������o�b�`�ō폜�ł��邱��", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");
      
      const mockSubcollection = {
        get: jest.fn(() => Promise.resolve({
          empty: false,
          docs: [
            { ref: { id: "sub-1" } },
            { ref: { id: "sub-2" } },
          ],
        })),
      };
      
      docRef.collection = jest.fn(() => mockSubcollection) as any;

      await deleteDocumentWithSubcollections(docRef, ["sessions", "consents"]);

      expect(docRef.collection).toHaveBeenCalledTimes(2);
      expect(db.batch).toHaveBeenCalledTimes(2);
    });
  });

  describe("QueryBuilder - ���x�ȑ���", () => {
    it("orderBy��limit��g�ݍ��킹�Ďg�p�ł��邱��", async () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const builder = queryBuilder(collection);
      const result = await builder
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      expect(result).toBeDefined();
    });

    it("whereEqual��orderBy��g�ݍ��킹�Ďg�p�ł��邱��", async () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const builder = queryBuilder(collection);
      const result = await builder
        .whereEqual("status", "active")
        .orderBy("createdAt", "asc")
        .get();

      expect(result).toBeDefined();
    });

    it("getQuery���\�b�h�œ����N�G�����擾�ł��邱��", () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const builder = queryBuilder(collection);
      const query = builder.getQuery();

      expect(query).toBeDefined();
    });
  });

  describe("createDocument - �^�C���X�^���v�ǉ�", () => {
    it("createdAt��updatedAt�������I�ɒǉ�����邱��", async () => {
      const db = getFirestore();
      const collection = db.collection("users");
      
      const data = { name: "Test User", email: "test@example.com" };
      await createDocument(collection, data);

      const addedData = collection.add.mock.calls[0][0];
      expect(addedData).toHaveProperty("createdAt");
      expect(addedData).toHaveProperty("updatedAt");
      expect(addedData.name).toBe("Test User");
      expect(addedData.email).toBe("test@example.com");
    });
  });

  describe("updateDocument - �^�C���X�^���v�X�V", () => {
    it("updatedAt�������I�ɍX�V����邱��", async () => {
      const db = getFirestore();
      const docRef = db.doc("users/user-123");
      
      const updateData = { email: "newemail@example.com" };
      await updateDocument(docRef, updateData);

      const updatedData = docRef.update.mock.calls[0][0];
      expect(updatedData).toHaveProperty("updatedAt");
      expect(updatedData.email).toBe("newemail@example.com");
    });
  });

  describe("paginateQuery - comprehensive", () => {
    it("should handle pagination with transform", async () => {
      const paginateQuery = require("../../src/utils/firestore").paginateQuery;
      const db = getFirestore();
      const query = db.collection("users");
      const transform = (doc: any) => ({ customId: doc.id });
      const result = await paginateQuery(query, 10, undefined, transform);
      expect(result.items[0]).toHaveProperty("customId");
    });
  });

  describe("runTransaction - retry logic", () => {
    it("should retry on failure", async () => {
      const runTransaction = require("../../src/utils/firestore").runTransaction;
      const db = getFirestore();
      let attempts = 0;
      db.runTransaction = jest.fn(() => {
        attempts++;
        if (attempts < 2) return Promise.reject(new Error("Conflict"));
        return Promise.resolve("success");
      }) as any;
      const operation = jest.fn(async () => "result");
      await runTransaction(operation, 3);
      expect(attempts).toBe(2);
    });
  });

  describe("getDocumentOrThrow - error", () => {
    it("should throw when not found", async () => {
      const getDocumentOrThrow = require("../../src/utils/firestore").getDocumentOrThrow;
      const db = getFirestore();
      const docRef = db.doc("users/missing");
      docRef.get = jest.fn(() => Promise.resolve({ exists: false })) as any;
      await expect(getDocumentOrThrow(docRef)).rejects.toThrow();
    });
  });

  describe("QueryBuilder - getFirst null", () => {
    it("should return null when empty", async () => {
      const queryBuilder = require("../../src/utils/firestore").queryBuilder;
      const db = getFirestore();
      const collection = db.collection("users");
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({ docs: [] })),
      };
      collection.where = jest.fn(() => mockQuery as any);
      const builder = queryBuilder(collection);
      const result = await builder.where("status", "==", "deleted").getFirst();
      expect(result).toBeNull();
    });
  });
