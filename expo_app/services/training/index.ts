/**
 * トレーニング関連サービスのエクスポート
 */

// Voice Feedback Service
export { voiceFeedbackService } from "./voiceFeedbackService";
export type { VoiceFeedbackOptions } from "./voiceFeedbackService";

// Session Service
export {
  saveSession,
  getSession,
  deleteSession,
  formatDuration,
  getScoreColor,
  getScoreLabel,
} from "./sessionService";
export type {
  SessionData,
  SavedSession,
  SaveSessionResult,
} from "./sessionService";

// History Service
export {
  fetchTrainingSessions,
  fetchHistoryStats,
  getExerciseLabel,
} from "./historyService";
export type {
  TrainingSession,
  FetchSessionsParams,
  FetchSessionsResult,
  HistoryStats,
} from "./historyService";
