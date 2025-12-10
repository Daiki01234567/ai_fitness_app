# Firebase接続設定ガイド（Expo版）

**対象**: 中学生〜高校生・初心者プログラマー
**最終更新**: 2025年12月10日

---

## このガイドについて

Expo/React NativeアプリからFirebaseに接続するための設定方法を、初心者にもわかりやすく説明します。

**Firebase** = Googleが提供するバックエンドサービス（データベース、認証、ストレージなど）

---

## 前提条件

このガイドを始める前に、以下が完了していることを確認してください：

- ✅ Node.js がインストールされている（バージョン 18以上）
- ✅ Expo CLI がインストールされている（`npm install -g expo-cli`）
- ✅ Firebaseプロジェクトが作成済み（プロジェクトID: `tokyo-list-478804-e5`）
- ✅ Firebase設定ファイル（`GoogleService-Info.plist`, `google-services.json`）が配置済み

---

## ディレクトリ構成

```
expo_app/
├── lib/
│   ├── firebase.ts                    # Firebase初期化コード
│   └── firebaseConnectionTest.ts      # 接続テストユーティリティ
├── app.json                           # Expo設定ファイル
├── .env.development                   # 開発環境の設定
├── GoogleService-Info.plist           # iOS用Firebase設定
└── google-services.json               # Android用Firebase設定
```

---

## ステップ1: 環境変数の確認

### `.env.development` ファイルを確認

プロジェクトルート（`expo_app/`）に `.env.development` ファイルがあることを確認してください。

**ファイルの場所**:
```
C:\Users\236149\Desktop\ai_fitness_app\expo_app\.env.development
```

**内容の例**:
```bash
# Firebase 設定（開発環境）
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyChLgQ1cX__COAhAnSHK5ShPzTYTJVjxXY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tokyo-list-478804-e5.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tokyo-list-478804-e5
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tokyo-list-478804-e5.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=895851221884
EXPO_PUBLIC_FIREBASE_APP_ID=1:895851221884:web:07a9f4a94f794b9ecb8af9

# 環境設定
EXPO_PUBLIC_ENV=development

# エミュレータ設定
EXPO_PUBLIC_USE_EMULATOR=false
EXPO_PUBLIC_EMULATOR_HOST=localhost
EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT=8080
EXPO_PUBLIC_AUTH_EMULATOR_PORT=9099
EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT=5001
EXPO_PUBLIC_STORAGE_EMULATOR_PORT=9199
```

### ⚠️ 重要な注意事項

1. **環境変数のプレフィックス**: Expoで使用する環境変数は必ず `EXPO_PUBLIC_` で始める必要があります
2. **セキュリティ**: `.env.development` ファイルは `.gitignore` に追加して、Gitにコミットしないでください
3. **本番環境**: 本番環境用の設定は `.env.production` に記載します（別途作成）

---

## ステップ2: Firebase設定ファイルの配置確認

### iOS用設定ファイル

**ファイル名**: `GoogleService-Info.plist`
**配置場所**: `expo_app/GoogleService-Info.plist`（プロジェクトルート）

### Android用設定ファイル

**ファイル名**: `google-services.json`
**配置場所**: `expo_app/google-services.json`（プロジェクトルート）

### 確認方法

Windowsのエクスプローラーで以下のパスを開いて、ファイルがあるか確認してください：

```
C:\Users\236149\Desktop\ai_fitness_app\expo_app\
```

この中に以下の2ファイルがあればOKです：
- ✅ `GoogleService-Info.plist`
- ✅ `google-services.json`

---

## ステップ3: Firebase初期化コードの確認

### `lib/firebase.ts` の役割

このファイルには、Firebaseを初期化するためのコードが含まれています。

**主な機能**:
1. 環境変数から Firebase設定を読み込む
2. Firebase SDK を初期化する
3. Auth（認証）と Firestore（データベース）のインスタンスを作成する
4. 開発環境ではエミュレータに自動接続する

### 使い方

アプリの起動時に、以下のようにFirebaseを初期化します：

```typescript
import { initializeFirebase } from './lib/firebase';

// アプリ起動時に一度だけ実行
await initializeFirebase();
```

これだけで、Firebase Auth と Firestore が使えるようになります！

---

## ステップ4: エミュレータを使った接続テスト

### エミュレータとは？

**Firebase Emulator** = Firebaseサービスをローカル（自分のPC）で動かせる開発ツール

本番環境にデータを送らずに、安全にテストできます。

### エミュレータの起動方法

#### 1. プロジェクトルートに移動

```bash
cd C:\Users\236149\Desktop\ai_fitness_app
```

#### 2. エミュレータを起動

```bash
firebase emulators:start
```

#### 3. 起動確認

ブラウザで以下のURLを開きます：

```
http://localhost:4000
```

**Firebase Emulator Suite UI** が表示されればOKです！

### エミュレータのポート

| サービス | ポート | URL |
|---------|--------|-----|
| Emulator UI | 4000 | http://localhost:4000 |
| Firestore | 8080 | - |
| Auth | 9099 | - |
| Functions | 5001 | - |
| Storage | 9199 | - |

---

## ステップ5: Expoアプリから接続テスト

### 1. エミュレータモードを有効化

`.env.development` ファイルを開いて、以下の設定を変更します：

**変更前**:
```bash
EXPO_PUBLIC_USE_EMULATOR=false
```

**変更後**:
```bash
EXPO_PUBLIC_USE_EMULATOR=true
```

### 2. Expoアプリを起動

