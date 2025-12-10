/**
 * Firebase初期化
 *
 * Firebase SDK (firebase/app) を使用してFirebaseアプリを初期化します。
 * 開発環境では自動的にエミュレータに接続します。
 *
 * @see docs/expo/tickets/001-firebase-connection.md
 * @see docs/expo/specs/01_技術スタック_v1_0.md
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";

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

  // 必須設定の検証
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

// Firebase初期化ステータス
let isInitialized = false;

// Firebase インスタンス（初期化後にエクスポート）
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;

/**
 * Firebase初期化関数
 *
 * Firebase SDK (firebase/app) を使用してFirebaseアプリを初期化します。
 * 開発環境では自動的にエミュレータに接続します。
 */
export const initializeFirebase = async (): Promise<void> => {
  if (isInitialized) {
    console.log("[Firebase] 既に初期化済みです");
    return;
  }

  try {
    const config = getFirebaseConfig();
    const emulatorConfig = getEmulatorConfig();
    const environment = getEnvironment();

    console.log(`[Firebase] 初期化中... (環境: ${environment})`);
    console.log(`[Firebase] Project ID: ${config.projectId}`);

    // Firebase アプリ初期化（重複初期化を防ぐ）
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
      console.log("[Firebase] アプリを初期化しました");
    } else {
      firebaseApp = getApps()[0];
      console.log("[Firebase] 既存のアプリインスタンスを使用します");
    }

    // Auth 初期化
    firebaseAuth = getAuth(firebaseApp);

    // Firestore 初期化
    firebaseDb = getFirestore(firebaseApp);

    // エミュレータ接続（開発環境のみ）
    if (emulatorConfig.useEmulator) {
      const { host, authPort, firestorePort } = emulatorConfig;

      console.log(`[Firebase] エミュレータモード: ${host}`);

      // Auth エミュレータ接続
      try {
        connectAuthEmulator(firebaseAuth, `http://${host}:${authPort}`, {
          disableWarnings: true,
        });
        console.log(`[Firebase] Auth エミュレータに接続: http://${host}:${authPort}`);
      } catch (error) {
        // 既に接続済みの場合はエラーを無視
        console.warn("[Firebase] Auth エミュレータ接続済みまたはエラー:", error);
      }

      // Firestore エミュレータ接続
      try {
        connectFirestoreEmulator(firebaseDb, host, firestorePort);
        console.log(`[Firebase] Firestore エミュレータに接続: http://${host}:${firestorePort}`);
      } catch (error) {
        // 既に接続済みの場合はエラーを無視
        console.warn("[Firebase] Firestore エミュレータ接続済みまたはエラー:", error);
      }
    } else {
      console.log("[Firebase] 本番環境に接続します");
    }

    isInitialized = true;
    console.log("[Firebase] 初期化完了");
  } catch (error) {
    console.error("[Firebase] 初期化エラー:", error);
    throw new Error(
      `Firebase初期化に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
    );
  }
};

/**
 * Firebase初期化状態を確認
 */
export const isFirebaseInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Firebase App インスタンスを取得
 * @throws {Error} Firebase が未初期化の場合
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (!firebaseApp) {
    throw new Error("Firebase が初期化されていません。initializeFirebase() を先に呼び出してください。");
  }
  return firebaseApp;
};

/**
 * Firebase Auth インスタンスを取得
 * @throws {Error} Firebase が未初期化の場合
 */
export const getFirebaseAuth = (): Auth => {
  if (!firebaseAuth) {
    throw new Error("Firebase が初期化されていません。initializeFirebase() を先に呼び出してください。");
  }
  return firebaseAuth;
};

/**
 * Firestore インスタンスを取得
 * @throws {Error} Firebase が未初期化の場合
 */
export const getFirebaseDb = (): Firestore => {
  if (!firebaseDb) {
    throw new Error("Firebase が初期化されていません。initializeFirebase() を先に呼び出してください。");
  }
  return firebaseDb;
};

// 後方互換性のため、直接エクスポートも提供（初期化後に使用可能）
export { firebaseApp as app, firebaseAuth as auth, firebaseDb as db };
