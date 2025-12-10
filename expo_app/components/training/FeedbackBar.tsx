/**
 * フィードバックバーコンポーネント
 *
 * トレーニング実行画面で、リアルタイムのフォーム評価フィードバックを表示します。
 * 薬機法対応のため、すべてのフィードバックに「参考:」プレフィックスを付けます。
 *
 * @see docs/expo/tickets/021-training-screen.md
 */

import React from "react";
import { StyleSheet, View, Animated } from "react-native";
import { Text, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * フィードバックの種類
 */
export type FeedbackType = "good" | "warning" | "error" | "info";

/**
 * Props for FeedbackBar component
 */
interface FeedbackBarProps {
  /** フィードバックメッセージ */
  message: string | null;
  /** フィードバックの種類 */
  type?: FeedbackType;
  /** 表示/非表示 */
  visible?: boolean;
}

/**
 * フィードバックタイプに応じた色を取得
 */
function getFeedbackColors(type: FeedbackType) {
  switch (type) {
    case "good":
      return {
        background: "#E8F5E9",
        text: "#2E7D32",
        icon: "check-circle" as const,
        iconColor: "#4CAF50",
      };
    case "warning":
      return {
        background: "#FFF8E1",
        text: "#F57C00",
        icon: "alert-circle" as const,
        iconColor: "#FF9800",
      };
    case "error":
      return {
        background: "#FFEBEE",
        text: "#C62828",
        icon: "alert" as const,
        iconColor: "#F44336",
      };
    case "info":
    default:
      return {
        background: "#E3F2FD",
        text: "#1565C0",
        icon: "information" as const,
        iconColor: "#2196F3",
      };
  }
}

/**
 * 薬機法対応: メッセージに「参考:」プレフィックスを付与
 */
function addReferencePrefix(message: string): string {
  if (message.startsWith("参考:") || message.startsWith("参考：")) {
    return message;
  }
  return `参考: ${message}`;
}

/**
 * FeedbackBar Component
 *
 * リアルタイムのフォームフィードバックを表示するバーコンポーネントです。
 *
 * @example
 * <FeedbackBar
 *   message="膝の角度が良いです"
 *   type="good"
 *   visible={true}
 * />
 */
export function FeedbackBar({
  message,
  type = "info",
  visible = true,
}: FeedbackBarProps) {
  if (!visible || !message) {
    return null;
  }

  const colors = getFeedbackColors(type);
  const displayMessage = addReferencePrefix(message);

  return (
    <Surface
      style={[styles.container, { backgroundColor: colors.background }]}
      elevation={2}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons
          name={colors.icon}
          size={24}
          color={colors.iconColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {displayMessage}
        </Text>
      </View>
    </Surface>
  );
}

/**
 * 複数フィードバック表示用コンポーネント
 */
interface MultiFeedbackBarProps {
  /** フィードバックリスト */
  feedbacks: Array<{
    message: string;
    type?: FeedbackType;
  }>;
  /** 最大表示数 */
  maxItems?: number;
}

export function MultiFeedbackBar({
  feedbacks,
  maxItems = 3,
}: MultiFeedbackBarProps) {
  const displayFeedbacks = feedbacks.slice(0, maxItems);

  if (displayFeedbacks.length === 0) {
    return null;
  }

  return (
    <View style={styles.multiContainer}>
      {displayFeedbacks.map((feedback, index) => (
        <FeedbackBar
          key={index}
          message={feedback.message}
          type={feedback.type}
          visible={true}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  multiContainer: {
    gap: 4,
  },
});

export default FeedbackBar;