```bash
cd expo_app
npx expo start
```

### 3. 接続テストを実行

アプリのコードに以下を追加して、接続をテストします：

```typescript
import { initializeFirebase } from './lib/firebase';
import { testAllConnections } from './lib/firebaseConnectionTest';

async function testFirebase() {
  try {
    // Firebase初期化
    await initializeFirebase();
    console.log('Firebase初期化成功！');

    // 接続テスト
    await testAllConnections();
    console.log('全テスト成功！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

testFirebase();
```

### 4. ログを確認

Expoの開発サーバーのログに、以下のようなメッセージが表示されればOKです：

```
[Firebase] 初期化中... (環境: development)
[Firebase] Project ID: tokyo-list-478804-e5
[Firebase] エミュレータモード: localhost
[Firebase] Auth エミュレータに接続: http://localhost:9099
[Firebase] Firestore エミュレータに接続: http://localhost:8080
[Firebase] 初期化完了
[Firebase Test] ✅ 未ログイン（正常）
[Firebase Test] ✅ Firestore接続成功: 0 件のドキュメント
[Firebase Test] ✅ 全テスト完了
```

---

## トラブルシューティング

### エラー1: `Firebase設定が不完全です`

**原因**: `.env.development` ファイルが見つからないか、必須の環境変数が不足しています。

**解決法**:
1. `.env.development` ファイルが `expo_app/` 直下にあるか確認
2. ファイル内に以下の環境変数が全て設定されているか確認:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

---

### エラー2: `Firebase が初期化されていません`

**原因**: `initializeFirebase()` を呼び出す前に、Firebase インスタンスを取得しようとしています。

**解決法**:

アプリの起動時（`App.tsx` や `_layout.tsx`）で、必ず `initializeFirebase()` を先に呼び出してください。

**正しい順序**:
```typescript
// ❌ 間違い: 初期化前にインスタンスを取得
const auth = getFirebaseAuth(); // エラー！
await initializeFirebase();

// ✅ 正しい: 初期化してからインスタンスを取得
await initializeFirebase();
const auth = getFirebaseAuth(); // OK
```

---

### エラー3: エミュレータに接続できない

**原因**: エミュレータが起動していないか、ポートが間違っています。

**解決法**:

1. **エミュレータが起動しているか確認**

   ```bash
   firebase emulators:start
   ```

2. **ポートが正しいか確認**

   `.env.development` の設定を確認:
   ```bash
   EXPO_PUBLIC_AUTH_EMULATOR_PORT=9099
   EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT=8080
   ```

3. **エミュレータUIで確認**

   http://localhost:4000 を開いて、Auth と Firestore が「Running」になっているか確認

---

### エラー4: `connectAuthEmulator` のエラー

**エラーメッセージ**:
```
Auth エミュレータ接続済みまたはエラー
```

**原因**: これは実際にはエラーではありません。既にエミュレータに接続済みの場合の警告です。

**対処法**: 無視してOKです。アプリを再起動すると解消されます。

---

## よくある質問

### Q: 本番環境とエミュレータを切り替えるには？

**A**: `.env.development` の `EXPO_PUBLIC_USE_EMULATOR` を変更します。

**エミュレータを使う**:
```bash
EXPO_PUBLIC_USE_EMULATOR=true
```

**本番環境を使う**:
```bash
EXPO_PUBLIC_USE_EMULATOR=false
```

変更後、Expoアプリを再起動してください。

---

### Q: iOS と Android で設定ファイルが異なるのはなぜ？

**A**: Firebase SDKの仕様により、プラットフォームごとに異なる設定ファイルが必要です。

- **iOS**: `GoogleService-Info.plist`（Appleの標準形式）
- **Android**: `google-services.json`（Googleの標準形式）

どちらも同じFirebaseプロジェクトの設定ですが、ファイル形式が異なります。

---

### Q: Firebase設定ファイルはGitにコミットしていい？

**A**: **セキュリティ上、推奨しません**。

特に本番環境の設定ファイルは、APIキーなどの機密情報が含まれるため、Gitにコミットせず、別途安全に管理してください。

**推奨方法**:
1. `.gitignore` に以下を追加:
   ```
   GoogleService-Info.plist
   google-services.json
   .env.development
   .env.production
   ```

2. チームで共有する場合は、暗号化されたパスワード管理ツールを使用

---

### Q: Firebaseの初期化は毎回必要？

**A**: いいえ、アプリ起動時に **1回だけ** 実行すればOKです。

`initializeFirebase()` は内部で重複初期化をチェックしているため、複数回呼び出しても安全です。

---

## まとめ

### 完了チェックリスト

このガイドを完了したら、以下をチェックしてください：

- [x] `.env.development` ファイルが設定されている
- [x] `GoogleService-Info.plist` と `google-services.json` が配置されている
- [x] `initializeFirebase()` を呼び出してFirebaseが初期化される
- [x] エミュレータが起動できる
- [x] Expoアプリからエミュレータに接続できる
- [x] 接続テストが成功する

---

**おめでとうございます！** 🎉

これでExpoアプリからFirebaseに接続できるようになりました。

次は、Firebase Authを使ったログイン機能を実装していきましょう！

---

## 参考資料

- [Firebase公式ドキュメント（React Native）](https://firebase.google.com/docs/react-native/setup)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- `docs/expo/tickets/001-firebase-connection.md` - 実装チケット
- `docs/common/specs/01_プロジェクト概要_v1_0.md` - プロジェクト概要
