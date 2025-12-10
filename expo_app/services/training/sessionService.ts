/**
 * トレーニングセッション保存サービス
 *
 * トレーニングセッションの結果をFirestoreに保存するサービスです。
 *
 * @see docs/expo/tickets/022-session-result-screen.md
 * @see docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
 */

import { ExerciseType } from "@/types/exercise";

/**
 * セッションデータの型定義
 */
export interface SessionData {
  /** 種目タイプ */
  exerciseType: ExerciseType | string;
  /** レップ数 */
  reps: number;
  /** トレーニング時間（秒） */
  duration: number;
  /** 平均スコア (0-100) */
  averageScore: number;
  /** フィードバックリスト */
  feedbacks: string[];
  /** 骨格データ（33関節×4値） */
  poseData?: number[][];
  /** メモ */
  memo?: string;
  /** 目標レップ数 */
  targetReps?: number;
}

/**
 * 保存されたセッションの型定義
 */
export interface SavedSession extends SessionData {
  /** セッションID */
  id: string;
  /** ユーザーID */
  userId: string;
  /** 作成日時 */
  createdAt: Date;
}

/**
 * セッション保存結果
 */
export interface SaveSessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * セッションをFirestoreに保存
 *
 * Note: 現在はモック実装です。
 * 本番環境ではFirestore SDKを使用して実際に保存します。
 */
export async function saveSession(sessionData: SessionData): Promise<SaveSessionResult> {
  try {
    // TODO: Implement actual Firestore save logic
    // import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
    // import { getAuth } from 'firebase/auth';
    //
    // const auth = getAuth();
    // const userId = auth.currentUser?.uid;
    // if (!userId) throw new Error('User not authenticated');
    //
    // const db = getFirestore();
    // const docRef = await addDoc(
    //   collection(db, 'users', userId, 'sessions'),
    //   {
    //     ...sessionData,
    //     createdAt: serverTimestamp(),
    //   }
    // );
    // return { success: true, sessionId: docRef.id };

    // Mock implementation for development
    console.log("[SessionService] Saving session:", sessionData);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock session ID
    const mockSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log("[SessionService] Session saved with ID:", mockSessionId);

    return {
      success: true,
      sessionId: mockSessionId,
    };
  } catch (error) {
    console.error("[SessionService] Failed to save session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存に失敗しました",
    };
  }
}

/**
 * セッションを取得
 */
export async function getSession(sessionId: string): Promise<SavedSession | null> {
  try {
    // TODO: Implement actual Firestore fetch logic
    console.log("[SessionService] Fetching session:", sessionId);

    // Mock implementation
    return null;
  } catch (error) {
    console.error("[SessionService] Failed to fetch session:", error);
    return null;
  }
}

/**
 * セッションを削除
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    // TODO: Implement actual Firestore delete logic
    console.log("[SessionService] Deleting session:", sessionId);

    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  } catch (error) {
    console.error("[SessionService] Failed to delete session:", error);
    return false;
  }
}

/**
 * 時間をフォーマット (MM:SS)
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * スコアに応じた色を取得
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "#4CAF50"; // Green - good
  if (score >= 60) return "#FFC107"; // Yellow - average
  return "#F44336"; // Red - needs improvement
}

/**
 * スコアに応じたラベルを取得
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return "素晴らしい";
  if (score >= 80) return "良好";
  if (score >= 60) return "普通";
  if (score >= 40) return "改善の余地あり";
  return "要練習";
}
