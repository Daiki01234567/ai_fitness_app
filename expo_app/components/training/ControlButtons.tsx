/**
 * 操作ボタンコンポーネント
 *
 * トレーニング実行画面で、一時停止/再開、終了ボタンを表示します。
 *
 * @see docs/expo/tickets/021-training-screen.md
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  error: "#F44336",
  surface: "#FFFFFF",
  text: "#212121",
  textLight: "#FFFFFF",
};

/**
 * Props for ControlButtons component
 */
interface ControlButtonsProps {
  /** 一時停止中かどうか */
  isPaused: boolean;
  /** 一時停止/再開ボタン押下時 */
  onPauseResume: () => void;
  /** 終了ボタン押下時 */
  onEnd: () => void;
  /** ボタンを無効にするか */
  disabled?: boolean;
}

/**
 * ControlButtons Component
 *
 * トレーニングの操作ボタンを表示するコンポーネントです。
 *
 * @example
 * <ControlButtons
 *   isPaused={false}
 *   onPauseResume={handlePauseResume}
 *   onEnd={handleEnd}
 * />
 */
export function ControlButtons({
  isPaused,
  onPauseResume,
  onEnd,
  disabled = false,
}: ControlButtonsProps) {
  return (
    <Surface style={styles.container} elevation={4}>
      <View style={styles.buttonRow}>
        {/* Pause/Resume Button */}
        <Button
          mode="outlined"
          onPress={onPauseResume}
          disabled={disabled}
          icon={isPaused ? "play" : "pause"}
          style={styles.pauseButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {isPaused ? "再開" : "一時停止"}
        </Button>

        {/* End Button */}
        <Button
          mode="contained"
          onPress={onEnd}
          disabled={disabled}
          icon="stop"
          style={styles.endButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          buttonColor={THEME_COLORS.error}
        >
          終了
        </Button>
      </View>
    </Surface>
  );
}

/**
 * Floating control buttons for overlay use
 */
interface FloatingControlButtonsProps extends ControlButtonsProps {
  /** 追加の操作ボタン */
  onMute?: () => void;
  /** ミュート状態 */
  isMuted?: boolean;
}

export function FloatingControlButtons({
  isPaused,
  onPauseResume,
  onEnd,
  disabled = false,
  onMute,
  isMuted = false,
}: FloatingControlButtonsProps) {
  return (
    <View style={styles.floatingContainer}>
      {/* Mute Button (if provided) */}
      {onMute && (
        <IconButton
          icon={isMuted ? "volume-off" : "volume-high"}
          size={28}
          onPress={onMute}
          disabled={disabled}
          style={styles.floatingButton}
          iconColor={THEME_COLORS.textLight}
        />
      )}

      {/* Pause/Resume Button */}
      <IconButton
        icon={isPaused ? "play-circle" : "pause-circle"}
        size={56}
        onPress={onPauseResume}
        disabled={disabled}
        style={[styles.floatingButton, styles.mainButton]}
        iconColor={THEME_COLORS.textLight}
      />

      {/* End Button */}
      <IconButton
        icon="stop-circle"
        size={28}
        onPress={onEnd}
        disabled={disabled}
        style={[styles.floatingButton, styles.endFloatingButton]}
        iconColor={THEME_COLORS.error}
      />
    </View>
  );
}

/**
 * Minimal control buttons for compact display
 */
export function MinimalControlButtons({
  isPaused,
  onPauseResume,
  onEnd,
  disabled = false,
}: ControlButtonsProps) {
  return (
    <View style={styles.minimalContainer}>
      <IconButton
        icon={isPaused ? "play" : "pause"}
        size={24}
        onPress={onPauseResume}
        disabled={disabled}
        style={styles.minimalButton}
        iconColor={THEME_COLORS.textLight}
      />
      <IconButton
        icon="stop"
        size={24}
        onPress={onEnd}
        disabled={disabled}
        style={[styles.minimalButton, styles.minimalEndButton]}
        iconColor={THEME_COLORS.textLight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.surface,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    borderColor: THEME_COLORS.primary,
    borderWidth: 2,
  },
  endButton: {
    flex: 1,
  },
  buttonContent: {
    height: 48,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Floating styles
  floatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 16,
  },
  floatingButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 28,
  },
  mainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  endFloatingButton: {
    backgroundColor: "rgba(244, 67, 54, 0.3)",
  },
  // Minimal styles
  minimalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  minimalButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    margin: 0,
  },
  minimalEndButton: {
    backgroundColor: "rgba(244, 67, 54, 0.5)",
  },
});

export default ControlButtons;
