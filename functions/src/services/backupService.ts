/**
 * バックアップサービス
 *
 * Firestoreデータベースの自動バックアップ機能を提供
 * - Cloud Storageへのバックアップ保存
 * - 古いバックアップの自動削除
 * - バックアップログの記録
 *
 * チケット 030 対応
 *
 * 参照: docs/common/specs/02-2_非機能要件_v1_0.md - NFR-027, NFR-028
 * 参照: docs/common/tickets/030-backup-recovery.md
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { Storage } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getFirestore } from "../utils/firestore";
import { logger } from "../utils/logger";

// Admin SDK がまだ初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// =============================================================================
// 定数定義
// =============================================================================

/**
 * バックアップタイプ
 */
export type BackupType = "daily" | "weekly" | "manual";

/**
 * バックアップステータス
 */
export type BackupStatus = "pending" | "in_progress" | "success" | "failed";

/**
 * バックアップ保持期間（日数）
 */
export const RETENTION_DAYS: Record<"daily" | "weekly", number> = {
  daily: 30,
  weekly: 90,
};

/**
 * バックアップログのコレクション名
 */
export const BACKUP_LOGS_COLLECTION = "backupLogs";

// =============================================================================
// 型定義
// =============================================================================

/**
 * バックアップログドキュメント
 */
export interface BackupLog {
  id?: string;
  type: BackupType;
  status: BackupStatus;
  outputUriPrefix?: string;
  operationName?: string;
  error?: string;
  fileCount?: number;
  sizeBytes?: number;
  durationMs?: number;
  createdAt: Timestamp | FieldValue;
  completedAt?: Timestamp | FieldValue;
}

/**
 * バックアップ結果
 */
export interface BackupResult {
  success: boolean;
  outputUriPrefix?: string;
  operationName?: string;
  error?: string;
  durationMs: number;
}

/**
 * バックアップステータスサマリー
 */
export interface BackupStatusSummary {
  logs: Array<BackupLog & { id: string }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    lastSuccessfulBackup?: {
      type: BackupType;
      timestamp: string;
      outputUriPrefix?: string;
    };
  };
}

/**
 * 削除結果
 */
export interface CleanupResult {
  deletedCount: number;
  errors: string[];
}

// =============================================================================
// プライベート関数
// =============================================================================

/**
 * プロジェクトIDを取得
 */
function getProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error("プロジェクトIDが設定されていません");
  }
  return projectId;
}

/**
 * バックアップ用バケット名を取得
 */
function getBackupBucketName(): string {
  const projectId = getProjectId();
  // 環境変数でカスタムバケット名が指定されていればそれを使用
  return process.env.BACKUP_BUCKET_NAME || `${projectId}-firestore-backups`;
}

/**
 * タイムスタンプ文字列を生成（ファイル名用）
 */
function generateTimestamp(): string {
  return new Date().toISOString().replace(/:/g, "-").split(".")[0];
}

// =============================================================================
// バックアップ実行関数
// =============================================================================

/**
 * Firestoreのエクスポート（バックアップ）を実行
 *
 * @param type バックアップタイプ
 * @returns バックアップ結果
 */
