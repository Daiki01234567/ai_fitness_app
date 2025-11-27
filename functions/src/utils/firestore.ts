/**
 * Firestore Helper Utilities
 * Common operations for Firestore database
 */

import * as admin from "firebase-admin";
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldValue,
  Query,
  QueryDocumentSnapshot,
  Transaction,
  WriteBatch,
} from "firebase-admin/firestore";

import { logger } from "./logger";

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Get Firestore instance
 */
export function getFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Get server timestamp
 */
export function serverTimestamp(): FieldValue {
  return FieldValue.serverTimestamp();
}

/**
 * Convert Firestore timestamp to ISO string
 */
export function timestampToISOString(
  timestamp: admin.firestore.Timestamp | undefined | null,
): string | undefined {
  if (!timestamp) {
    return undefined;
  }
  return timestamp.toDate().toISOString();
}

/**
 * Convert Date to Firestore timestamp
 */
export function dateToTimestamp(date: Date): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Pagination result interface
 */
export interface PaginationResult<T> {
  items: T[];
  nextPageToken?: string;
  hasMore: boolean;
}

/**
 * Paginate query results
 */
export async function paginateQuery<T>(
  query: Query<DocumentData>,
  limit: number,
  pageToken?: string,
  transform?: (doc: QueryDocumentSnapshot<DocumentData>) => T,
): Promise<PaginationResult<T>> {
  let paginatedQuery = query;

  // Apply cursor if page token provided
  if (pageToken) {
    try {
      const cursorData = JSON.parse(Buffer.from(pageToken, "base64").toString()) as {
        docId: string;
      };
      const cursorDoc = await getFirestore().doc(cursorData.docId).get();
      if (cursorDoc.exists) {
        paginatedQuery = query.startAfter(cursorDoc);
      }
    } catch (error) {
      logger.warn("Invalid page token", { pageToken }, error as Error);
      // Continue without cursor
    }
  }

  // Get one extra to check if there are more
  const snapshot = await paginatedQuery.limit(limit + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;

  // Remove extra document
  if (hasMore) {
    docs.pop();
  }

  // Transform documents
  const items = docs.map((doc) => {
    if (transform) {
      return transform(doc);
    }
    return { id: doc.id, ...doc.data() } as T;
  });

  // Generate next page token
  let nextPageToken: string | undefined;
  if (hasMore && docs.length > 0) {
    const lastDoc = docs[docs.length - 1];
    nextPageToken = Buffer.from(
      JSON.stringify({ docId: lastDoc.ref.path }),
    ).toString("base64");
  }

  return { items, nextPageToken, hasMore };
}

/**
 * Batch write helper with automatic chunking (max 500 operations per batch)
 */
export async function batchWrite<T>(
  items: T[],
  operation: (batch: WriteBatch, item: T) => void,
  chunkSize = 500,
): Promise<number> {
  const db = getFirestore();
  let totalWrites = 0;

  // Process in chunks
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = db.batch();

    for (const item of chunk) {
      operation(batch, item);
    }

    await batch.commit();
    totalWrites += chunk.length;

    logger.debug("Batch write completed", {
      processed: totalWrites,
      total: items.length,
    });
  }

  return totalWrites;
}

/**
 * Transaction helper with automatic retry
 */
export async function runTransaction<T>(
  operation: (transaction: Transaction) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const db = getFirestore();
  let lastError: Error = new Error("Transaction failed");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.runTransaction(operation);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Transaction failed, attempt ${attempt}/${maxRetries}`, undefined, lastError);

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }

  throw lastError;
}

/**
 * Check if document exists
 */
export async function documentExists(ref: DocumentReference): Promise<boolean> {
  const doc = await ref.get();
  return doc.exists;
}

/**
 * Get document with type safety
 */
export async function getDocument<T>(
  ref: DocumentReference,
): Promise<(T & { id: string }) | null> {
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() } as T & { id: string };
}

/**
 * Get document or throw error
 */
export async function getDocumentOrThrow<T>(
  ref: DocumentReference,
  errorMessage?: string,
): Promise<T & { id: string }> {
  const doc = await getDocument<T>(ref);
  if (!doc) {
    throw new Error(errorMessage ?? `Document not found: ${ref.path}`);
  }
  return doc;
}

/**
 * Create document with auto ID
 */
export async function createDocument<T extends DocumentData>(
  collection: CollectionReference,
  data: T,
): Promise<string> {
  const docRef = await collection.add({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update document with timestamp
 */
export async function updateDocument(
  ref: DocumentReference,
  data: Partial<DocumentData>,
): Promise<void> {
  await ref.update({
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete document and its subcollections
 */
export async function deleteDocumentWithSubcollections(
  ref: DocumentReference,
  subcollections: string[],
): Promise<void> {
  const db = getFirestore();

  // Delete subcollections first
  for (const subcollectionName of subcollections) {
    const subcollectionRef = ref.collection(subcollectionName);
    const snapshot = await subcollectionRef.get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Delete main document
  await ref.delete();
}

/**
 * Query helper with common filters
 */
export function queryBuilder<T extends DocumentData>(
  collection: CollectionReference<T>,
): QueryBuilder<T> {
  return new QueryBuilder(collection);
}

/**
 * Fluent query builder
 */
class QueryBuilder<T extends DocumentData> {
  private query: Query<T>;

  constructor(collection: CollectionReference<T>) {
    this.query = collection;
  }

  where(
    field: string,
    operator: admin.firestore.WhereFilterOp,
    value: unknown,
  ): QueryBuilder<T> {
    this.query = this.query.where(field, operator, value);
    return this;
  }

  whereEqual(field: string, value: unknown): QueryBuilder<T> {
    return this.where(field, "==", value);
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): QueryBuilder<T> {
    this.query = this.query.orderBy(field, direction);
    return this;
  }

  limit(limit: number): QueryBuilder<T> {
    this.query = this.query.limit(limit);
    return this;
  }

  async get(): Promise<QueryDocumentSnapshot<T>[]> {
    const snapshot = await this.query.get();
    return snapshot.docs;
  }

  async getFirst(): Promise<(T & { id: string }) | null> {
    const docs = await this.limit(1).get();
    if (docs.length === 0) {
      return null;
    }
    return { id: docs[0].id, ...docs[0].data() };
  }

  async count(): Promise<number> {
    const snapshot = await this.query.count().get();
    return snapshot.data().count;
  }

  getQuery(): Query<T> {
    return this.query;
  }
}

/**
 * Users collection reference
 */
export function usersCollection(): CollectionReference {
  return getFirestore().collection("users");
}

/**
 * User document reference
 */
export function userRef(userId: string): DocumentReference {
  return usersCollection().doc(userId);
}

/**
 * User sessions collection reference
 */
export function sessionsCollection(userId: string): CollectionReference {
  return userRef(userId).collection("sessions");
}

/**
 * Session document reference
 */
export function sessionRef(userId: string, sessionId: string): DocumentReference {
  return sessionsCollection(userId).doc(sessionId);
}

/**
 * Consents collection reference
 */
export function consentsCollection(): CollectionReference {
  return getFirestore().collection("consents");
}

/**
 * Data deletion requests collection reference
 */
export function dataDeletionRequestsCollection(): CollectionReference {
  return getFirestore().collection("dataDeletionRequests");
}

/**
 * BigQuery sync failures collection reference
 */
export function bigquerySyncFailuresCollection(): CollectionReference {
  return getFirestore().collection("bigquerySyncFailures");
}
