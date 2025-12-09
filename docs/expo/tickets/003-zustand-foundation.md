# 003 Zustand状態管理基盤

## 概要

アプリ全体のローカル状態を管理するためのZustandストアを構築するチケットです。認証状態、ユーザー情報、トレーニング状態、設定などを管理するストアを作成します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 002 Expo開発環境セットアップ

## 要件

### 機能要件

- FR-001: ユーザー登録（状態管理）
- FR-002: ユーザーログイン（状態管理）

### 非機能要件

- NFR-038: 状態管理にZustandを使用

## 受け入れ条件（Todo）

- [x] `stores/authStore.ts` が実装されている
- [x] `stores/userStore.ts` が実装されている
- [x] `stores/trainingStore.ts` が実装されている
- [x] `stores/settingsStore.ts` が実装されている
- [x] `stores/index.ts` でストアをエクスポートしている
- [x] TypeScript型定義が完全である
- [x] ストアの永続化設定（AsyncStorage連携）
- [x] DevToolsサポートが有効になっている

## 参照ドキュメント

- `docs/expo/specs/01_技術スタック_v1_0.md` - Zustand使用方法
- Zustand公式ドキュメント: https://zustand-demo.pmnd.rs/

## 技術詳細

### ストア構成

```
expo_app/stores/
├── authStore.ts       # 認証状態管理
├── userStore.ts       # ユーザー情報管理
├── trainingStore.ts   # トレーニング状態管理
├── settingsStore.ts   # 設定管理
└── index.ts           # エクスポート
```

### authStore.ts

**認証状態を管理**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  // 状態
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  isLoading: boolean;

  // アクション
  login: (userId: string, email: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 初期状態
      isAuthenticated: false,
      userId: null,
      email: null,
      isLoading: false,

      // アクション
      login: (userId, email) =>
        set({
          isAuthenticated: true,
          userId,
          email,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          userId: null,
          email: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### userStore.ts

**ユーザー情報を管理**

```typescript
import { create } from 'zustand';

interface UserProfile {
  displayName: string;
  birthdate: string;
  gender: 'male' | 'female' | 'other' | null;
  height: number | null;
  weight: number | null;
  createdAt: string;
}

interface UserState {
  // 状態
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // アクション
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearProfile: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  // 初期状態
  profile: null,
  isLoading: false,
  error: null,

  // アクション
  setProfile: (profile) => set({ profile, error: null }),

  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),

  clearProfile: () => set({ profile: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
```

### trainingStore.ts

**トレーニング状態を管理**

```typescript
import { create } from 'zustand';

interface TrainingSession {
  exerciseType: 'squat' | 'pushup' | 'armcurl' | 'sideraise' | 'shoulderpress';
  targetReps: number;
  currentReps: number;
  score: number;
  startTime: Date | null;
  isActive: boolean;
}

interface TrainingState {
  // 状態
  session: TrainingSession | null;
  history: TrainingSession[];

  // アクション
  startSession: (exerciseType: string, targetReps: number) => void;
  updateSession: (updates: Partial<TrainingSession>) => void;
  endSession: () => void;
  clearHistory: () => void;
}

export const useTrainingStore = create<TrainingState>((set) => ({
  // 初期状態
  session: null,
  history: [],

  // アクション
  startSession: (exerciseType, targetReps) =>
    set({
      session: {
        exerciseType: exerciseType as any,
        targetReps,
        currentReps: 0,
        score: 0,
        startTime: new Date(),
        isActive: true,
      },
    }),

  updateSession: (updates) =>
    set((state) => ({
      session: state.session ? { ...state.session, ...updates } : null,
    })),

  endSession: () =>
    set((state) => ({
      session: null,
      history: state.session ? [...state.history, state.session] : state.history,
    })),

  clearHistory: () => set({ history: [] }),
}));
```

### settingsStore.ts

**アプリ設定を管理**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // 状態
  soundEnabled: boolean;
  voiceFeedbackEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';

  // アクション
  toggleSound: () => void;
  toggleVoiceFeedback: () => void;
  toggleNotifications: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 初期状態
      soundEnabled: true,
      voiceFeedbackEnabled: true,
      notificationsEnabled: true,
      theme: 'auto',

      // アクション
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleVoiceFeedback: () =>
        set((state) => ({ voiceFeedbackEnabled: !state.voiceFeedbackEnabled })),

      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### index.ts

**ストアのエクスポート**

```typescript
export { useAuthStore } from './authStore';
export { useUserStore } from './userStore';
export { useTrainingStore } from './trainingStore';
export { useSettingsStore } from './settingsStore';
```

### 使用例

```typescript
import { useAuthStore, useUserStore } from '@/stores';

function ProfileScreen() {
  // 状態の取得
  const { userId, email } = useAuthStore();
  const { profile, setProfile } = useUserStore();

  // アクションの呼び出し
  const handleUpdateProfile = () => {
    setProfile({
      displayName: '太郎',
      birthdate: '1990-01-01',
      gender: 'male',
      height: 175,
      weight: 70,
      createdAt: new Date().toISOString(),
    });
  };

  return <View>{/* UI */}</View>;
}
```

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月9日

## 備考

- AsyncStorageによる永続化が実装されている
- TypeScript型定義が完全に実装されている
- DevToolsサポートは開発環境でのみ有効
- ストアは機能ごとに分割されている（単一責任の原則）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、完了ステータスに更新 |
