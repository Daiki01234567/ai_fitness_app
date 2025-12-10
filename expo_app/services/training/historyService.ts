/**
 * トレーニング履歴取得サービス
 *
 * トレーニング履歴をFirestoreから取得するサービスです。
 * TanStack Queryと組み合わせて使用します。
 *
 * @see docs/expo/tickets/024-history-screen.md
 * @see docs/common/specs/03_Firestoreデータベース設計書_v1_0.md
 */

import { ExerciseType } from "@/types/exercise";

/**
 * トレーニングセッション
 */
export interface TrainingSession {
  /** セッションID */
  id: string;
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
  /** メモ */
  memo?: string;
  /** 作成日時 */
  createdAt: Date;
}

/**
 * セッション取得パラメータ
 */
export interface FetchSessionsParams {
  /** 種目フィルター */
  exerciseType?: ExerciseType | string | null;
  /** 日付範囲フィルター */
  dateRange: "week" | "month" | "all";
  /** 最後のドキュメント（ページネーション用） */
  lastDoc?: unknown;
  /** 取得数 */
  limit: number;
}

/**
 * セッション取得結果
 */
export interface FetchSessionsResult {
  /** セッションリスト */
  sessions: TrainingSession[];
  /** 最後のドキュメント（ページネーション用） */
  lastDoc: unknown;
  /** 次のページがあるか */
  hasMore: boolean;
}

/**
 * 日付範囲の開始日を取得
 */
function getDateRangeStart(dateRange: "week" | "month" | "all"): Date | null {
  const now = new Date();

  switch (dateRange) {
    case "week":
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case "month":
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo;
    case "all":
    default:
      return null;
  }
}

/**
 * モックデータを生成
 */
function generateMockSessions(count: number): TrainingSession[] {
  const exerciseTypes = Object.values(ExerciseType);
  const sessions: TrainingSession[] = [];

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 12) + 8); // 8:00 - 20:00

    const randomExerciseIndex = Math.floor(Math.random() * exerciseTypes.length);
    const randomExercise = exerciseTypes[randomExerciseIndex] || ExerciseType.SQUAT;

    sessions.push({
      id: `session_${Date.now()}_${i}`,
      exerciseType: randomExercise,
      reps: Math.floor(Math.random() * 15) + 5,
      duration: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
      averageScore: Math.floor(Math.random() * 40) + 60, // 60-100
      feedbacks: ["参考: 良いフォームです", "参考: 安定したテンポです"],
      memo: Math.random() > 0.5 ? "良い調子でした" : undefined,
      createdAt,
    });
  }

  // Sort by date (newest first)
  return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * トレーニングセッション履歴を取得
 */
export async function fetchTrainingSessions({
  exerciseType,
  dateRange,
  lastDoc,
  limit,
}: FetchSessionsParams): Promise<FetchSessionsResult> {
  try {
    // TODO: Implement actual Firestore query
    // import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
    // import { getAuth } from 'firebase/auth';
    //
    // const auth = getAuth();
    // const userId = auth.currentUser?.uid;
    // if (!userId) throw new Error('User not authenticated');
    //
    // const db = getFirestore();
    // let q = query(
    //   collection(db, 'users', userId, 'sessions'),
    //   orderBy('createdAt', 'desc'),
    //   limit(limit)
    // );
    //
    // if (exerciseType) {
    //   q = query(q, where('exerciseType', '==', exerciseType));
    // }
    //
    // const dateStart = getDateRangeStart(dateRange);
    // if (dateStart) {
    //   q = query(q, where('createdAt', '>=', dateStart));
    // }
    //
    // if (lastDoc) {
    //   q = query(q, startAfter(lastDoc));
    // }
    //
    // const snapshot = await getDocs(q);
    // const sessions = snapshot.docs.map(doc => ({
    //   id: doc.id,
    //   ...doc.data(),
    //   createdAt: doc.data().createdAt.toDate(),
    // }));
    //
    // return {
    //   sessions,
    //   lastDoc: snapshot.docs[snapshot.docs.length - 1],
    //   hasMore: snapshot.docs.length === limit,
    // };

    console.log("[HistoryService] Fetching sessions:", { exerciseType, dateRange, limit });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock data
    const mockSessions = generateMockSessions(50);

    // Apply filters
    let filteredSessions = mockSessions;

    // Exercise type filter
    if (exerciseType) {
      filteredSessions = filteredSessions.filter(
        (session) => session.exerciseType === exerciseType
      );
    }

    // Date range filter
    const dateStart = getDateRangeStart(dateRange);
    if (dateStart) {
      filteredSessions = filteredSessions.filter(
        (session) => session.createdAt >= dateStart
      );
    }

    // Pagination
    const startIndex = lastDoc ? (lastDoc as number) : 0;
    const paginatedSessions = filteredSessions.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filteredSessions.length;

    return {
      sessions: paginatedSessions,
      lastDoc: startIndex + limit,
      hasMore,
    };
  } catch (error) {
    console.error("[HistoryService] Failed to fetch sessions:", error);
    return {
      sessions: [],
      lastDoc: null,
      hasMore: false,
    };
  }
}

/**
 * 統計情報を取得
 */
export interface HistoryStats {
  totalSessions: number;
  totalReps: number;
  totalMinutes: number;
  averageScore: number;
}

export async function fetchHistoryStats(dateRange: "week" | "month" | "all"): Promise<HistoryStats> {
  try {
    // TODO: Implement actual Firestore aggregation
    console.log("[HistoryService] Fetching stats:", { dateRange });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock stats
    return {
      totalSessions: 0,
      totalReps: 0,
      totalMinutes: 0,
      averageScore: 0,
    };
  } catch (error) {
    console.error("[HistoryService] Failed to fetch stats:", error);
    return {
      totalSessions: 0,
      totalReps: 0,
      totalMinutes: 0,
      averageScore: 0,
    };
  }
}

/**
 * 種目名を日本語で取得
 */
export function getExerciseLabel(exerciseType: string | null | undefined): string {
  if (!exerciseType) return "全て";

  const labels: Record<string, string> = {
    [ExerciseType.SQUAT]: "スクワット",
    [ExerciseType.PUSHUP]: "プッシュアップ",
    [ExerciseType.ARM_CURL]: "アームカール",
    [ExerciseType.SIDE_RAISE]: "サイドレイズ",
    [ExerciseType.SHOULDER_PRESS]: "ショルダープレス",
  };

  return labels[exerciseType] || exerciseType;
}
