/**
 * Skeleton Overlay Component
 *
 * Renders skeleton visualization over camera preview.
 * Shows detected landmarks as points and connections as lines.
 * Color-coded by confidence level for debugging.
 *
 * Reference: docs/expo/tickets/013-skeleton-detection.md
 */

import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";

import type { Landmark } from "@/types/mediapipe";
import { VISIBILITY_THRESHOLDS } from "@/types/mediapipe";
import { SKELETON_CONNECTIONS, getVisibilityLevel } from "@/services/mediapipe";

/**
 * Color palette for different visibility levels
 */
const VISIBILITY_COLORS = {
  high: "#4caf50", // Green - high confidence
  medium: "#ff9800", // Orange - medium confidence
  low: "#f44336", // Red - low confidence
  none: "#9e9e9e", // Gray - not visible
} as const;

/**
 * Props for SkeletonOverlay component
 */
interface SkeletonOverlayProps {
  /** Array of 33 landmarks from MediaPipe */
  landmarks: Landmark[] | null;
  /** Width of the camera frame */
  frameWidth?: number;
  /** Height of the camera frame */
  frameHeight?: number;
  /** Whether to show landmark points */
  showPoints?: boolean;
  /** Whether to show skeleton lines */
  showLines?: boolean;
  /** Whether to color-code by visibility */
  showConfidenceColors?: boolean;
  /** Point radius */
  pointRadius?: number;
  /** Line stroke width */
  lineWidth?: number;
  /** Base color for uniform coloring */
  baseColor?: string;
  /** Minimum visibility threshold to show landmarks */
  visibilityThreshold?: number;
  /** Flip horizontally (for front camera mirror) */
  mirrored?: boolean;
}

/**
 * Default props values
 */
const DEFAULT_PROPS = {
  showPoints: true,
  showLines: true,
  showConfidenceColors: true,
  pointRadius: 6,
  lineWidth: 2,
  baseColor: "#4caf50",
  visibilityThreshold: VISIBILITY_THRESHOLDS.MINIMUM,
  mirrored: true,
};

/**
 * Get color for landmark based on visibility
 */
function getLandmarkColor(visibility: number, showConfidenceColors: boolean, baseColor: string): string {
  if (!showConfidenceColors) return baseColor;

  const level = getVisibilityLevel(visibility);
  return VISIBILITY_COLORS[level];
}

/**
 * Get point style based on visibility
 */
function getPointOpacity(visibility: number): number {
  if (visibility >= 0.8) return 1;
  if (visibility >= 0.5) return 0.8;
  if (visibility >= 0.3) return 0.5;
  return 0.3;
}

/**
 * SkeletonOverlay Component
 *
 * Renders a skeleton visualization over the camera preview.
 * Useful for debugging pose detection and showing user feedback.
 *
 * @example
 * <View style={styles.container}>
 *   <Camera ... />
 *   <SkeletonOverlay
 *     landmarks={currentPose?.landmarks}
 *     showConfidenceColors={true}
 *   />
 * </View>
 */
export function SkeletonOverlay({
  landmarks,
  frameWidth,
  frameHeight,
  showPoints = DEFAULT_PROPS.showPoints,
  showLines = DEFAULT_PROPS.showLines,
  showConfidenceColors = DEFAULT_PROPS.showConfidenceColors,
  pointRadius = DEFAULT_PROPS.pointRadius,
  lineWidth = DEFAULT_PROPS.lineWidth,
  baseColor = DEFAULT_PROPS.baseColor,
  visibilityThreshold = DEFAULT_PROPS.visibilityThreshold,
  mirrored = DEFAULT_PROPS.mirrored,
}: SkeletonOverlayProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Use window dimensions if frame dimensions not provided
  const width = frameWidth ?? windowWidth;
  const height = frameHeight ?? windowHeight;

  // Transform landmark coordinates to screen coordinates
  const transformedLandmarks = useMemo(() => {
    if (!landmarks || landmarks.length === 0) return [];

    return landmarks.map((landmark) => ({
      ...landmark,
      // Convert normalized coordinates (0-1) to screen coordinates
      screenX: mirrored ? (1 - landmark.x) * width : landmark.x * width,
      screenY: landmark.y * height,
    }));
  }, [landmarks, width, height, mirrored]);

  // Filter visible landmarks
  const visibleLandmarks = useMemo(() => {
    return transformedLandmarks.filter((l) => l.visibility >= visibilityThreshold);
  }, [transformedLandmarks, visibilityThreshold]);

  // Render nothing if no landmarks
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  // Render skeleton connections
  const renderConnections = () => {
    if (!showLines) return null;

    return SKELETON_CONNECTIONS.map((connection, index) => {
      const startLandmark = transformedLandmarks[connection.start];
      const endLandmark = transformedLandmarks[connection.end];

      // Skip if either landmark is not visible enough
      if (
        !startLandmark ||
        !endLandmark ||
        startLandmark.visibility < visibilityThreshold ||
        endLandmark.visibility < visibilityThreshold
      ) {
        return null;
      }

      // Calculate average visibility for the line
      const avgVisibility = (startLandmark.visibility + endLandmark.visibility) / 2;
      const color = getLandmarkColor(avgVisibility, showConfidenceColors, baseColor);
      const opacity = getPointOpacity(avgVisibility);

      return (
        <Line
          key={`connection-${index}`}
          x1={startLandmark.screenX}
          y1={startLandmark.screenY}
          x2={endLandmark.screenX}
          y2={endLandmark.screenY}
          stroke={color}
          strokeWidth={lineWidth}
          strokeOpacity={opacity}
          strokeLinecap="round"
        />
      );
    });
  };

  // Render landmark points
  const renderPoints = () => {
    if (!showPoints) return null;

    return visibleLandmarks.map((landmark, index) => {
      const color = getLandmarkColor(landmark.visibility, showConfidenceColors, baseColor);
      const opacity = getPointOpacity(landmark.visibility);

      // Find the original index for the key
      const originalIndex = transformedLandmarks.findIndex(
        (l) => l.screenX === landmark.screenX && l.screenY === landmark.screenY
      );

      return (
        <Circle
          key={`landmark-${originalIndex}`}
          cx={landmark.screenX}
          cy={landmark.screenY}
          r={pointRadius}
          fill={color}
          fillOpacity={opacity}
          stroke="#fff"
          strokeWidth={1}
          strokeOpacity={opacity * 0.5}
        />
      );
    });
  };

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <G>
          {/* Render lines first (below points) */}
          {renderConnections()}
          {/* Render points on top */}
          {renderPoints()}
        </G>
      </Svg>
    </View>
  );
}

/**
 * Simplified skeleton overlay for minimal debugging
 */
export function MinimalSkeletonOverlay({
  landmarks,
  color = "#00ff00",
}: {
  landmarks: Landmark[] | null;
  color?: string;
}) {
  return (
    <SkeletonOverlay
      landmarks={landmarks}
      showConfidenceColors={false}
      baseColor={color}
      pointRadius={4}
      lineWidth={1.5}
      visibilityThreshold={0.5}
    />
  );
}

/**
 * Debug skeleton overlay with full visibility information
 */
export function DebugSkeletonOverlay({
  landmarks,
}: {
  landmarks: Landmark[] | null;
}) {
  return (
    <SkeletonOverlay
      landmarks={landmarks}
      showConfidenceColors={true}
      showPoints={true}
      showLines={true}
      pointRadius={8}
      lineWidth={3}
      visibilityThreshold={0.3}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

export default SkeletonOverlay;
