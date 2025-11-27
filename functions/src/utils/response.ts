/**
 * Response Utilities
 * Standard response formatting for API
 */

import { ApiResponse, PaginatedResponse, SuccessResponse } from "../types/api";

/**
 * Create success response
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
 * Create paginated success response
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
 * Type guard for success response
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * Create empty success response
 */
export function successEmpty(message?: string): SuccessResponse<null> {
  return success(null, message);
}

/**
 * Create created response
 */
export function created<T>(data: T, message = "作成しました"): SuccessResponse<T> {
  return success(data, message);
}

/**
 * Create updated response
 */
export function updated<T>(data: T, message = "更新しました"): SuccessResponse<T> {
  return success(data, message);
}

/**
 * Create deleted response
 */
export function deleted(message = "削除しました"): SuccessResponse<null> {
  return successEmpty(message);
}
