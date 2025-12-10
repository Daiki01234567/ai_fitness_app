/**
 * アプリ使い方ガイド画面
 *
 * アプリの基本的な使い方を説明するガイド画面です。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

import { Stack, router } from "expo-router";
import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Appbar, Card, Text, List } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#666666",
};

/**
 * Guide section data
 */
interface GuideSection {
  id: string;
  title: string;
  content?: string;
  steps?: string[];
  list?: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "はじめに",
    content:
      "このアプリは、AIを活用してトレーニングフォームの確認を補助するアプリです。カメラで撮影しながら、リアルタイムでフォームのフィードバックを受けることができます。",
  },
  {
    id: "camera-setup",
    title: "カメラの設置",
    steps: [
      "スマートフォンを安定した場所に置きます",
      "カメラから1.5〜2.5m離れた位置に立ちます",
      "全身が画面に映るように調整します",
      "種目によって横向き・正面の推奨があります",
    ],
  },
  {
    id: "training-flow",
    title: "トレーニングの流れ",
    steps: [
      "ホーム画面から「トレーニング開始」をタップ",
      "トレーニング種目を選択",
      "カメラを設置してチェック項目を確認",
      "トレーニング開始（カウントダウン後）",
      "フォームを確認しながらトレーニング",
      "終了後に結果とフィードバックを確認",
    ],
  },
  {
    id: "exercises",
    title: "対応種目",
    content: "現在、以下の5種目に対応しています：",
    list: [
      "スクワット - 下半身を鍛える基本種目（横向き推奨）",
      "プッシュアップ - 胸と腕を鍛える自重種目（横向き推奨）",
      "アームカール - 腕を鍛えるダンベル種目（正面推奨）",
      "サイドレイズ - 肩を鍛えるダンベル種目（正面推奨）",
      "ショルダープレス - 肩と腕を鍛えるダンベル種目（正面推奨）",
    ],
  },
  {
    id: "tips",
    title: "より良い結果のために",
    list: [
      "明るい場所でトレーニングしましょう",
      "背景はできるだけシンプルに",
      "動きやすい服装で",
      "音声フィードバックを活用しましょう",
      "スコアは参考値として捉えてください",
    ],
  },
  {
    id: "disclaimer",
    title: "重要なお知らせ",
    content:
      "このアプリは医療機器ではありません。フォーム確認の参考情報として提供しています。実際のトレーニングは、ご自身の体調や能力に合わせて行ってください。痛みや不調を感じた場合は、すぐにトレーニングを中止し、医療専門家にご相談ください。",
  },
];

/**
 * GuideScreen Component
 */
export default function GuideScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="アプリの使い方" titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.headerCardTitle}>
              アプリの使い方
            </Text>
            <Text variant="bodyMedium" style={styles.headerCardDescription}>
              このガイドでは、アプリの基本的な使い方を説明します。
            </Text>
          </Card.Content>
        </Card>

        {/* Guide Sections */}
        {GUIDE_SECTIONS.map((section) => (
          <Card key={section.id} style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {section.title}
              </Text>

              {section.content && (
                <Text variant="bodyMedium" style={styles.sectionContent}>
                  {section.content}
                </Text>
              )}

              {section.steps && (
                <List.Section style={styles.listSection}>
                  {section.steps.map((step, index) => (
                    <List.Item
                      key={index}
                      title={step}
                      left={() => <Text style={styles.stepNumber}>{index + 1}.</Text>}
                      titleNumberOfLines={3}
                      titleStyle={styles.listItemTitle}
                      style={styles.listItem}
                    />
                  ))}
                </List.Section>
              )}

              {section.list && (
                <List.Section style={styles.listSection}>
                  {section.list.map((item, index) => (
                    <List.Item
                      key={index}
                      title={item}
                      left={(props) => <List.Icon {...props} icon="check" color={THEME_COLORS.primary} />}
                      titleNumberOfLines={3}
                      titleStyle={styles.listItemTitle}
                      style={styles.listItem}
                    />
                  ))}
                </List.Section>
              )}
            </Card.Content>
          </Card>
        ))}
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
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: THEME_COLORS.primary,
    marginBottom: 16,
  },
  headerCardTitle: {
    color: THEME_COLORS.surface,
    marginBottom: 8,
  },
  headerCardDescription: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  sectionCard: {
    backgroundColor: THEME_COLORS.surface,
    marginBottom: 16,
  },
  sectionTitle: {
    color: THEME_COLORS.text,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionContent: {
    lineHeight: 22,
    color: THEME_COLORS.textSecondary,
  },
  listSection: {
    marginTop: -8,
    marginBottom: -16,
  },
  listItem: {
    paddingVertical: 2,
  },
  listItemTitle: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    lineHeight: 20,
  },
  stepNumber: {
    width: 24,
    fontSize: 14,
    fontWeight: "600",
    color: THEME_COLORS.primary,
    textAlign: "center",
    alignSelf: "flex-start",
    marginTop: 12,
  },
});
