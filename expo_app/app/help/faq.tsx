/**
 * FAQ画面
 *
 * よくある質問をカテゴリ別に表示する画面です。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useState, useMemo } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { Appbar, Searchbar, Text, Surface } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { FAQCategoryComponent } from "@/components/help/FAQItem";
import { FAQ_DATA, getFAQSearchCount } from "@/constants/faqData";

/**
 * Theme colors
 */
const THEME_COLORS = {
  primary: "#4CAF50",
  surface: "#FFFFFF",
  background: "#F5F5F5",
  text: "#212121",
  textSecondary: "#757575",
};

/**
 * FAQScreen Component
 */
export default function FAQScreen() {
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories if specific category is provided
  const categories = useMemo(() => {
    if (initialCategory) {
      return FAQ_DATA.filter((cat) => cat.id === initialCategory);
    }
    return FAQ_DATA;
  }, [initialCategory]);

  // Get search result count
  const searchResultCount = useMemo(() => {
    return getFAQSearchCount(searchQuery);
  }, [searchQuery]);

  // Get title based on category
  const title = useMemo(() => {
    if (initialCategory) {
      const category = FAQ_DATA.find((cat) => cat.id === initialCategory);
      return category?.title || "FAQ";
    }
    return "よくある質問";
  }, [initialCategory]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title={title} titleStyle={styles.headerTitle} />
            </Appbar.Header>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="FAQを検索..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />
          {searchQuery && (
            <Text variant="bodySmall" style={styles.searchResultText}>
              {searchResultCount}件の結果
            </Text>
          )}
        </View>

        {/* FAQ List */}
        <Surface style={styles.faqCard} elevation={1}>
          {categories.map((category) => (
            <FAQCategoryComponent
              key={category.id}
              category={category}
              searchQuery={searchQuery}
            />
          ))}
        </Surface>

        {/* No Search Results */}
        {searchQuery && searchResultCount === 0 && (
          <Surface style={styles.noResultCard} elevation={1}>
            <Text style={styles.noResultText}>
              「{searchQuery}」に一致するFAQが見つかりませんでした
            </Text>
          </Surface>
        )}
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
  searchContainer: {
    padding: 16,
  },
  searchbar: {
    backgroundColor: THEME_COLORS.surface,
  },
  searchResultText: {
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
    marginLeft: 4,
  },
  faqCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  noResultCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    alignItems: "center",
  },
  noResultText: {
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
});
