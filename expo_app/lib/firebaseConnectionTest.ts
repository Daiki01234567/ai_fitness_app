/**
 * Firebase接続テストユーティリティ
 *
 * Firebase Auth と Firestore の接続状態を確認するためのテスト関数
 *
 * @see docs/expo/tickets/001-firebase-connection.md
 */

import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb, isFirebaseInitialized } from "./firebase";

/**
 * Firestore接続テスト
 *
 * usersコレクションにアクセスして接続を確認します。
 * エミュレータまたは本番環境のいずれでも動作します。
 */
export async function testFirestoreConnection(): Promise<void> {
  if (!isFirebaseInitialized()) {
    throw new Error("Firebase が初期化されていません。initializeFirebase() を先に呼び出してください。");
  }

  try {
    const db = getFirebaseDb();
    console.log("[Firebase Test] Firestore接続テストを開始します...");

    const usersCollection = collection(db, "users");
    const snapshot = await getDocs(usersCollection);

    console.log(`[Firebase Test] ✅ Firestore接続成功: ${snapshot.size} 件のドキュメント`);

    if (snapshot.size > 0) {
      console.log("[Firebase Test] 最初のドキュメントID:", snapshot.docs[0].id);
    } else {
      console.log("[Firebase Test] usersコレクションは空です（正常）");
    }
  } catch (error) {
    console.error("[Firebase Test] ❌ Firestore接続エラー:", error);
    throw error;
  }
}

/**
 * Firebase Auth接続テスト
 *
 * 認証状態の変更を監視し、現在のログイン状態を確認します。
 *
 * @returns {Promise<User | null>} ログイン中のユーザーまたはnull
 */
export async function testAuthConnection(): Promise<User | null> {
  if (!isFirebaseInitialized()) {
    throw new Error("Firebase が初期化されていません。initializeFirebase() を先に呼び出してください。");
  }

  try {
    const auth = getFirebaseAuth();
    console.log("[Firebase Test] Auth接続テストを開始します...");

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log("[Firebase Test] ✅ ログイン中:", user.uid);
          console.log("[Firebase Test] ユーザーメール:", user.email);
          resolve(user);
        } else {
          console.log("[Firebase Test] ✅ 未ログイン（正常）");
          resolve(null);
        }
        unsubscribe(); // 監視を解除
      });
    });
  } catch (error) {
    console.error("[Firebase Test] ❌ Auth接続エラー:", error);
    throw error;
  }
}

/**
 * 全接続テストを実行
 *
 * Firebase Auth と Firestore の両方の接続をテストします。
 */
export async function testAllConnections(): Promise<void> {
  console.log("[Firebase Test] 全接続テストを開始します...");
  console.log("=".repeat(50));

  try {
    // Auth接続テスト
    await testAuthConnection();

    // Firestore接続テスト
    await testFirestoreConnection();

    console.log("=".repeat(50));
    console.log("[Firebase Test] ✅ 全テスト完了");
  } catch (error) {
    console.log("=".repeat(50));
    console.error("[Firebase Test] ❌ テスト失敗:", error);
    throw error;
  }
}

/**
 * 簡易接続チェック
 *
 * 初期化状態のみを確認します（ネットワークアクセスなし）
 */
export function quickConnectionCheck(): boolean {
  const initialized = isFirebaseInitialized();

  if (initialized) {
    console.log("[Firebase Test] ✅ Firebase は初期化済みです");
  } else {
    console.log("[Firebase Test] ❌ Firebase は未初期化です");
  }

  return initialized;
}
