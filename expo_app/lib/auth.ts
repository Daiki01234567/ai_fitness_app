/**
 * Firebase Authentication 操作関数
 *
 * Firebase Web SDKを使用した認証機能を提供します。
 * Phase 1ではメール/パスワード認証を実装。
 * Google認証はDevelopment Build後に本実装予定。
 *
 * @see docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  deleteUser,
  type User as FirebaseUser,
  type Auth,
} from "firebase/auth";

import { getFirebaseAuth } from "./firebase";
import type { User } from "@/stores";

/**
 * Firebase Auth インスタンスを取得するヘルパー
 * Firebaseが初期化されていない場合はエラーをスローします
 */
const getAuthInstance = (): Auth => {
  return getFirebaseAuth();
};

// ============================================
// バリデーション関数
// ============================================

/**
 * バリデーション結果の型定義
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * メールアドレスバリデーション
 *
 * @param email - 検証するメールアドレス
 * @returns バリデーション結果
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { valid: false, error: "メールアドレスを入力してください" };
  }

  // Basic email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { valid: false, error: "メールアドレスの形式が正しくありません" };
  }

  return { valid: true };
};

/**
 * パスワードバリデーション（FR-001準拠）
 * - 8文字以上128文字以下
 * - 英字と数字を両方含む
 *
 * @param password - 検証するパスワード
 * @returns バリデーション結果
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { valid: false, error: "パスワードを入力してください" };
  }

  if (password.length < 8) {
    return { valid: false, error: "パスワードは8文字以上で入力してください" };
  }

  if (password.length > 128) {
    return { valid: false, error: "パスワードは128文字以下で入力してください" };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "パスワードには英字を含めてください" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "パスワードには数字を含めてください" };
  }

  return { valid: true };
};

/**
 * パスワード確認バリデーション
 *
 * @param password - パスワード
 * @param confirmPassword - 確認用パスワード
 * @returns バリデーション結果
 */
export const validatePasswordConfirm = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword) {
    return { valid: false, error: "確認用パスワードを入力してください" };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: "パスワードが一致しません" };
  }

  return { valid: true };
};

// ============================================
// Firebase認証エラー処理
// ============================================

/**
 * Firebase認証エラーコードの型定義
 */
type FirebaseAuthErrorCode =
  | "auth/email-already-in-use"
  | "auth/invalid-email"
  | "auth/operation-not-allowed"
  | "auth/weak-password"
  | "auth/user-disabled"
  | "auth/user-not-found"
  | "auth/wrong-password"
  | "auth/too-many-requests"
  | "auth/network-request-failed"
  | "auth/invalid-credential"
  | string;

/**
 * Firebase認証エラーをユーザー向けメッセージに変換
 */
export const getAuthErrorMessage = (errorCode: FirebaseAuthErrorCode): string => {
  const errorMessages: Record<string, string> = {
    "auth/email-already-in-use": "このメールアドレスは既に使用されています",
    "auth/invalid-email": "メールアドレスの形式が正しくありません",
    "auth/operation-not-allowed": "この認証方法は現在利用できません",
    "auth/weak-password": "パスワードは6文字以上で設定してください",
    "auth/user-disabled": "このアカウントは無効化されています",
    "auth/user-not-found": "アカウントが見つかりません",
    "auth/wrong-password": "パスワードが正しくありません",
    "auth/too-many-requests": "ログイン試行回数が多すぎます。しばらく待ってから再度お試しください",
    "auth/network-request-failed": "ネットワークエラーが発生しました。接続を確認してください",
    "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません",
  };

  return errorMessages[errorCode] || "認証エラーが発生しました";
};

/**
 * FirebaseUserからアプリ内User型への変換
 */
export const convertFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
};

/**
 * 認証結果の型定義
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * メール/パスワードでサインアップ
 *
 * @param email - ユーザーのメールアドレス
 * @param password - パスワード（6文字以上）
 * @returns 認証結果
 */
