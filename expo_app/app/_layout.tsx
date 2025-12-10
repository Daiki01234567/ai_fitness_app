/**
 * ルートレイアウト
 *
 * アプリ全体のプロバイダー設定とナビゲーション構造を定義します。
 */

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";

// Only import reanimated on native platforms (it uses worklets which don't work on web)
if (Platform.OS !== "web") {
  require("react-native-reanimated");
}

import { useColorScheme } from "@/components/useColorScheme";
import { queryClient, initializeFirebase } from "@/lib";
import { useAuthStore } from "@/stores";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/` redirects based on auth state.
  initialRouteName: "index",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Get auth initialization function
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Initialize Firebase and Auth
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeFirebase();
        await initializeAuth();
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    initialize();
  }, [initializeAuth]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // React Native Paper theme based on color scheme
  const paperTheme = colorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="training" />
          <Stack.Screen name="+not-found" options={{ headerShown: true, title: "Not Found" }} />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
