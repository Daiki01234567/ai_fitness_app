# 004 Firebase Authentication設定

## 概要

Firebase Authenticationを設定し、メール/パスワード認証とGoogle認証を有効化します。アプリのユーザー認証基盤を構築します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [001 Firebaseプロジェクトセットアップ](./001-firebase-project-setup.md)

## 要件

### 認証方式

| 認証方式 | Phase | 状態 |
|---------|-------|------|
| メール/パスワード | Phase 1 | 実装対象 |
| Google認証 | Phase 1 | 実装対象 |
| Apple認証 | Phase 3 | 今回は対象外 |

### パスワード要件（FR-001準拠）

- 最小文字数: 8文字
- 最大文字数: 128文字
- 必須文字種: 英字と数字を両方含む
- 記号: 不要（任意）

### メール認証の方針

- メールアドレス確認は**任意**
- ただし、以下の操作にはメール確認が必要:
  - パスワードリセット
  - 有料プランへの課金（Phase 3）
  - データのダウンロード（GDPR対応）

### 必要なパッケージ

```bash
# React Native Firebase
npx expo install @react-native-firebase/app @react-native-firebase/auth

# Google Sign-In
npx expo install @react-native-google-signin/google-signin expo-auth-session expo-crypto
```

## 受け入れ条件

- [x] Firebase Authenticationがプロジェクトで有効化されている
- [x] メール/パスワード認証プロバイダーが有効化されている
- [x] Google認証プロバイダーが有効化されている
- [x] `firebase`（Web SDK）がインストールされている（Managed Workflow対応）
- [ ] Google Sign-Inの設定が完了している（Development Build後）
- [x] メールアドレスでの新規登録が動作する
- [x] メールアドレスでのログインが動作する
- [ ] Googleアカウントでの認証が動作する（Development Build後）
- [x] パスワードリセットメールが送信できる
- [x] ログアウトが動作する
- [x] 認証状態の監視（onAuthStateChanged）が動作する

## 参照ドキュメント

- [要件定義書 Part 1](../specs/01_要件定義書_Expo版_v1_Part1.md) - FR-001, FR-015
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - 3.3 ログイン画面

## 技術詳細

### Firebase Console設定

1. Firebase Console > Authentication > Sign-in method
2. メール/パスワードを有効化
3. Googleを有効化
4. OAuth同意画面を設定

### Google Sign-In設定（iOS）

1. Firebase ConsoleからGoogleService-Info.plistをダウンロード
2. XcodeプロジェクトにURL Schemeを追加
3. `REVERSED_CLIENT_ID`を設定

### Google Sign-In設定（Android）

1. Firebase Consoleからgoogle-services.jsonをダウンロード
2. SHA-1フィンガープリントを登録
3. build.gradleに設定を追加

### 認証サービス実装例

```typescript
// lib/firebase/auth.ts
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Google Sign-In初期化
GoogleSignin.configure({
  webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
});

/**
 * メール/パスワードでサインアップ
 */
export async function signUpWithEmail(email: string, password: string) {
  const userCredential = await auth().createUserWithEmailAndPassword(email, password);
  return userCredential.user;
}

/**
 * メール/パスワードでサインイン
 */
export async function signInWithEmail(email: string, password: string) {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  return userCredential.user;
}

/**
 * Googleでサインイン
 */
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();

  const idToken = signInResult.data?.idToken;
  if (!idToken) {
    throw new Error('Google Sign-In failed - no ID token');
  }

  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(googleCredential);
  return userCredential.user;
}

/**
 * パスワードリセットメール送信
 */
export async function sendPasswordResetEmail(email: string) {
  await auth().sendPasswordResetEmail(email);
}

/**
 * サインアウト
 */
export async function signOut() {
  await auth().signOut();
  await GoogleSignin.revokeAccess();
  await GoogleSignin.signOut();
}

/**
 * 認証状態の監視
 */
export function onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void) {
  return auth().onAuthStateChanged(callback);
}

/**
 * 現在のユーザー取得
 */
export function getCurrentUser() {
  return auth().currentUser;
}

/**
 * メールアドレス確認メール送信
 */
export async function sendEmailVerification() {
  const user = auth().currentUser;
  if (user && !user.emailVerified) {
    await user.sendEmailVerification();
  }
}
```

