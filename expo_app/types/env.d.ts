/**
 * 環境変数の型定義
 *
 * Expo の環境変数は EXPO_PUBLIC_ プレフィックスが必要です。
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Firebase Configuration
      EXPO_PUBLIC_FIREBASE_API_KEY: string;
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: string;
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
      EXPO_PUBLIC_FIREBASE_APP_ID: string;
      EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;

      // Environment
      EXPO_PUBLIC_ENV: "development" | "staging" | "production";

      // API
      EXPO_PUBLIC_API_ENDPOINT: string;

      // Emulator Configuration
      EXPO_PUBLIC_USE_EMULATOR: string;
      EXPO_PUBLIC_EMULATOR_HOST: string;
      EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: string;
      EXPO_PUBLIC_AUTH_EMULATOR_PORT: string;
      EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT: string;
      EXPO_PUBLIC_STORAGE_EMULATOR_PORT: string;
    }
  }
}

export {};
