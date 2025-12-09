/**
 * Firebase アプリケーション初期化
 *
 * Firebase Web SDKを使用してアプリケーションを初期化します。
 * 開発環境ではエミュレータへの接続もサポートしています。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth as getFirebaseAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
// @ts-expect-error - React Native persistence is available at runtime
import { getReactNativePersistence } from "firebase/auth/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getFirebaseConfig, getEmulatorConfig, getEnvironment } from "./firebase";

/**
 * Firebase アプリインスタンス
 */
let app: FirebaseApp;

/**
 * Firebase Auth インスタンス
 */
let auth: Auth;

/**
 * 初期化済みフラグ
 */
let isInitialized = false;

/**
 * エミュレータ接続済みフラグ
 * (エミュレータは一度だけ接続可能)
 */
let isEmulatorConnected = false;

/**
 * Firebase アプリを初期化
 */
const initializeFirebaseApp = (): FirebaseApp => {
  if (getApps().length > 0) {
    return getApp();
  }

  const config = getFirebaseConfig();
  return initializeApp(config);
};

/**
 * Firebase Auth を初期化
 * React Native環境ではAsyncStorageを使用して認証状態を永続化
 */
const initializeFirebaseAuth = (firebaseApp: FirebaseApp): Auth => {
  try {
    // Try to get existing auth instance first
    return getFirebaseAuth(firebaseApp);
  } catch {
    // Initialize with React Native persistence if no existing instance
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
};

/**
 * エミュレータに接続
 */
const connectToEmulators = (authInstance: Auth): void => {
  if (isEmulatorConnected) {
    return;
  }

  const emulatorConfig = getEmulatorConfig();

  if (emulatorConfig.useEmulator) {
    const authEmulatorUrl = `http://${emulatorConfig.host}:${emulatorConfig.authPort}`;

    try {
      connectAuthEmulator(authInstance, authEmulatorUrl, { disableWarnings: true });
      console.log(`Auth エミュレータに接続: ${authEmulatorUrl}`);
      isEmulatorConnected = true;
    } catch (error) {
      console.warn("Auth エミュレータ接続エラー:", error);
    }
  }
};

/**
 * Firebase を初期化
 *
 * この関数はアプリ起動時に一度だけ呼び出されるべきです。
 * 重複呼び出しは無視されます。
 */
export const initializeFirebaseServices = (): void => {
  if (isInitialized) {
    return;
  }

  const environment = getEnvironment();
  console.log(`Firebase初期化中... (環境: ${environment})`);

  try {
    // Initialize Firebase App
    app = initializeFirebaseApp();
    console.log(`Firebase App 初期化完了: ${app.options.projectId}`);

    // Initialize Firebase Auth with React Native persistence
    auth = initializeFirebaseAuth(app);
    console.log("Firebase Auth 初期化完了");

    // Connect to emulators in development
    connectToEmulators(auth);

    isInitialized = true;
    console.log("Firebase サービス初期化完了");
  } catch (error) {
    console.error("Firebase 初期化エラー:", error);
    throw error;
  }
};

/**
 * Firebase App インスタンスを取得
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (!isInitialized) {
    initializeFirebaseServices();
  }
  return app;
};

/**
 * Firebase Auth インスタンスを取得
 */
export const getAuthInstance = (): Auth => {
  if (!isInitialized) {
    initializeFirebaseServices();
  }
  return auth;
};

// Initialize on module load to ensure Firebase is ready
// when auth.ts imports the auth instance
initializeFirebaseServices();

// Export the initialized instances
export { app, auth };