export async function executeFirestoreBackup(type: BackupType): Promise<BackupResult> {
  const startTime = Date.now();
  const projectId = getProjectId();
  const bucketName = getBackupBucketName();
  const timestamp = generateTimestamp();
  const outputUriPrefix = `gs://${bucketName}/${type}/${timestamp}`;

  logger.info(`Firestoreバックアップ開始: ${type}`, {
    projectId,
    bucketName,
    outputUriPrefix,
  });

  // バックアップログを作成（開始時）
  const logRef = await db.collection(BACKUP_LOGS_COLLECTION).add({
    type,
    status: "in_progress" as BackupStatus,
    outputUriPrefix,
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    // Firestore Admin API を使用してエクスポート
    // Note: Firebase Admin SDKには直接exportDocumentsメソッドがないため、
    // REST APIを呼び出す必要があります
    const response = await exportFirestoreDocuments(projectId, outputUriPrefix);

    const durationMs = Date.now() - startTime;

    // バックアップログを更新（成功）
    await logRef.update({
      status: "success" as BackupStatus,
      operationName: response.operationName,
      durationMs,
      completedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Firestoreバックアップ完了: ${type}`, {
      outputUriPrefix,
      operationName: response.operationName,
      durationMs,
    });

    return {
      success: true,
      outputUriPrefix,
      operationName: response.operationName,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // バックアップログを更新（失敗）
    await logRef.update({
      status: "failed" as BackupStatus,
      error: errorMessage,
      durationMs,
      completedAt: FieldValue.serverTimestamp(),
    });

    logger.error(`Firestoreバックアップ失敗: ${type}`, error as Error, {
      outputUriPrefix,
      durationMs,
    });

    return {
      success: false,
      outputUriPrefix,
      error: errorMessage,
      durationMs,
    };
  }
}

/**
 * Firestore Export API を呼び出し
 *
 * @param projectId プロジェクトID
 * @param outputUriPrefix 出力先URI
 * @returns オペレーション情報
 */
async function exportFirestoreDocuments(
  projectId: string,
  outputUriPrefix: string,
): Promise<{ operationName: string }> {
  // Google Cloud Identity Token を取得
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error("アクセストークンの取得に失敗しました");
  }

  // Firestore Admin REST API を呼び出し
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      outputUriPrefix,
      // collectionIds を空にすると全コレクションをエクスポート
      collectionIds: [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firestore Export API エラー: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { name?: string };
  return {
    operationName: data.name || "unknown",
  };
}

// =============================================================================
// 古いバックアップの削除関数
// =============================================================================

/**
 * 古いバックアップを削除
 *
 * @returns 削除結果
 */
export async function deleteOldBackups(): Promise<CleanupResult> {
  const storage = new Storage();
  const bucketName = getBackupBucketName();
  const result: CleanupResult = {
    deletedCount: 0,
    errors: [],
  };

  logger.info("古いバックアップの削除開始", { bucketName });

  try {
    // daily バックアップの削除（30日以上前）
    const dailyResult = await deleteOldBackupsInFolder(
      storage,
      bucketName,
      "daily",
      RETENTION_DAYS.daily,
    );
    result.deletedCount += dailyResult.deletedCount;
    result.errors.push(...dailyResult.errors);

    // weekly バックアップの削除（90日以上前）
    const weeklyResult = await deleteOldBackupsInFolder(
      storage,
      bucketName,
      "weekly",
      RETENTION_DAYS.weekly,
    );
    result.deletedCount += weeklyResult.deletedCount;
    result.errors.push(...weeklyResult.errors);

    logger.info("古いバックアップの削除完了", {
      deletedCount: result.deletedCount,
      errorCount: result.errors.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("古いバックアップの削除でエラー発生", error as Error);
    result.errors.push(errorMessage);
  }

  return result;
}

/**
 * 特定フォルダ内の古いバックアップを削除
 *
 * @param storage Cloud Storage クライアント
 * @param bucketName バケット名
 * @param folder フォルダ名
 * @param retentionDays 保持日数
 * @returns 削除結果
 */
async function deleteOldBackupsInFolder(
  storage: Storage,
  bucketName: string,
  folder: string,
  retentionDays: number,
): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    errors: [],
  };

  try {
    const bucket = storage.bucket(bucketName);

    // バケットが存在するか確認
    const [exists] = await bucket.exists();
    if (!exists) {
      logger.warn(`バケットが存在しません: ${bucketName}`);
      return result;
    }

    const [files] = await bucket.getFiles({ prefix: `${folder}/` });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // ディレクトリごとにグループ化（タイムスタンプベース）
    const directoryMap = new Map<string, Array<{ file: typeof files[0]; createdDate: Date }>>();

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const createdDate = new Date(metadata.timeCreated as string);

      // ディレクトリ名を抽出（例: daily/2025-12-10T02-00-00）
      const pathParts = file.name.split("/");
      if (pathParts.length >= 2) {
        const dirName = `${pathParts[0]}/${pathParts[1]}`;
        if (!directoryMap.has(dirName)) {
          directoryMap.set(dirName, []);
        }
        directoryMap.get(dirName)?.push({ file, createdDate });
      }
    }

    // 古いディレクトリを削除
    for (const [dirName, dirFiles] of directoryMap.entries()) {
      // ディレクトリ内の最も古いファイルの日付を取得
      const oldestDate = dirFiles.reduce(
        (min, item) => (item.createdDate < min ? item.createdDate : min),
        dirFiles[0]?.createdDate || new Date(),
      );

      if (oldestDate < cutoffDate) {
        // ディレクトリ内のすべてのファイルを削除
        for (const { file } of dirFiles) {
          try {
            await file.delete();
            result.deletedCount++;
            logger.debug("バックアップファイルを削除", {
              fileName: file.name,
              createdDate: oldestDate.toISOString(),
            });
          } catch (deleteError) {
            const errorMessage = deleteError instanceof Error
              ? deleteError.message
              : "Unknown error";
            result.errors.push(`${file.name}: ${errorMessage}`);
          }
        }
        logger.info("古いバックアップディレクトリを削除", {
          directory: dirName,
          fileCount: dirFiles.length,
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`フォルダ ${folder} のバックアップ削除でエラー`, error as Error);
    result.errors.push(errorMessage);
  }

  return result;
}

// =============================================================================
// ステータス取得関数
// =============================================================================

/**
 * バックアップステータスを取得（過去7日間）
 *
 * @param days 取得する日数（デフォルト7日）
 * @param limit 取得件数上限（デフォルト30件）
 * @returns バックアップステータスサマリー
 */
export async function getBackupStatus(days = 7, limit = 30): Promise<BackupStatusSummary> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const snapshot = await db
    .collection(BACKUP_LOGS_COLLECTION)
    .where("createdAt", ">=", Timestamp.fromDate(cutoffDate))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const logs: Array<BackupLog & { id: string }> = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<BackupLog & { id: string }>;

  const successCount = logs.filter((log) => log.status === "success").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;

  // 最後の成功したバックアップを取得
  const lastSuccessful = logs.find((log) => log.status === "success");
  let lastSuccessfulBackup: BackupStatusSummary["summary"]["lastSuccessfulBackup"];

  if (lastSuccessful && lastSuccessful.createdAt) {
    const createdAt = lastSuccessful.createdAt as Timestamp;
    lastSuccessfulBackup = {
      type: lastSuccessful.type,
      timestamp: createdAt.toDate().toISOString(),
      outputUriPrefix: lastSuccessful.outputUriPrefix,
    };
  }

  return {
    logs,
    summary: {
      total: logs.length,
      success: successCount,
      failed: failedCount,
      lastSuccessfulBackup,
    },
  };
}

/**
 * バックアップバケットの情報を取得
 *
 * @returns バケット情報
 */
export async function getBackupBucketInfo(): Promise<{
  bucketName: string;
  exists: boolean;
  totalSize?: number;
  dailyBackupCount?: number;
  weeklyBackupCount?: number;
}> {
  const storage = new Storage();
  const bucketName = getBackupBucketName();

  try {
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();

    if (!exists) {
      return { bucketName, exists: false };
    }

    // ファイル数とサイズを取得
    const [files] = await bucket.getFiles();

    let totalSize = 0;
    let dailyCount = 0;
    let weeklyCount = 0;
    const dailyDirs = new Set<string>();
    const weeklyDirs = new Set<string>();

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalSize += parseInt(metadata.size as string, 10) || 0;

      if (file.name.startsWith("daily/")) {
        const pathParts = file.name.split("/");
        if (pathParts.length >= 2) {
          dailyDirs.add(pathParts[1]);
        }
      } else if (file.name.startsWith("weekly/")) {
        const pathParts = file.name.split("/");
        if (pathParts.length >= 2) {
          weeklyDirs.add(pathParts[1]);
        }
      }
    }

    dailyCount = dailyDirs.size;
    weeklyCount = weeklyDirs.size;

    return {
      bucketName,
      exists: true,
      totalSize,
      dailyBackupCount: dailyCount,
      weeklyBackupCount: weeklyCount,
    };
  } catch (error) {
    logger.error("バケット情報の取得に失敗", error as Error);
    return { bucketName, exists: false };
  }
}

// =============================================================================
// アラート関数
// =============================================================================

/**
 * 管理者にアラートを送信（バックアップ失敗時）
 *
 * @param params アラートパラメータ
 */
export async function sendBackupAlert(params: {
  type: "backup_failure" | "cleanup_failure";
  backupType?: BackupType;
  message: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { type, backupType, message, details } = params;

  // アラートログを記録
  await db.collection("adminAlerts").add({
    type,
    backupType,
    message,
    details,
    severity: "critical",
    acknowledged: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  // クリティカルログとして出力（Cloud Monitoring でアラート設定可能）
  logger.critical(`バックアップアラート: ${message}`, undefined, {
    type,
    backupType,
    ...details,
  });

  // TODO: 将来的にはSlackやメールでの通知を実装
  // 現在はログ出力とFirestore記録のみ
}
