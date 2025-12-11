/**
 * Onboarding screen (3 pages)
 *
 * Introduces app features to first-time users:
 * - Page 1: Medical device disclaimer (regulatory compliance)
 * - Page 2: AI-powered form check feature
 * - Page 3: Affordable pricing
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// AsyncStorage key for onboarding status
const ONBOARDING_COMPLETE_KEY = "hasSeenOnboarding";

// Screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Onboarding page data
interface OnboardingPage {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  bulletPoints: string[];
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    id: "medical-disclaimer",
    icon: (
      <MaterialCommunityIcons
        name="information-outline"
        size={80}
        color="#4CAF50"
      />
    ),
    title: "本サービスは医療機器ではありません",
    description: "ご利用前に以下の点をご理解ください",
    bulletPoints: [
      "参考情報としてご利用ください",
      "医学的判断は行いません",
      "最終判断はご自身でお願いします",
    ],
  },
  {
    id: "ai-feature",
    icon: (
      <MaterialCommunityIcons name="robot-outline" size={80} color="#4CAF50" />
    ),
    title: "AIがあなたのフォームを確認補助",
    description: "リアルタイムでトレーニングをサポート",
    bulletPoints: [
      "カメラでフォームをチェック",
      "音声で参考情報を提供",
      "映像はデバイス内で処理",
    ],
  },
  {
    id: "pricing",
    icon: (
      <MaterialCommunityIcons name="currency-jpy" size={80} color="#4CAF50" />
    ),
    title: "月額500円で始められる",
    description: "手軽な価格でプレミアム機能を利用",
    bulletPoints: [
      "1週間無料トライアル",
      "いつでもキャンセル可能",
      "無料プランもご用意",
    ],
  },
];

export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Complete onboarding and navigate to login
  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      // Navigate anyway even if storage fails
      router.replace("/(auth)/login");
    }
  };

  // Skip button handler
  const handleSkip = async () => {
    await handleComplete();
  };

  // Next page handler
  const handleNext = () => {
    if (currentPage < ONBOARDING_PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentPage + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  // Handle scroll end to update current page
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(pageIndex);
  };

  // Render a single onboarding page
  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={styles.page}>
      <View style={styles.iconContainer}>{item.icon}</View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.bulletContainer}>
        {item.bulletPoints.map((point, index) => (
          <View key={index} style={styles.bulletItem}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#4CAF50"
              style={styles.bulletIcon}
            />
            <Text style={styles.bulletText}>{point}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Render page indicator dots
  const renderPageIndicator = () => (
    <View style={styles.indicatorContainer}>
      {ONBOARDING_PAGES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.indicator,
            currentPage === index && styles.indicatorActive,
          ]}
        />
      ))}
    </View>
  );

  const isLastPage = currentPage === ONBOARDING_PAGES.length - 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Skip button (hidden on last page) */}
        {!isLastPage && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>スキップ</Text>
          </TouchableOpacity>
        )}

        {/* Page content */}
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_PAGES}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Bottom section */}
        <View style={styles.footer}>
          {renderPageIndicator()}

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>
              {isLastPage ? "始める" : "次へ"}
            </Text>
            <Ionicons
              name={isLastPage ? "checkmark" : "arrow-forward"}
              size={20}
              color="#fff"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    top: 16,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: "#666",
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  bulletContainer: {
    alignSelf: "stretch",
    paddingHorizontal: 16,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bulletIcon: {
    marginRight: 12,
  },
  bulletText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: "#4CAF50",
    width: 24,
  },
  button: {
    height: 56,
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