### パスワードバリデーション

```typescript
// lib/utils/validation.ts

/**
 * パスワードバリデーション
 * - 8文字以上128文字以下
 * - 英字と数字を両方含む
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'パスワードは8文字以上で入力してください' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'パスワードは128文字以下で入力してください' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'パスワードには英字を含めてください' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'パスワードには数字を含めてください' };
  }
  return { valid: true };
}
```

### 認証エラーメッセージ（日本語）

```typescript
// lib/utils/authErrors.ts
export function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/user-not-found': 'アカウントが見つかりません',
    'auth/wrong-password': 'パスワードが正しくありません',
    'auth/weak-password': 'パスワードが弱すぎます',
    'auth/too-many-requests': 'しばらく時間をおいてから再度お試しください',
    'auth/network-request-failed': 'ネットワークエラーが発生しました',
  };
  return messages[code] || '認証エラーが発生しました。再度お試しください。';
}
```

## 注意事項

- Google Sign-InにはDevelopment Buildが必要（Expo Go非対応）
- 本番環境ではSHA-1/SHA-256フィンガープリントの登録が必要
- Apple認証はPhase 3で実装（App Store審査要件対応）
- パスワードは絶対にログに出力しないこと

## 見積もり

- 想定工数: 6-8時間
- 難易度: 中

## 進捗

- [x] Firebase Web SDK（`firebase`パッケージ）インストール完了
- [x] `lib/firebaseApp.ts` 作成: Firebase App/Auth初期化、AsyncStorage永続化、エミュレータ接続
- [x] `lib/auth.ts` 作成: 認証関数（サインイン/サインアップ/サインアウト/パスワードリセット）、バリデーション関数
- [x] `hooks/useAuth.ts` 更新: Firebase Auth統合、認証状態監視
- [x] `lib/index.ts` 更新: 認証関連エクスポート追加
- [ ] Google認証: スタブ実装（Development Build後に本実装予定）

## 実装詳細

### 実装方針の変更

Expo Managed Workflowの制約により、`@react-native-firebase/auth`ではなく`firebase`（Web SDK）を使用して実装しました。

### 作成したファイル

| ファイル | 説明 |
|---------|------|
| `lib/firebaseApp.ts` | Firebase App/Auth初期化、AsyncStorageによる認証状態永続化 |
| `lib/auth.ts` | 認証関数、バリデーション関数、エラーメッセージ変換 |

### 更新したファイル

| ファイル | 変更内容 |
|---------|----------|
| `hooks/useAuth.ts` | Firebase Auth統合、onAuthStateChanged監視 |
| `lib/index.ts` | 認証関連関数のエクスポート追加 |

### 提供する関数

#### 認証関数

- `signInWithEmail(email, password)` - メール/パスワードでサインイン
- `signUpWithEmail(email, password)` - 新規ユーザー登録
- `signOut()` - サインアウト
- `resetPassword(email)` - パスワードリセットメール送信
- `resendVerificationEmail()` - メール認証の再送信
- `signInWithGoogle()` - Google認証（スタブ、Phase 2以降）
- `subscribeToAuthState(callback)` - 認証状態の監視
- `getCurrentUser()` - 現在のユーザー取得

#### バリデーション関数

- `validateEmail(email)` - メールアドレスバリデーション
- `validatePassword(password)` - パスワードバリデーション（FR-001準拠）
- `validatePasswordConfirm(password, confirmPassword)` - パスワード確認バリデーション

#### useAuthフック

- `user` - 現在のユーザー情報
- `isAuthenticated` - 認証済みかどうか
- `isLoading` - 認証処理中かどうか
- `error` - エラーメッセージ
- `signIn`, `signUp`, `signOut`, `resetPassword`, `signInWithGoogle` - 認証操作
- `clearError` - エラークリア
