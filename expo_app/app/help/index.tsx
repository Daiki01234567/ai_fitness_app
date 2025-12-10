/**
 * ヘルプセンター画面
 *
 * FAQ一覧、お問い合わせ、利用規約、プライバシーポリシーへのリンクを提供するヘルプセンター画面です。
 *
 * @see docs/expo/tickets/029-help-center.md
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { Stack, router } from "expo-router";
import React, { useState, useMemo } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { Appbar, Searchbar, List, Divider, Surface, Text } from "react-native-paper";
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
 * HelpCenterScreen Component
 */
export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState("");

  // Get search result count
  const searchResultCount = useMemo(() => {
    return getFAQSearchCount(searchQuery);
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Appbar.Header style={styles.header}>
              <Appbar.BackAction onPress={() => router.back()} />
              <Appbar.Content title="ヘルプセンター" titleStyle={styles.headerTitle} />
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

        {/* FAQ Section */}
        <Surface style={styles.faqCard} elevation={1}>
          <List.Section>
            <List.Subheader style={styles.sectionTitle}>よくある質問</List.Subheader>
            {FAQ_DATA.map((category) => (
              <FAQCategoryComponent
                key={category.id}
                category={category}
                searchQuery={searchQuery}
              />
            ))}
          </List.Section>
        </Surface>

        {/* No Search Results */}
        {searchQuery && searchResultCount === 0 && (
          <Surface style={styles.noResultCard} elevation={1}>
            <Text style={styles.noResultText}>
              「{searchQuery}」に一致するFAQが見つかりませんでした
            </Text>
          </Surface>
        )}

        <Divider style={styles.divider} />

        {/* Other Support Section */}
        <Surface style={styles.supportCard} elevation={1}>
          <List.Section>
            <List.Subheader style={styles.sectionTitle}>その他のサポート</List.Subheader>

            <List.Item
              title="アプリの使い方"
              description="基本的な使い方を確認"
              left={(props) => <List.Icon {...props} icon="book-open-variant" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/help/guide")}
            />

            <Divider />

            <List.Item
              title="お問い合わせ"
              description="フィードバックやご質問を送信"
              left={(props) => <List.Icon {...props} icon="email" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/help/contact")}
            />

            <Divider />

            <List.Item
              title="利用規約"
              left={(props) => <List.Icon {...props} icon="file-document" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {
                // TODO: Navigate to terms screen or open WebView
                console.log("Navigate to terms");
              }}
            />

            <Divider />

            <List.Item
              title="プライバシーポリシー"
              left={(props) => <List.Icon {...props} icon="shield-lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {
                // TODO: Navigate to privacy policy screen or open WebView
                console.log("Navigate to privacy policy");
              }}
            />
          </List.Section>
        </Surface>
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
  sectionTitle: {
    fontWeight: "600",
    color: THEME_COLORS.text,
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
  divider: {
    marginVertical: 16,
  },
  supportCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: "hidden",
  },
});