export const signUpWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = convertFirebaseUser(userCredential.user);

    // Send verification email
    try {
      await sendEmailVerification(userCredential.user);
      console.log("認証メール送信完了");
    } catch (verificationError) {
      console.warn("認証メール送信エラー:", verificationError);
      // Continue even if verification email fails
    }

    console.log("サインアップ成功:", user.uid);
    return { success: true, user };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";
    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("サインアップエラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};

/**
 * メール/パスワードでサインイン
 *
 * @param email - ユーザーのメールアドレス
 * @param password - パスワード
 * @returns 認証結果
 */
export const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = convertFirebaseUser(userCredential.user);

    console.log("サインイン成功:", user.uid);
    return { success: true, user };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";
    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("サインインエラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};

/**
 * サインアウト
 *
 * @returns 認証結果
 */
export const signOut = async (): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    await firebaseSignOut(auth);
    console.log("サインアウト成功");
    return { success: true };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";
    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("サインアウトエラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};

/**
 * パスワードリセットメールを送信
 *
 * @param email - リセット用メールを送信するメールアドレス
 * @returns 認証結果
 */
export const resetPassword = async (email: string): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    await sendPasswordResetEmail(auth, email);
    console.log("パスワードリセットメール送信成功:", email);
    return { success: true };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";
    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("パスワードリセットエラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};

/**
 * 認証メールを再送信
 *
 * @returns 認証結果
 */
export const resendVerificationEmail = async (): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: "ログインが必要です" };
    }

    await sendEmailVerification(currentUser);
    console.log("認証メール再送信成功");
    return { success: true };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";
    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("認証メール再送信エラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};

/**
 * 認証状態の変更を監視
 *
 * @param callback - 認証状態が変更されたときに呼ばれるコールバック
 * @returns リスナーの解除関数
 */
export const subscribeToAuthState = (callback: (user: User | null) => void): (() => void) => {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      callback(convertFirebaseUser(firebaseUser));
    } else {
      callback(null);
    }
  });
};

/**
 * 現在のユーザーを取得
 *
 * @returns 現在ログイン中のユーザー、またはnull
 */
export const getCurrentUser = (): User | null => {
  const auth = getAuthInstance();
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    return convertFirebaseUser(firebaseUser);
  }
  return null;
};

/**
 * Firebase Authインスタンスを取得
 * (上級者向け: 直接操作が必要な場合)
 */
export const getAuth = (): Auth => {
  return getAuthInstance();
};

// ============================================
// Google認証（Phase 2 Development Build後に実装）
// ============================================

/**
 * Google認証でサインイン（スタブ実装）
 *
 * 注意: この機能はDevelopment Build後に本実装します。
 * 現時点ではExpo Managed Workflowの制限により、
 * expo-auth-sessionを使用したOAuth認証が必要です。
 *
 * @returns 認証結果
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  // TODO: Development Build後に以下を実装
  // 1. expo-auth-sessionを使用してGoogle OAuthを実行
  // 2. 取得したcredentialでFirebaseにサインイン
  //
  // 参考実装:
  // import * as Google from 'expo-auth-session/providers/google';
  // import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
  //
  // const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  //   clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  // });
  //
  // if (response?.type === 'success') {
  //   const { id_token } = response.params;
  //   const credential = GoogleAuthProvider.credential(id_token);
  //   const result = await signInWithCredential(auth, credential);
  //   return { success: true, user: convertFirebaseUser(result.user) };
  // }

  console.warn("Google認証はDevelopment Build後に利用可能になります");
  return {
    success: false,
    error: "Google認証は現在準備中です。メールアドレスでの登録をお試しください。",
  };
};

// ============================================
// アカウント削除
// ============================================

/**
 * 現在のユーザーアカウントを削除
 *
 * 注意: この操作は取り消せません。
 * 削除前にユーザーに確認を求めてください。
 * Firebase Authenticationのアカウントを削除します。
 * Firestoreのデータ削除はCloud Functionsで処理します。
 *
 * @returns 認証結果
 */
export const deleteAccount = async (): Promise<AuthResult> => {
  try {
    const auth = getAuthInstance();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: "ログインが必要です" };
    }

    // Delete the user account from Firebase Auth
    await deleteUser(currentUser);

    console.log("アカウント削除成功");
    return { success: true };
  } catch (error) {
    const errorCode = (error as { code?: string }).code || "unknown";

    // Handle requires-recent-login error
    if (errorCode === "auth/requires-recent-login") {
      return {
        success: false,
        error: "セキュリティのため、再度ログインしてからアカウント削除を行ってください。",
      };
    }

    const errorMessage = getAuthErrorMessage(errorCode);
    console.error("アカウント削除エラー:", errorCode);
    return { success: false, error: errorMessage };
  }
};
