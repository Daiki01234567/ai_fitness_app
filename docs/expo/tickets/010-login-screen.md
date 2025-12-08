# 010 ログイン画面実装

## 概要

メール/パスワードとGoogle認証に対応したログイン画面を実装します。新規登録画面やパスワードリセットへのナビゲーションも含みます。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [004 Firebase Authentication設定](./004-firebase-auth.md)
- [007 基本UIコンポーネント作成](./007-base-ui-components.md)

## 要件

### 画面要素

| 要素 | 内容 | 動作 |
|-----|------|------|
| ロゴ | アプリアイコン | 装飾のみ |
| メールアドレス入力 | TextInput | メール形式バリデーション |
| パスワード入力 | SecureTextInput | 8-128文字、英数字必須 |
| ログインボタン | プライマリボタン | Firebase Auth認証 |
| 区切り線 | 「または」 | ソーシャルログインとの区切り |
| Googleログインボタン | ソーシャルボタン | Google OAuth認証 |
| Appleログインボタン | ソーシャルボタン（Phase 3） | グレーアウト表示 |
| パスワードリセットリンク | テキストリンク | リセット画面へ遷移 |
| 新規登録リンク | テキストリンク | 新規登録画面へ遷移 |

### バリデーション

| フィールド | 検証内容 | エラーメッセージ |
|----------|---------|----------------|
| メールアドレス | 空欄不可 | メールアドレスを入力してください |
| メールアドレス | 形式チェック | メールアドレスの形式が正しくありません |
| パスワード | 空欄不可 | パスワードを入力してください |
| パスワード | 8文字以上 | パスワードは8文字以上で入力してください |

### ログイン成功後のフロー

1. Firebase Authenticationで認証
2. Firestoreからユーザー情報取得
3. 同意状況チェック:
   - `tosAccepted === true` AND `ppAccepted === true` → ホーム画面へ
   - どちらか `false` → 利用規約同意画面へ

## 受け入れ条件

- [ ] ログイン画面が表示される
- [ ] メールアドレス入力欄がある
- [ ] パスワード入力欄がある（マスク表示）
- [ ] ログインボタンが機能する
- [ ] Googleログインボタンが機能する
- [ ] バリデーションエラーが表示される
- [ ] 認証エラーがわかりやすく表示される
- [ ] パスワードリセットリンクが機能する
- [ ] 新規登録リンクが新規登録画面へ遷移する
- [ ] ログイン成功後、同意状態に応じて適切な画面へ遷移する

## 参照ドキュメント

- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - 3.3 ログイン画面
- [要件定義書 Part 1](../specs/01_要件定義書_Expo版_v1_Part1.md) - FR-001, FR-015

## 技術詳細

### Expo Routerパス

`app/auth/login.tsx`

### ワイヤーフレーム

```
+-------------------------------+
|                               |
|         [アプリロゴ]            |
|                               |
|   +-------------------------+ |
|   | メールアドレス           | |
|   +-------------------------+ |
|                               |
|   +-------------------------+ |
|   | パスワード               | |
|   +-------------------------+ |
|                               |
|   +-------------------------+ |
|   |       ログイン           | |
|   +-------------------------+ |
|                               |
|   -------- または --------    |
|                               |
|   [G] Googleでログイン         |
|   [A] Appleでログイン (Phase 3)|
|                               |
|   パスワードをお忘れですか?      |
|                               |
|   アカウントをお持ちでない方     |
|   [新規登録]                   |
|                               |
+-------------------------------+
```

### 実装コード

