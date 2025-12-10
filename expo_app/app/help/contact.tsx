/**
 * お問い合わせ画面
 *
 * ユーザーからのフィードバックやお問い合わせを送信する画面です。
 *
 * @see docs/expo/tickets/029-help-center.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { Stack, router } from "expo-router";
import React, { useState, useCallback } from "react";
import { StyleSheet, ScrollView, View, Alert } from "react-native";
import {
  Appbar,
  TextInput,
  RadioButton,
  Button,
  Text,
  HelperText,
  Surface,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";

import {
  submitFeedback,
  validateSubject,
  validateMessage,
  FeedbackType,
  FEEDBACK_TYPE_LABELS,
} from "@/services/help/feedbackService";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
  error: "#F44336",
};

/**
 * Feedback type options
 */
const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug_report", label: FEEDBACK_TYPE_LABELS.bug_report },
  { value: "feature_request", label: FEEDBACK_TYPE_LABELS.feature_request },
  { value: "general_feedback", label: FEEDBACK_TYPE_LABELS.general_feedback },
  { value: "other", label: FEEDBACK_TYPE_LABELS.other },
];

const MAX_SUBJECT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * ContactScreen Component
 */
export default function ContactScreen() {
  const [type, setType] = useState<FeedbackType>("general_feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Submit mutation
  const mutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: (result) => {
      if (result.success) {
        Alert.alert("送信完了", "お問い合わせを受け付けました。ご協力ありがとうございます。", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("エラー", result.message);
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "送信に失敗しました";

      // Rate limit error
      if (error.code === "resource-exhausted") {
        Alert.alert(
          "送信制限",
          "1日の送信上限（10回）に達しました。明日以降に再度お試しください。"
        );
      } else {
        Alert.alert("エラー", errorMessage);
      }
    },
  });

  // Validation
  const subjectError = validateSubject(subject, MAX_SUBJECT_LENGTH);
  const messageError = validateMessage(message, MAX_MESSAGE_LENGTH);
  const isSubjectValid = !subjectError || subject.length === 0;
  const isMessageValid = !messageError || message.length === 0;
  const canSubmit =
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !subjectError &&
    !messageError &&
    !mutation.isPending;

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    mutation.mutate({
      type,
      subject,
      message,
    });
  }, [type, subject, message, canSubmit, mutation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="お問い合わせ" titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Feedback Type Selection */}
        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            お問い合わせの種類
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setType(value as FeedbackType)}
            value={type}
          >
            {FEEDBACK_TYPES.map((item) => (
              <RadioButton.Item key={item.value} label={item.label} value={item.value} />
            ))}
          </RadioButton.Group>
        </Surface>

        {/* Subject Input */}
        <Surface style={styles.sectionCard} elevation={1}>
          <TextInput
            label="件名"
            value={subject}
            onChangeText={setSubject}
            mode="outlined"
            maxLength={MAX_SUBJECT_LENGTH}
            error={!isSubjectValid}
            style={styles.textInput}
          />
          <HelperText type={!isSubjectValid ? "error" : "info"}>
            {subject.length} / {MAX_SUBJECT_LENGTH}文字
          </HelperText>
        </Surface>

        {/* Message Input */}
        <Surface style={styles.sectionCard} elevation={1}>
          <TextInput
            label="お問い合わせ内容"
            value={message}
            onChangeText={setMessage}
            mode="outlined"
            multiline
            numberOfLines={8}
            maxLength={MAX_MESSAGE_LENGTH}
            error={!isMessageValid}
            style={styles.messageInput}
          />
          <HelperText type={!isMessageValid ? "error" : "info"}>
            {message.length} / {MAX_MESSAGE_LENGTH}文字
          </HelperText>
        </Surface>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={mutation.isPending}
            disabled={!canSubmit}
            style={styles.submitButton}
            buttonColor={THEME_COLORS.primary}
          >
            送信する
          </Button>
        </View>

        {/* Rate Limit Info */}
        <Text style={styles.rateLimit}>1日10回まで送信できます</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    backgroundColor: THEME_COLORS.surface,
    elevation: 0,
  },
  headerTitle: {
    color: THEME_COLORS.text,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sectionCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: THEME_COLORS.surface,
  },
  messageInput: {
    backgroundColor: THEME_COLORS.surface,
    minHeight: 150,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  submitButton: {
    paddingVertical: 8,
  },
  rateLimit: {
    textAlign: "center",
    color: THEME_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 16,
    marginBottom: 16,
  },
});
