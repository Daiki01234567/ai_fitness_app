/**
 * トレーニング状態管理ストア
 *
 * Zustandを使用してトレーニングセッションの状態を管理します。
 * 現在のセッション、レップ情報、セッションの開始/終了を制御します。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { create } from "zustand";

/**
 * サポートされる種目タイプ
 * @see docs/specs/08_README_form_validation_logic_v3_3.md
 */
export type ExerciseType =
  | "squat"
  | "arm_curl"
  | "side_raise"
  | "shoulder_press"
  | "push_up";

/**
 * レップデータの型定義
 */
export interface RepData {
  /** レップ番号 */
  repNumber: number;
  /** フォームスコア（0-100） */
  score: number;
  /** 開始時刻 */
  startTime: Date;
  /** 終了時刻 */
  endTime: Date;
  /** フィードバックメッセージ */
  feedback: string[];
  /** 骨格データ（33関節×4値） */
  poseData?: number[][];
}

/**
 * トレーニングセッションの型定義
 */
export interface TrainingSession {
  /** セッションID */
  sessionId: string;
  /** 種目タイプ */
  exerciseType: ExerciseType;
  /** セッション開始時刻 */
  startTime: Date;
  /** セッション終了時刻 */
  endTime: Date | null;
  /** レップデータの配列 */
  reps: RepData[];
  /** 合計スコア（平均） */
  totalScore: number;
}

/**
 * トレーニング状態の型定義
 */
interface TrainingState {
  // State
  /** 現在のトレーニングセッション */
  currentSession: TrainingSession | null;
  /** トレーニング実行中フラグ */
  isActive: boolean;
  /** 一時停止フラグ */
  isPaused: boolean;
  /** エラーメッセージ */
  error: string | null;

  // Actions
  /** セッションを開始 */
  startSession: (exerciseType: ExerciseType) => void;
  /** セッションを終了 */
  endSession: () => void;
  /** レップを追加 */
  addRep: (repData: RepData) => void;
  /** セッションを一時停止 */
  pauseSession: () => void;
  /** セッションを再開 */
  resumeSession: () => void;
  /** セッションをリセット */
  resetSession: () => void;
  /** エラーを設定 */
  setError: (error: string | null) => void;
}

/**
 * ユニークなセッションIDを生成
 */
const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `session_${timestamp}_${randomPart}`;
};

/**
 * 平均スコアを計算
 */
const calculateAverageScore = (reps: RepData[]): number => {
  if (reps.length === 0) return 0;
  const totalScore = reps.reduce((sum, rep) => sum + rep.score, 0);
  return Math.round(totalScore / reps.length);
};

/**
 * トレーニングストア
 *
 * 使用例:
 * ```tsx
 * function TrainingScreen() {
 *   const {
 *     currentSession,
 *     isActive,
 *     startSession,
 *     endSession,
 *     addRep
 *   } = useTrainingStore();
 *
 *   const handleStart = () => {
 *     startSession('squat');
 *   };
 *
 *   const handleRepComplete = (repData: RepData) => {
 *     addRep(repData);
 *   };
 *
 *   const handleEnd = () => {
 *     endSession();
 *     // Navigate to results screen
 *   };
 *
 *   return (
 *     <View>
 *       {isActive ? (
 *         <TrainingView
 *           session={currentSession}
 *           onRepComplete={handleRepComplete}
 *           onEnd={handleEnd}
 *         />
 *       ) : (
 *         <Button onPress={handleStart}>Start Training</Button>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export const useTrainingStore = create<TrainingState>((set) => ({
  // Initial state
  currentSession: null,
  isActive: false,
  isPaused: false,
  error: null,

  // Actions
  startSession: (exerciseType) =>
    set({
      currentSession: {
        sessionId: generateSessionId(),
        exerciseType,
        startTime: new Date(),
        endTime: null,
        reps: [],
        totalScore: 0,
      },
      isActive: true,
      isPaused: false,
      error: null,
    }),

  endSession: () =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            endTime: new Date(),
          }
        : null,
      isActive: false,
      isPaused: false,
    })),

  addRep: (repData) =>
    set((state) => {
      if (!state.currentSession) return state;

      const updatedReps = [...state.currentSession.reps, repData];
      return {
        currentSession: {
          ...state.currentSession,
          reps: updatedReps,
          totalScore: calculateAverageScore(updatedReps),
        },
      };
    }),

  pauseSession: () => set({ isPaused: true }),

  resumeSession: () => set({ isPaused: false }),

  resetSession: () =>
    set({
      currentSession: null,
      isActive: false,
      isPaused: false,
      error: null,
    }),

  setError: (error) => set({ error }),
}));
