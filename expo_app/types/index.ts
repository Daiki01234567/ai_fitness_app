/**
 * 型定義のエクスポート
 */

// Re-export environment types (for IDE support)
import "./env.d";

// MediaPipe types
export * from "./mediapipe";

// Exercise types (Ticket 020)
export * from "./exercise";

/**
 * API レスポンスの基本型
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * ページネーション情報
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * ページネーション付きAPIレスポンス
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}
