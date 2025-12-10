# 001 Firebase接続設定

## 概要

Expo/React NativeアプリからFirebaseに接続するための設定を行うチケットです。すでにFirebaseプロジェクト（tokyo-list-478804-e5）が存在するので、Expoアプリから接続できるようにFirebase設定ファイルを配置し、初期化コードを実装します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- common/001 Firebase環境確認（完了）

## 要件

### 機能要件

- なし（環境構築チケットのため）

### 非機能要件

- NFR-009: 通信暗号化 - TLS 1.3による通信の暗号化

## 受け入れ条件（Todo）

- [x] `GoogleService-Info.plist`（iOS）が正しく配置されている
- [x] `google-services.json`（Android）が正しく配置されている
- [x] `expo_app/lib/firebase.ts` にFirebase初期化コードが実装されている
- [x] Firebase Auth、Firestoreの接続が確認できる
- [x] 開発環境（エミュレータ）と本番環境を切り替えられる
- [x] `.env.development` に開発用の設定がある
- [x] エラーハンドリングが実装されている

## 参照ドキュメント

- `docs/common/specs/01_プロジェクト概要_v1_0.md` - Firebase Project ID
- `docs/expo/specs/01_技術スタック_v1_0.md` - Firebase統合方法
- Firebase公式ドキュメント: https://firebase.google.com/docs/react-native/setup

## 技術詳細

### Firebase設定ファイルの配置

#### iOS

```
expo_app/
└── GoogleService-Info.plist  # プロジェクトルートに配置
```

#### Android

```
expo_app/
└── google-services.json      # プロジェクトルートに配置
```

### Firebase初期化コード

**`expo_app/lib/firebase.ts`**

```typescript
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import Constants from 'expo-constants';

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
};

// Firebase初期化（重複初期化を防ぐ）
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Auth初期化
const auth: Auth = getAuth(app);

// Firestore初期化
const db: Firestore = getFirestore(app);

// 開発環境の場合はエミュレータに接続
if (__DEV__) {
  const EMULATOR_HOST = Constants.expoConfig?.extra?.emulatorHost || 'localhost';

  // Auth エミュレータ
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });

  // Firestore エミュレータ
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);

  console.log('[Firebase] 開発環境: エミュレータに接続しました');
}

export { app, auth, db };
```

### app.jsonの設定

```json
{
  "expo": {
    "extra": {
      "firebaseApiKey": process.env.FIREBASE_API_KEY,
      "firebaseAuthDomain": process.env.FIREBASE_AUTH_DOMAIN,
      "firebaseProjectId": "tokyo-list-478804-e5",
      "firebaseStorageBucket": process.env.FIREBASE_STORAGE_BUCKET,
      "firebaseMessagingSenderId": process.env.FIREBASE_MESSAGING_SENDER_ID,
      "firebaseAppId": process.env.FIREBASE_APP_ID,
      "emulatorHost": process.env.EMULATOR_HOST || "localhost"
    }
  }
}
```

### 環境変数設定例

**`.env.development`**

```bash
# Firebase 開発環境
FIREBASE_API_KEY=your_dev_api_key
FIREBASE_AUTH_DOMAIN=tokyo-list-478804-e5.firebaseapp.com
FIREBASE_PROJECT_ID=tokyo-list-478804-e5
FIREBASE_STORAGE_BUCKET=tokyo-list-478804-e5.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# エミュレータホスト
EMULATOR_HOST=localhost
```

### 接続確認コード

```typescript
import { auth, db } from './lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Firestore接続確認
async function testFirestoreConnection() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    console.log('[Firebase] Firestore接続成功:', snapshot.size, '件');
  } catch (error) {
    console.error('[Firebase] Firestore接続エラー:', error);
  }
}

// Auth接続確認
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('[Firebase] ログイン中:', user.uid);
  } else {
    console.log('[Firebase] 未ログイン');
  }
});
```

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] ✅ 完了

## 完了日

2025-12-10

## 備考

- 既にFirebaseプロジェクト（tokyo-list-478804-e5）は作成済み
- 設定ファイル（GoogleService-Info.plist、google-services.json）は既に配置済み
- エミュレータ接続の動作確認を行うこと
- 本番環境用の`.env.production`は後続チケットで作成

## 実装内容

### 実装したファイル

1. **`expo_app/lib/firebase.ts`**
   - Firebase SDK (firebase/app) を使用した初期化実装
   - Auth と Firestore のインスタンス作成
   - エミュレータ自動接続機能（開発環境のみ）
   - 環境変数から設定を取得する関数群
   - エラーハンドリング実装

2. **`expo_app/lib/firebaseConnectionTest.ts`**
   - Firestore接続テスト関数
   - Auth接続テスト関数
   - 全接続テスト実行関数
   - 簡易接続チェック関数

3. **`expo_app/app.json`**
   - Firebase設定をextraセクションに追加
   - 環境変数からの動的読み込み設定

### 主な機能

- ✅ Firebase SDK初期化（重複初期化の防止）
- ✅ Auth / Firestore インスタンスの管理
- ✅ エミュレータ自動接続（EXPO_PUBLIC_USE_EMULATOR=true時）
- ✅ 環境変数による設定管理
- ✅ エラーハンドリングとログ出力
- ✅ 接続テストユーティリティ

### 使用方法

```typescript
import { initializeFirebase } from './lib/firebase';
import { testAllConnections } from './lib/firebaseConnectionTest';

// アプリ起動時に初期化
await initializeFirebase();

// 接続テスト（開発時のみ）
await testAllConnections();
```

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 実装完了・チケットクローズ |
