/**
 * Training Components Export
 *
 * Central export for all training-related components.
 *
 * @see docs/expo/tickets/020-menu-screen.md
 * @see docs/expo/tickets/021-training-screen.md
 * @see docs/expo/tickets/022-session-result-screen.md
 */

// Camera components
export { CameraView } from "./CameraView";
export { CameraPermissionView } from "./CameraPermissionView";

// Camera hooks
export { useCamera } from "./hooks/useCamera";
export type { CameraPosition, CameraDevice, UseCameraResult } from "./hooks/useCamera";

// Frame processing
export {
  FrameSkipController,
  getFrameSkipController,
  resetFrameSkipController,
  TARGET_FPS_LEVELS,
  PROCESSING_TIME_THRESHOLDS,
} from "./FrameSkipController";
export type { FrameSkipMetrics } from "./FrameSkipController";

// Skeleton overlay
export { SkeletonOverlay, MinimalSkeletonOverlay, DebugSkeletonOverlay } from "./SkeletonOverlay";

// Exercise Card (Ticket 020)
export { ExerciseCard } from "./ExerciseCard";

// Training Session Components (Ticket 021)
export { FeedbackBar, MultiFeedbackBar } from "./FeedbackBar";
export type { FeedbackType } from "./FeedbackBar";

export { ProgressInfo, CompactProgressInfo } from "./ProgressInfo";

export { ControlButtons, FloatingControlButtons, MinimalControlButtons } from "./ControlButtons";

// Session Result (Ticket 022)
export { SessionResult } from "./SessionResult";
