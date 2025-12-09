/**
 * Firebase初期化
 *
 * 環境変数を使用してFirebaseを初期化します。
 * 開発環境ではエミュレータへの接続もサポートしています。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

// Note: Phase 1では@react-native-firebase/appを使用
// 現時点ではfirebase/app（Web SDK）を使用して基本的な初期化を行う
// MediaPipe統合時にDevelopment Buildに切り替える際、
// @react-native-firebase/appへの移行を行う

/**
 * Firebase設定の型定義
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * 環境変数からFirebase設定を取得
 */
export const getFirebaseConfig = (): FirebaseConfig => {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

  // Validate required configuration
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    throw new Error(
      "Firebase設定が不完全です。.env.developmentまたは.env.productionファイルを確認してください。"
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
};

/**
 * エミュレータ設定の型定義
 */
export interface EmulatorConfig {
  useEmulator: boolean;
  host: string;
  firestorePort: number;
  authPort: number;
  functionsPort: number;
  storagePort: number;
}

/**
 * エミュレータ設定を取得
 */
export const getEmulatorConfig = (): EmulatorConfig => {
  const useEmulator = process.env.EXPO_PUBLIC_USE_EMULATOR === "true";
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || "localhost";
  const firestorePort = parseInt(process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || "8080", 10);
  const authPort = parseInt(process.env.EXPO_PUBLIC_AUTH_EMULATOR_PORT || "9099", 10);
  const functionsPort = parseInt(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || "5001", 10);
  const storagePort = parseInt(process.env.EXPO_PUBLIC_STORAGE_EMULATOR_PORT || "9199", 10);

  return {
    useEmulator,
    host,
    firestorePort,
    authPort,
    functionsPort,
    storagePort,
  };
};

/**
 * 現在の環境を取得
 */
export const getEnvironment = (): "development" | "staging" | "production" => {
  const env = process.env.EXPO_PUBLIC_ENV;
  if (env === "staging" || env === "production") {
    return env;
  }
  return "development";
};

/**
 * API エンドポイントを取得
 */
export const getApiEndpoint = (): string => {
  return (
    process.env.EXPO_PUBLIC_API_ENDPOINT ||
    "https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net"
  );
};

/**
 * Firebase初期化ステータス
 */
let isInitialized = false;

/**
 * Firebase初期化関数
 *
 * @react-native-firebase/appへの移行時に実装を更新します。
 * 現時点では設定の検証のみを行います。
 */
export const initializeFirebase = async (): Promise<void> => {
  if (isInitialized) {
    console.log("Firebase is already initialized");
    return;
  }

  try {
    // Validate configuration
    const config = getFirebaseConfig();
    const emulatorConfig = getEmulatorConfig();
    const environment = getEnvironment();

    console.log(`Firebase初期化中... (環境: ${environment})`);
    console.log(`Project ID: ${config.projectId}`);

    if (emulatorConfig.useEmulator) {
      console.log(`エミュレータモード: ${emulatorConfig.host}`);
      console.log(`  - Firestore: ${emulatorConfig.firestorePort}`);
      console.log(`  - Auth: ${emulatorConfig.authPort}`);
      console.log(`  - Functions: ${emulatorConfig.functionsPort}`);
      console.log(`  - Storage: ${emulatorConfig.storagePort}`);
    }

    // TODO: @react-native-firebase/appの初期化を実装
    // Development Build移行時に以下のように実装:
    //
    // import { firebase } from '@react-native-firebase/app';
    //
    // if (!firebase.apps.length) {
    //   await firebase.initializeApp(config);
    // }
    //
    // if (emulatorConfig.useEmulator) {
    //   // Connect to emulators
    //   auth().useEmulator(`http://${emulatorConfig.host}:${emulatorConfig.authPort}`);
    //   firestore().useEmulator(emulatorConfig.host, emulatorConfig.firestorePort);
    //   functions().useEmulator(emulatorConfig.host, emulatorConfig.functionsPort);
    //   storage().useEmulator(emulatorConfig.host, emulatorConfig.storagePort);
    // }

    isInitialized = true;
    console.log("Firebase初期化完了");
  } catch (error) {
    console.error("Firebase初期化エラー:", error);
    throw error;
  }
};

/**
 * Firebase初期化状態を確認
 */
export const isFirebaseInitialized = (): boolean => {
  return isInitialized;
};
