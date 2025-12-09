/**
 * トレーニング画面（スタブ）
 *
 * トレーニング種目の選択と開始を行う画面です。
 * MediaPipeを使用したフォーム評価は後続のチケットで実装します。
 *
 * @see docs/expo/specs/05_画面遷移図_Expo版_v1.md
 * @see docs/specs/08_README_form_validation_logic_v3_3.md
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * 対応予定のトレーニング種目
 * @see docs/specs/08_README_form_validation_logic_v3_3.md
 */
const EXERCISE_TYPES = [
  {
    id: "squat",
    name: "スクワット",
    description: "下半身強化の基本種目",
    icon: "legs",
    available: false,
  },
  {
    id: "arm-curl",
    name: "アームカール",
    description: "上腕二頭筋を鍛える種目",
    icon: "arm",
    available: false,
  },
  {
    id: "side-raise",
    name: "サイドレイズ",
    description: "肩（三角筋）を鍛える種目",
    icon: "shoulder",
    available: false,
  },
  {
    id: "shoulder-press",
    name: "ショルダープレス",
    description: "肩と上腕三頭筋を鍛える種目",
    icon: "press",
    available: false,
  },
  {
    id: "push-up",
    name: "プッシュアップ",
    description: "胸と上腕三頭筋を鍛える種目",
    icon: "chest",
    available: false,
  },
];

export default function TrainingScreen() {
  const handleStartTraining = (exerciseId: string) => {
    // TODO: Navigate to training session screen
    console.log("Start training:", exerciseId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>トレーニング種目</Text>
          <Text style={styles.subtitle}>AIがあなたのフォームを分析します</Text>
        </View>

        {/* Exercise List */}
        <View style={styles.exerciseList}>
          {EXERCISE_TYPES.map((exercise) => (
            <TouchableOpacity
              key={exercise.id}
              style={[styles.exerciseCard, !exercise.available && styles.exerciseCardDisabled]}
              onPress={() => handleStartTraining(exercise.id)}
              disabled={!exercise.available}
            >
              <View style={styles.exerciseIcon}>
                <Text style={styles.exerciseIconText}>
                  {exercise.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.exerciseContent}>
                <Text style={[styles.exerciseName, !exercise.available && styles.textDisabled]}>
                  {exercise.name}
                </Text>
                <Text style={[styles.exerciseDescription, !exercise.available && styles.textDisabled]}>
                  {exercise.description}
                </Text>
              </View>
              {!exercise.available && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>準備中</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>フォーム評価について</Text>
          <Text style={styles.infoText}>
            トレーニング中、AIがリアルタイムでフォームを分析し、
            正しい動作ができているかフィードバックします。
            カメラの映像はデバイス内でのみ処理され、
            サーバーには送信されません。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  exerciseList: {
    gap: 12,
    marginBottom: 24,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseCardDisabled: {
    opacity: 0.7,
  },
  exerciseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2f95dc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  exerciseIconText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  exerciseDescription: {
    fontSize: 14,
    color: "#666",
  },
  textDisabled: {
    color: "#999",
  },
  comingSoonBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  comingSoonText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  infoSection: {
    backgroundColor: "#e8f4fd",
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2f95dc",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
});
