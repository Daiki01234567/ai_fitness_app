/**
 * FAQアイテムコンポーネント
 *
 * FAQ項目をアコーディオン形式で表示するコンポーネントです。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

import React, { useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { List, Text } from "react-native-paper";

import { FAQItem as FAQItemType, FAQCategory as FAQCategoryType } from "@/constants/faqData";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F9F9F9",
  text: "#212121",
  textSecondary: "#666666",
};

/**
 * Props for FAQItemComponent
 */
interface FAQItemComponentProps {
  /** FAQ項目データ */
  item: FAQItemType;
}

/**
 * FAQItemComponent
 *
 * 単一のFAQ項目をアコーディオン形式で表示します。
 *
 * @example
 * <FAQItemComponent
 *   item={{
 *     id: "forgot-password",
 *     question: "パスワードを忘れた場合は？",
 *     answer: "パスワードリセットをお試しください。"
 *   }}
 * />
 */
export function FAQItemComponent({ item }: FAQItemComponentProps) {
  const [expanded, setExpanded] = useState(false);

  const handlePress = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <List.Accordion
      title={item.question}
      expanded={expanded}
      onPress={handlePress}
      style={styles.itemAccordion}
      titleStyle={styles.questionText}
      titleNumberOfLines={3}
    >
      <View style={styles.answerContainer}>
        <Text style={styles.answerText}>{item.answer}</Text>
      </View>
    </List.Accordion>
  );
}

/**
 * Props for FAQCategoryComponent
 */
interface FAQCategoryComponentProps {
  /** FAQカテゴリデータ */
  category: FAQCategoryType;
  /** 検索クエリ（オプション） */
  searchQuery?: string;
}

/**
 * FAQCategoryComponent
 *
 * FAQカテゴリをアコーディオン形式で表示します。
 *
 * @example
 * <FAQCategoryComponent
 *   category={categoryData}
 *   searchQuery="パスワード"
 * />
 */
export function FAQCategoryComponent({
  category,
  searchQuery,
}: FAQCategoryComponentProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter items by search query
  const filteredItems = searchQuery
    ? category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category.items;

  // Hide category if no matching items
  if (searchQuery && filteredItems.length === 0) {
    return null;
  }

  // Auto-expand when searching
  const isExpanded = searchQuery ? true : expanded;

  const handlePress = useCallback(() => {
    if (!searchQuery) {
      setExpanded((prev) => !prev);
    }
  }, [searchQuery]);

  return (
    <List.Accordion
      title={category.title}
      left={(props) => <List.Icon {...props} icon={category.icon} />}
      expanded={isExpanded}
      onPress={handlePress}
      style={styles.categoryAccordion}
      titleStyle={styles.categoryTitle}
    >
      {filteredItems.map((item) => (
        <FAQItemComponent key={item.id} item={item} />
      ))}
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  categoryAccordion: {
    backgroundColor: THEME_COLORS.surface,
  },
  categoryTitle: {
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  itemAccordion: {
    backgroundColor: THEME_COLORS.background,
    paddingLeft: 16,
  },
  questionText: {
    fontSize: 14,
    color: THEME_COLORS.text,
  },
  answerContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: THEME_COLORS.surface,
    marginLeft: -16,
    marginRight: 0,
  },
  answerText: {
    lineHeight: 22,
    color: THEME_COLORS.textSecondary,
    fontSize: 14,
  },
});

export default FAQItemComponent;
