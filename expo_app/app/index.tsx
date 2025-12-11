/**
 * Entry point / Splash screen
 *
 * Handles initial routing based on:
 * 1. First launch status (onboarding required)
 * 2. Authentication state
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { useAuthStore } from "@/stores";

// AsyncStorage key for onboarding status
const ONBOARDING_COMPLETE_KEY = "hasSeenOnboarding";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  // Check if user has seen onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        setHasSeenOnboarding(value === "true");
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // Default to false if error occurs
        setHasSeenOnboarding(false);
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  // Show splash screen while loading
  if (isLoading || isCheckingOnboarding) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>AI Fitness</Text>
          <Text style={styles.subtitle}>あなたのトレーニングをサポート</Text>
        </View>
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      </View>
    );
  }

  // First launch: redirect to onboarding
  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Redirect based on authentication state
  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
  },
  content: {
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
  },
  loader: {
    position: "absolute",
    bottom: 100,
  },
});
