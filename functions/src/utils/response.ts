/**
 * レスポンスユーティリティ
 * API 用の標準レスポンスフォーマット
 */

import { ApiResponse, PaginatedResponse, SuccessResponse } from "../types/api";

/**
 * 成功レスポンスを作成
 */
export function success<T>(data: T, message?: string): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };
  if (message) {
    response.message = message;
  }
  return response;
}

/**
 * ページネーション付き成功レスポンスを作成
 */
export function successPaginated<T>(
  items: T[],
  nextPageToken?: string,
  totalCount?: number,
  message?: string,
): SuccessResponse<PaginatedResponse<T>> {
  return success(
    {
      items,
      nextPageToken,
      totalCount,
    },
    message,
  );
}

/**
 * 成功レスポンスの型ガード
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * 空の成功レスポンスを作成
 */
export function successEmpty(message?: string): SuccessResponse<null> {
  return success(null, message);
}

/**
 * 作成完了レスポンスを作成
 */
export function created<T>(data: T, message = "作成しました"): SuccessResponse<T> {
  return success(data, message);
}

/**
 * 更新完了レスポンスを作成
 */
export function updated<T>(data: T, message = "更新しました"): SuccessResponse<T> {
  return success(data, message);
}

/**
 * 削除完了レスポンスを作成
 */
export function deleted(message = "削除しました"): SuccessResponse<null> {
  return successEmpty(message);
}
