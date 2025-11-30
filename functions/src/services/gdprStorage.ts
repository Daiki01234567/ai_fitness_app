/**
 * GDPR Storage サービス
 *
 * Cloud Storage のユーザーデータ操作を提供
 * - ユーザーファイルの削除
 * - 削除検証
 * - エクスポート用データ収集
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { Storage } from "@google-cloud/storage";

import {
  StorageDeletionResult,
  StorageExportData,
} from "../types/gdpr";
import { logger } from "../utils/logger";

import { getUserUploadsBucketName } from "./gdpr/helpers";

// Cloud Storage クライアント
const storage = new Storage();

// =============================================================================
// Storage 削除関数
// =============================================================================

/**
 * ユーザーの Cloud Storage データを削除
 *
 * ユーザーフォルダ配下の全ファイルを削除する
 *
 * @param userId - 削除対象のユーザー ID
 * @returns Storage 削除結果
 *
 * @example
 * ```typescript
 * const result = await deleteUserStorage("user123");
 * if (result.deleted) {
 *   console.log(`Deleted ${result.filesCount} files`);
 * }
 * ```
 */
export async function deleteUserStorage(userId: string): Promise<StorageDeletionResult> {
  const startTime = Date.now();
  const bucketName = getUserUploadsBucketName();

  logger.info("Starting user storage deletion", { userId, bucketName });

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    // List all files under the user's folder
    const [files] = await bucket.getFiles({ prefix: userPrefix });

    if (files.length === 0) {
      logger.info("No storage files found for user", { userId });
      return {
        deleted: true,
        files: [],
        filesCount: 0,
        totalSizeBytes: 0,
      };
    }

    const deletedFiles: string[] = [];
    let totalSizeBytes = 0;

    // Delete files in batches
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          try {
            // Get file metadata for size tracking
            const [metadata] = await file.getMetadata();
            totalSizeBytes += parseInt(String(metadata.size || "0"), 10);

            await file.delete();
            deletedFiles.push(file.name);
          } catch (error) {
            logger.warn("Failed to delete storage file", { fileName: file.name }, error as Error);
          }
        }),
      );
    }

    logger.info("User storage deletion completed", {
      userId,
      filesCount: deletedFiles.length,
      totalSizeBytes,
      durationMs: Date.now() - startTime,
    });

    return {
      deleted: true,
      files: deletedFiles,
      filesCount: deletedFiles.length,
      totalSizeBytes,
    };
  } catch (error) {
    logger.error("User storage deletion failed", error as Error, { userId });
    return {
      deleted: false,
      files: [],
      filesCount: 0,
      totalSizeBytes: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Storage 内のユーザーデータが削除されているか検証
 *
 * @param userId - 検証対象のユーザー ID
 * @returns 削除が完了している場合は true
 *
 * @example
 * ```typescript
 * const isDeleted = await verifyStorageDeletion("user123");
 * if (!isDeleted) {
 *   console.error("Storage data still exists");
 * }
 * ```
 */
export async function verifyStorageDeletion(userId: string): Promise<boolean> {
  const bucketName = getUserUploadsBucketName();

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    const [files] = await bucket.getFiles({ prefix: userPrefix, maxResults: 1 });

    return files.length === 0;
  } catch (error) {
    logger.error("Storage deletion verification failed", error as Error, { userId });
    return false;
  }
}

// =============================================================================
// Storage データ収集関数（エクスポート用）
// =============================================================================

/**
 * ユーザーの Storage データを収集（エクスポート用）
 *
 * プロフィール画像とメディアファイルのメタデータを収集する
 * プロフィール画像は Base64 エンコードで含める
 *
 * @param userId - ユーザー ID
 * @returns Storage エクスポートデータ
 *
 * @example
 * ```typescript
 * const storageData = await collectStorageData("user123");
 * if (storageData.profileImage) {
 *   console.log(`Profile image: ${storageData.profileImage.fileName}`);
 * }
 * ```
 */
export async function collectStorageData(userId: string): Promise<StorageExportData> {
  const startTime = Date.now();
  const bucketName = getUserUploadsBucketName();

  logger.info("Collecting storage data for export", { userId, bucketName });

  const result: StorageExportData = {};

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    // List all files under the user's folder
    const [files] = await bucket.getFiles({ prefix: userPrefix });

    if (files.length === 0) {
      logger.info("No storage files found for user", { userId });
      return result;
    }

    // Process profile image
    const profileImageFile = files.find(
      (f) =>
        f.name.includes("profile") &&
        (f.name.endsWith(".jpg") ||
          f.name.endsWith(".jpeg") ||
          f.name.endsWith(".png") ||
          f.name.endsWith(".webp")),
    );

    if (profileImageFile) {
      try {
        const [metadata] = await profileImageFile.getMetadata();
        const [fileContent] = await profileImageFile.download();

        result.profileImage = {
          fileName: profileImageFile.name.split("/").pop() || "profile_image",
          contentType: metadata.contentType || "image/jpeg",
          size: parseInt(String(metadata.size || "0"), 10),
          base64Data: fileContent.toString("base64"),
        };

        logger.info("Profile image collected", {
          userId,
          fileName: result.profileImage.fileName,
          size: result.profileImage.size,
        });
      } catch (error) {
        logger.warn("Failed to collect profile image", { userId }, error as Error);
      }
    }

    // Collect metadata for other media files (training videos, etc.)
    const mediaFiles = files.filter(
      (f) =>
        !f.name.includes("profile") &&
        (f.name.endsWith(".mp4") ||
          f.name.endsWith(".mov") ||
          f.name.endsWith(".jpg") ||
          f.name.endsWith(".png")),
    );

    if (mediaFiles.length > 0) {
      result.mediaFiles = [];

      for (const file of mediaFiles) {
        try {
          const [metadata] = await file.getMetadata();
          result.mediaFiles.push({
            fileName: file.name.split("/").pop() || "unknown",
            path: file.name,
            contentType: metadata.contentType || "application/octet-stream",
            size: parseInt(String(metadata.size || "0"), 10),
          });
        } catch (error) {
          logger.warn("Failed to collect media file metadata", { fileName: file.name }, error as Error);
        }
      }

      logger.info("Media files metadata collected", {
        userId,
        count: result.mediaFiles.length,
      });
    }

    logger.info("Storage data collection completed", {
      userId,
      hasProfileImage: !!result.profileImage,
      mediaFilesCount: result.mediaFiles?.length || 0,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error("Failed to collect storage data", error as Error, { userId });
    // Return empty result instead of throwing to allow export to continue
    return result;
  }
}

/**
 * プロフィール画像のバイナリデータを取得
 *
 * ZIP アーカイブ作成時にプロフィール画像を含めるために使用
 *
 * @param userId - ユーザー ID
 * @returns プロフィール画像の Buffer（存在しない場合は undefined）
 *
 * @example
 * ```typescript
 * const imageBuffer = await getProfileImageBuffer("user123");
 * if (imageBuffer) {
 *   archive.append(imageBuffer, { name: "profile.jpg" });
 * }
 * ```
 */
export async function getProfileImageBuffer(userId: string): Promise<Buffer | undefined> {
  const bucketName = getUserUploadsBucketName();

  try {
    const bucket = storage.bucket(bucketName);
    const userPrefix = `users/${userId}/`;

    const [files] = await bucket.getFiles({ prefix: userPrefix });

    const profileImageFile = files.find(
      (f) =>
        f.name.includes("profile") &&
        (f.name.endsWith(".jpg") ||
          f.name.endsWith(".jpeg") ||
          f.name.endsWith(".png") ||
          f.name.endsWith(".webp")),
    );

    if (profileImageFile) {
      const [fileContent] = await profileImageFile.download();
      return fileContent;
    }

    return undefined;
  } catch (error) {
    logger.warn("Failed to get profile image buffer", { userId }, error as Error);
    return undefined;
  }
}
