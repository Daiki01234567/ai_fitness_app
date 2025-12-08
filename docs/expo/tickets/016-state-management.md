# 016 状態管理基盤（Zustand）

## 概要

アプリ全体で使用する状態管理の基盤をZustandで構築します。認証状態、ユーザー情報、アプリ設定などのグローバルな状態を管理するストアを実装します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- 002: Firebase基盤構築

## 要件

### 必要なストア

#### 1. 認証ストア（authStore）

認証状態とFirebase Authユーザーを管理:

```typescript
interface AuthState {
  user: FirebaseUser | null;      // Firebase Authユーザー
  userData: UserData | null;       // Firestoreのユーザーデータ
  isLoading: boolean;              // 認証状態の読み込み中
  isAuthenticated: boolean;        // 認証済みかどうか

  // アクション
  setUser: (user: FirebaseUser | null) => void;
  setUserData: (data: UserData | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}
```

#### 2. ユーザー設定ストア（settingsStore）

ユーザーのアプリ設定を管理:

```typescript
interface SettingsState {
  audioFeedback: boolean;          // 音声フィードバックON/OFF
  reminderNotification: boolean;   // リマインダー通知ON/OFF
  newsNotification: boolean;       // お知らせ通知ON/OFF

  // アクション
  setAudioFeedback: (enabled: boolean) => void;
  setReminderNotification: (enabled: boolean) => void;
  setNewsNotification: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}
```

#### 3. UIストア（uiStore）

一時的なUI状態を管理:

```typescript
interface UIState {
  isGlobalLoading: boolean;        // グローバルローディング
  toastMessage: string | null;     // トーストメッセージ
  toastType: 'success' | 'error' | 'info' | null;

  // アクション
  setGlobalLoading: (loading: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}
```

### 永続化

- 認証状態: Firebase Authが自動管理
- ユーザー設定: AsyncStorageで永続化
- UI状態: 永続化不要

### Firebase Auth連携

- `onAuthStateChanged`でFirebase Authの状態変更を監視
- 認証状態変更時に`authStore`を更新
- ログイン時にFirestoreからユーザーデータを取得

## 受け入れ条件

- [ ] 認証ストアが実装されている
- [ ] ユーザー設定ストアが実装されている
- [ ] UIストアが実装されている
- [ ] Firebase Authの状態変更が認証ストアに反映される
- [ ] ログイン時にFirestoreからユーザーデータが取得される
- [ ] ログアウト時にストアがリセットされる
- [ ] ユーザー設定がAsyncStorageに永続化される
- [ ] アプリ起動時に永続化された設定が復元される
- [ ] トースト通知が表示できる
- [ ] グローバルローディングが表示できる

## 参照ドキュメント

- [要件定義書 Part 3](../specs/03_要件定義書_Expo版_v1_Part3.md) - システムアーキテクチャ
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - セクション6.3

## 技術詳細

### 必要なライブラリ

- `zustand`: 状態管理
- `zustand/middleware`: persist ミドルウェア
- `@react-native-async-storage/async-storage`: 永続化

### ディレクトリ構造

```
stores/
├── index.ts           # ストアのエクスポート
├── authStore.ts       # 認証ストア
├── settingsStore.ts   # 設定ストア
└── uiStore.ts         # UIストア
```

### 認証ストアの実装例

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthState {
  user: FirebaseUser | null;
  userData: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setUserData: (data: UserData | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userData: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({
    user,
    isAuthenticated: !!user
  }),

  setUserData: (userData) => set({ userData }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    await signOut(auth);
    set({
      user: null,
      userData: null,
      isAuthenticated: false
    });
  },

  refreshUserData: async () => {
    const { user } = get();
    if (!user) return;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      set({ userData: userDoc.data() as UserData });
    }
  },
}));

// Firebase Auth リスナーの初期化
export const initAuthListener = () => {
  onAuthStateChanged(auth, async (firebaseUser) => {
    const store = useAuthStore.getState();

    if (firebaseUser) {
      store.setUser(firebaseUser);
      await store.refreshUserData();
    } else {
      store.setUser(null);
      store.setUserData(null);
    }

    store.setLoading(false);
  });
};
```

### 設定ストアの永続化

```typescript
// stores/settingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  audioFeedback: boolean;
  reminderNotification: boolean;
  newsNotification: boolean;
  setAudioFeedback: (enabled: boolean) => void;
  setReminderNotification: (enabled: boolean) => void;
  setNewsNotification: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      audioFeedback: true,
      reminderNotification: false,
      newsNotification: true,

      setAudioFeedback: (audioFeedback) => set({ audioFeedback }),
      setReminderNotification: (reminderNotification) => set({ reminderNotification }),
      setNewsNotification: (newsNotification) => set({ newsNotification }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### アプリエントリーポイントでの初期化

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { initAuthListener } from '@/stores/authStore';

export default function RootLayout() {
  useEffect(() => {
    initAuthListener();
  }, []);

  // ...
}
```

## 注意事項

- Zustandはシンプルな状態管理に適しているため、複雑なロジックはストア外で処理
- サーバー状態（Firestoreデータ）はTanStack Queryで管理（016とは別に実装）
- 認証リスナーはアプリ起動時に1回だけ初期化すること
- AsyncStorageは非同期なので、初期値の復元が完了するまでローディング表示

## 見積もり

- 想定工数: 1〜2日

## 進捗

- [ ] 未着手
