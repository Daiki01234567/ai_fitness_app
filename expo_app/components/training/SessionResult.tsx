/**
 * セッション結果表示コンポーネント
 *
 * トレーニング終了後の結果を表示します。
 * スコア、レップ数、時間などの詳細情報を表示します。
 *
 * @see docs/expo/tickets/022-session-result-screen.md
 */

import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import {
  Card,
  Text,
  Button,
  TextInput,
  ProgressBar,
  Chip,
  Surface,
  Divider,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getExerciseById } from "@/constants/exercises";
import {
  SessionData,
  saveSession,
  formatDuration,
  getScoreColor,
  getScoreLabel,
} from "@/services/training/sessionService";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  primaryLight: "#E8F5E9",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
};

/**
 * Props for SessionResult component
 */
interface SessionResultProps {
  /** セッションデータ */
  sessionData: SessionData;
  /** もう1セットボタン押下時 */
  onAnotherSet: () => void;
  /** ホームに戻るボタン押下時 */
  onGoHome: () => void;
  /** 保存完了時 */
  onSaveComplete?: (sessionId: string) => void;
}

/**
 * SessionResult Component
 *
 * トレーニングセッションの結果を表示するコンポーネントです。
 *
 * @example
 * <SessionResult
 *   sessionData={currentSession}
 *   onAnotherSet={() => router.push('/training')}
 *   onGoHome={() => router.push('/')}
 * />
 */
export function SessionResult({
  sessionData,
  onAnotherSet,
  onGoHome,
  onSaveComplete,
}: SessionResultProps) {
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Get exercise info
  const exercise = getExerciseById(sessionData.exerciseType);
  const exerciseName = exercise?.name || sessionData.exerciseType;

  // Score display
  const scoreColor = getScoreColor(sessionData.averageScore);
  const scoreLabel = getScoreLabel(sessionData.averageScore);

  // Handle save
  const handleSave = async () => {
    if (isSaved) return;

    setIsSaving(true);
    try {
      const result = await saveSession({
        ...sessionData,
        memo: memo.trim() || undefined,
      });

      if (result.success) {
        setIsSaved(true);
        Alert.alert("保存完了", "トレーニング記録を保存しました", [
          { text: "OK" },
        ]);
        if (result.sessionId && onSaveComplete) {
          onSaveComplete(result.sessionId);
        }
      } else {
        Alert.alert(
          "エラー",
          result.error || "保存に失敗しました。もう一度お試しください。"
        );
      }
    } catch (error) {
      Alert.alert("エラー", "保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Result Header */}
      <Surface style={styles.headerCard} elevation={2}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons
            name="check-circle"
            size={48}
            color={THEME_COLORS.primary}
          />
          <Text variant="headlineSmall" style={styles.headerTitle}>
            トレーニング完了
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            {exerciseName}
          </Text>
        </View>
      </Surface>

      {/* Score Card */}
      <Card style={styles.scoreCard} mode="elevated">
        <Card.Content>
          <Text variant="labelLarge" style={styles.scoreLabel}>
            フォームスコア
          </Text>
          <View style={styles.scoreRow}>
            <Text
              variant="displayMedium"
              style={[styles.scoreValue, { color: scoreColor }]}
            >
              {sessionData.averageScore}
            </Text>
            <Text style={[styles.scoreUnit, { color: scoreColor }]}>点</Text>
          </View>
          <ProgressBar
            progress={sessionData.averageScore / 100}
            color={scoreColor}
            style={styles.scoreBar}
          />
          <Chip
            mode="flat"
            style={[styles.scoreLabelChip, { backgroundColor: `${scoreColor}20` }]}
            textStyle={{ color: scoreColor }}
          >
            {scoreLabel}
          </Chip>
        </Card.Content>
      </Card>

      {/* Stats Card */}
      <Card style={styles.statsCard} mode="elevated">
        <Card.Content>
          <View style={styles.statsRow}>
            {/* Reps */}
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="repeat"
                size={24}
                color={THEME_COLORS.primary}
              />
              <Text variant="headlineSmall" style={styles.statValue}>
                {sessionData.reps}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                レップ
              </Text>
            </View>

            <View style={styles.statDivider} />

            {/* Duration */}
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={24}
                color={THEME_COLORS.primary}
              />
              <Text variant="headlineSmall" style={styles.statValue}>
                {formatDuration(sessionData.duration)}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                時間
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Feedback Card */}
      {sessionData.feedbacks.length > 0 && (
        <Card style={styles.feedbackCard} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.feedbackTitle}>
              フィードバック詳細
            </Text>
            {sessionData.feedbacks.map((feedback, index) => (
              <View key={index} style={styles.feedbackItem}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={16}
                  color={THEME_COLORS.primary}
                />
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Memo Input */}
      <Card style={styles.memoCard} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.memoTitle}>
            メモ
          </Text>
          <TextInput
            mode="outlined"
            value={memo}
            onChangeText={setMemo}
            placeholder="今日のトレーニングについて記録しておきましょう"
            multiline
            numberOfLines={4}
            style={styles.memoInput}
            disabled={isSaved}
          />
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving || isSaved}
          icon={isSaved ? "check" : "content-save"}
          style={styles.saveButton}
          buttonColor={isSaved ? THEME_COLORS.success : THEME_COLORS.primary}
        >
          {isSaved ? "保存済み" : "保存"}
        </Button>

        <View style={styles.secondaryButtons}>
          <Button
            mode="outlined"
            onPress={onAnotherSet}
            icon="replay"
            style={styles.secondaryButton}
          >
            もう1セット
          </Button>
          <Button
            mode="text"
            onPress={onGoHome}
            icon="home"
            style={styles.secondaryButton}
          >
            ホームへ戻る
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Header
  headerCard: {
    backgroundColor: THEME_COLORS.primaryLight,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerContent: {
    alignItems: "center",
    padding: 24,
  },
  headerTitle: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
    marginTop: 12,
  },
  headerSubtitle: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  // Score
  scoreCard: {
    backgroundColor: THEME_COLORS.surface,
    marginBottom: 16,
  },
  scoreLabel: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 12,
  },
  scoreValue: {
    fontWeight: "bold",
  },
  scoreUnit: {
    fontSize: 24,
    fontWeight: "600",
    marginLeft: 4,
  },
  scoreBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  scoreLabelChip: {
    alignSelf: "center",
  },
  // Stats
  statsCard: {
    backgroundColor: THEME_COLORS.surface,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
    marginTop: 8,
  },
  statLabel: {
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#E0E0E0",
  },
  // Feedback
  feedbackCard: {
    backgroundColor: THEME_COLORS.surface,
    marginBottom: 16,
  },
  feedbackTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  feedbackItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  feedbackText: {
    flex: 1,
    marginLeft: 8,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  // Memo
  memoCard: {
    backgroundColor: THEME_COLORS.surface,
    marginBottom: 24,
  },
  memoTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  memoInput: {
    backgroundColor: THEME_COLORS.surface,
  },
  // Buttons
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    paddingVertical: 4,
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
  },
});

export default SessionResult;