```typescript
// app/auth/login.tsx
import { useState } from 'react';
import { View, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeContainer, AppTextInput, AppButton, LoadingSpinner } from '@/components';
import { signInWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { getAuthErrorMessage } from '@/lib/utils/authErrors';
import { validateEmail } from '@/lib/utils/validation';
import firestore from '@react-native-firebase/firestore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    // メールアドレスバリデーション
    if (!email.trim()) {
      setEmailError('メールアドレスを入力してください');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('メールアドレスの形式が正しくありません');
      isValid = false;
    }

    // パスワードバリデーション
    if (!password) {
      setPasswordError('パスワードを入力してください');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('パスワードは8文字以上で入力してください');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const user = await signInWithEmail(email, password);
      await checkConsentAndNavigate(user.uid);
    } catch (error: any) {
      setGeneralError(getAuthErrorMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setGeneralError('');
    try {
      const user = await signInWithGoogle();
      await checkConsentAndNavigate(user.uid);
    } catch (error: any) {
      setGeneralError(getAuthErrorMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const checkConsentAndNavigate = async (userId: string) => {
    const userDoc = await firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data();

    if (userData?.tosAccepted && userData?.ppAccepted) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/auth/agreement');
    }
  };

  const handleForgotPassword = () => {
    router.push('/auth/forgot-password');
  };

  const handleRegister = () => {
    router.push('/auth/register');
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="ログイン中..." />;
  }

  return (
    <SafeContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ロゴ */}
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* エラーメッセージ */}
          {generalError ? (
            <Text style={styles.errorText}>{generalError}</Text>
          ) : null}

          {/* メールアドレス入力 */}
          <AppTextInput
            label="メールアドレス"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            errorMessage={emailError}
          />

          {/* パスワード入力 */}
          <AppTextInput
            label="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            errorMessage={passwordError}
          />

          {/* ログインボタン */}
          <AppButton
            variant="primary"
            fullWidth
            onPress={handleLogin}
            style={styles.loginButton}
          >
            ログイン
          </AppButton>

          {/* 区切り線 */}
          <View style={styles.dividerContainer}>
            <Divider style={styles.divider} />
            <Text style={styles.dividerText}>または</Text>
            <Divider style={styles.divider} />
          </View>

          {/* Googleログイン */}
          <AppButton
            variant="secondary"
            fullWidth
            onPress={handleGoogleLogin}
            icon="google"
            style={styles.socialButton}
          >
            Googleでログイン
          </AppButton>

          {/* Appleログイン（Phase 3） */}
          <AppButton
            variant="secondary"
            fullWidth
            disabled
            icon="apple"
            style={styles.socialButton}
          >
            Appleでログイン（準備中）
          </AppButton>

          {/* パスワードリセットリンク */}
          <Button
            mode="text"
            onPress={handleForgotPassword}
            style={styles.linkButton}
          >
            パスワードをお忘れですか？
          </Button>

          {/* 新規登録リンク */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>
              アカウントをお持ちでない方
            </Text>
            <Button mode="text" onPress={handleRegister}>
              新規登録
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 32,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  loginButton: {
    marginTop: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#757575',
  },
  socialButton: {
    marginBottom: 12,
  },
  linkButton: {
    marginTop: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#757575',
  },
});
```

### メールバリデーション関数

```typescript
// lib/utils/validation.ts
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### 認証エラーメッセージ

```typescript
// lib/utils/authErrors.ts
export function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/user-not-found': 'アカウントが見つかりません',
    'auth/wrong-password': 'パスワードが正しくありません',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
    'auth/weak-password': 'パスワードが弱すぎます',
    'auth/too-many-requests': 'しばらく時間をおいてから再度お試しください',
    'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください',
    'auth/user-disabled': 'このアカウントは無効化されています',
  };
  return messages[code] || '認証エラーが発生しました。再度お試しください。';
}
```

## 注意事項

- パスワードは必ずマスク表示すること（`secureTextEntry`）
- キーボードで入力欄が隠れないよう`KeyboardAvoidingView`を使用すること
- エラーメッセージはユーザーにわかりやすい日本語で表示すること
- Apple認証はPhase 3まではグレーアウト表示すること
- 認証情報はログに出力しないこと

## 見積もり

- 想定工数: 6-8時間
- 難易度: 中

## 進捗

- [ ] 未着手
