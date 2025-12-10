/**
 * Pose Detection Utilities
 *
 * Export all pose-related utilities for easy importing
 */

// Angle calculations
export {
  calculateAngle2D,
  calculateAngle3D,
  isAngleInRange,
  calculateKneeAngle,
  calculateElbowAngle,
  calculateBodyLineAngle,
} from "./calculateAngle";

// Distance calculations
export {
  calculateDistance2D,
  calculateDistance3D,
  calculateVerticalDistance,
  calculateHorizontalDistance,
  calculateMidpoint2D,
  calculateMidpoint3D,
  isWithinDistance,
  checkSymmetry,
  checkKneeOverToe,
  checkElbowFixed,
  calculateBoundingBoxAspectRatio,
} from "./calculateDistance";

// Landmark filtering
export {
  isLandmarkVisible,
  filterByVisibility,
  getVisibleLandmarkIndices,
  getVisibleLandmark,
  getLandmarkGroup,
  areAllLandmarksVisible,
  countVisibleLandmarks,
  calculateAverageVisibility,
  calculateGroupVisibility,
  getVisibilityStats,
  hasEnoughLandmarksForExercise,
  getMissingLandmarks,
} from "./filterLandmarks";

// FPS measurement
export {
  FpsCounter,
  createFpsMeasurer,
  FrameTimeTracker,
  formatFps,
  formatFrameTime,
} from "./measureFps";
