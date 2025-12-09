/**
 * TanStack Query クライアント設定
 *
 * サーバー状態管理のためのQueryClientを設定します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * デフォルトのQuery設定
 */
const defaultQueryOptions = {
  queries: {
    // 5分間キャッシュを有効化
    staleTime: 5 * 60 * 1000,
    // 30分でキャッシュを破棄
    gcTime: 30 * 60 * 1000,
    // 失敗時のリトライ回数
    retry: 3,
    // リトライ間隔（指数バックオフ）
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // フォーカス時の自動再取得
    refetchOnWindowFocus: false,
    // マウント時の自動再取得
    refetchOnMount: true,
    // 再接続時の自動再取得
    refetchOnReconnect: true,
  },
  mutations: {
    // Mutation失敗時のリトライ回数
    retry: 1,
  },
};

/**
 * QueryClientインスタンス
 */
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});
