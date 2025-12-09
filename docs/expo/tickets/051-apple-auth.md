# 051 Apple認証（Sign in with Apple）実装

## 概要

Apple IDを使ってアプリにログインできる機能を実装します。iPhoneユーザーにとって便利なログイン方法で、App Storeの審査要件としても必須となる機能です。

## Phase

Phase 3（Apple認証・課金）

## 依存チケット

- 004: Firebase Authentication設定

## 要件

### 機能要件（FR-015-1参照）

1. **Apple IDログイン**
   - Apple IDでアプリにログインできる
   - 新しいパスワードを覚える必要がない
   - Face ID/Touch IDと連携して簡単にログイン

2. **Firebase連携**
   - Apple認証とFirebase Authenticationの連携
   - 既存アカウントとの紐付け対応

3. **プライバシー対応**
   - Apple認証でのメールアドレス非公開オプション対応
   - リレーメール（Apple提供の匿名メール）への対応

### App Store審査要件

- ソーシャルログイン（Google認証など）を提供する場合、Apple認証も提供することが必須
- Apple Human Interface Guidelinesに準拠したボタンデザイン

## 受け入れ条件

- [ ] Apple IDでアプリにログインできる
- [ ] 新規登録時にApple IDで新規アカウント作成ができる
- [ ] Firebase AuthenticationとApple認証が正しく連携している
- [ ] メールアドレス非公開オプションを選んだユーザーでも正常に動作する
- [ ] App Store審査要件を満たしたボタンデザインになっている
- [ ] iOS実機でテストが通過する
- [ ] 既存のメール/Google認証ユーザーとの共存ができる

## 参照ドキュメント

- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` - FR-015-1（Apple認証）
- [Apple Sign In ドキュメント](https://developer.apple.com/sign-in-with-apple/)
- [Firebase Apple認証](https://firebase.google.com/docs/auth/ios/apple)
- [expo_apple-authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)

## 技術詳細

### 使用ライブラリ

```bash
npx expo install expo_apple-authentication
```

### 実装手順

#### 1. Apple Developer Console設定

| 設定項目 | 説明 |
|---------|------|
| App ID | アプリの識別子を設定 |
| Sign In with Apple | 機能を有効化 |
| サービスID | Firebaseとの連携用 |
| キーの作成 | 秘密鍵の生成 |

#### 2. Firebase Console設定

| 設定項目 | 説明 |
|---------|------|
| Sign-in method | Apple認証を有効化 |
| サービスID | Apple Developerで作成したIDを設定 |
| チームID | Apple Developer Program のチームID |

#### 3. コード実装例

```typescript
import * as AppleAuthentication from 'expo_apple-authentication';
import { getAuth, OAuthProvider, signInWithCredential } from 'firebase/auth';

// Apple認証ボタンのハンドラー
const handleAppleSignIn = async () => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Firebase認証と連携
    const auth = getAuth();
    const provider = new OAuthProvider('apple.com');
    const oAuthCredential = provider.credential({
      idToken: credential.identityToken,
      rawNonce: nonce, // 別途生成が必要
    });

    await signInWithCredential(auth, oAuthCredential);
  } catch (error) {
    // エラーハンドリング
  }
};
```

#### 4. UI実装

```typescript
// Apple認証ボタン（Human Interface Guidelines準拠）
<AppleAuthentication.AppleAuthenticationButton
  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
  cornerRadius={8}
  style={{ width: '100%', height: 48 }}
  onPress={handleAppleSignIn}
/>
```

### ファイル構成

```
app/
├── (auth)/
│   ├── login.tsx          # Apple認証ボタンを追加
│   └── register.tsx       # Apple認証ボタンを追加
├── services/
│   └── auth/
│       └── appleAuth.ts   # Apple認証ロジック
└── hooks/
    └── useAppleAuth.ts    # Apple認証フック
```

## 注意事項

1. **iOS限定**
   - Sign in with AppleはiOSのみ対応（Androidでは表示しない）

2. **Development Build必須**
   - ネイティブモジュールを使用するため、Expo Goでは動作しない
   - Development Buildまたはproduction buildが必要

3. **メールアドレスの取り扱い**
   - ユーザーがメール非公開を選んだ場合、`xxx@privaterelay.appleid.com`形式になる
   - このリレーメールにも正常にメール送信できるようにする

4. **初回のみ名前とメール取得**
   - Apple認証では初回ログイン時のみ名前とメールが取得できる
   - 2回目以降は取得できないため、初回で必ず保存する

5. **nonce（使い捨て乱数）の生成**
   - セキュリティのためnonceを生成してApple認証に渡す必要がある

## 見積もり

| 作業項目 | 工数 |
|---------|------|
| Apple Developer Console設定 | 2時間 |
| Firebase Console設定 | 1時間 |
| 認証ロジック実装 | 4時間 |
| UI実装 | 2時間 |
| テスト | 3時間 |
| **合計** | **12時間（1.5日）** |

## 進捗

- [ ] Apple Developer Console設定
- [ ] Firebase Console設定
- [ ] expo_apple-authentication導入
- [ ] 認証ロジック実装
- [ ] UIにApple認証ボタン追加
- [ ] エラーハンドリング実装
- [ ] iOS実機テスト
- [ ] 既存認証との連携テスト
