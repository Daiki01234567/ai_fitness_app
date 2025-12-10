# 009 プロフィール画面

## 概要

ユーザープロフィール情報の表示・編集、同意状況の確認、データ管理機能を提供する画面を実装するチケットです。Common/007（ユーザーAPI）と連携し、GDPR準拠のデータ管理機能を含みます。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 005 React Native Paper UI基盤
- 010 ボトムナビゲーション

## 関連Commonチケット

- Common/007 ユーザーAPI

## 要件

### 機能要件

- FR-004: プロフィール管理（表示・編集）
- FR-024: 同意管理（利用規約・プライバシーポリシーへの同意状況表示）
- FR-005: データエクスポート機能（Phase 2で実装）
- FR-006: アカウント削除機能

### 非機能要件

- NFR-001: GDPR準拠のデータ管理
- NFR-040: Material Design 3準拠のUI

## 受け入れ条件（Todo）

- [x] `app/(app)/(tabs)/settings.tsx` が実装されている
- [x] プロフィール情報の表示（ニックネーム、メールアドレス）
- [x] 統計情報の表示（総セッション数、総トレーニング時間、平均スコア）
- [x] 同意状況の表示（利用規約、プライバシーポリシー）
- [x] トレーニング設定（音声フィードバックON/OFF）
- [x] 通知設定（リマインダー、お知らせ）
- [x] データ管理セクション（エクスポート、削除ボタン）
- [x] サポートセクション（ヘルプ、利用規約、PP、お問い合わせ）
- [x] ログアウト機能（確認ダイアログ付き）
- [x] アカウント削除機能（確認ダイアログ付き）
- [x] ローディング状態の表示

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-004, FR-005, FR-006, FR-024
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - プロフィール画面設計
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件
- `docs/common/tickets/007-user-api.md` - ユーザーAPI仕様

## 技術詳細

### 画面レイアウト

```
+-------------------------------+
|         設定                   |
|                               |
|  +-------------------------+  |
|  |  [Avatar]               |  |
|  |  ユーザー名              |  |
|  |  email@example.com      |  |
|  +-------------------------+  |
|                               |
|  トレーニング統計              |
|  +-------------------------+  |
|  | セッション数    | 42回    | |
|  | 総時間         | 12.5時間 | |
|  | 平均スコア     | 85点    | |
|  +-------------------------+  |
|                               |
|  同意状況                      |
|  +-------------------------+  |
|  | 利用規約       | 同意済  | |
|  | PP            | 同意済  | |
|  +-------------------------+  |
|                               |
|  トレーニング設定              |
|  +-------------------------+  |
|  | 音声フィードバック  [ON] | |
|  +-------------------------+  |
|                               |
|  通知設定                      |
|  +-------------------------+  |
|  | リマインダー       [ON]  | |
|  | お知らせ          [ON]  | |
|  +-------------------------+  |
|                               |
|  データ管理                    |
|  +-------------------------+  |
|  | データエクスポート   >   | |
|  | データ削除          >   | |
|  +-------------------------+  |
|                               |
|  サポート                      |
|  +-------------------------+  |
|  | ヘルプ              >   | |
|  | 利用規約            >   | |
|  | プライバシーポリシー  >   | |
|  | お問い合わせ         >   | |
|  +-------------------------+  |
|                               |
|  [ログアウト]                  |
|  [アカウント削除]              |
+-------------------------------+
```

### app/(app)/(tabs)/settings.tsx

**プロフィール・設定画面**

```typescript
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Surface,
  Avatar,
  List,
  Switch,
  Divider,
  Button,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { useSettingsStore } from '@/stores/settingsStore';
import { signOut, deleteAccount } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 統計情報取得
const fetchUserStats = async (userId: string) => {
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const snapshot = await getDocs(sessionsRef);

  let totalSessions = 0;
  let totalDuration = 0;
  let totalScore = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    totalSessions++;
    totalDuration += data.duration || 0;
    totalScore += data.score || 0;
  });

  return {
    totalSessions,
    totalDuration: Math.round(totalDuration / 60), // 分から時間へ
    averageScore: totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0,
  };
};

export default function SettingsScreen() {
  const { user, tosAccepted, ppAccepted, clearAuth } = useAuthStore();
  const {
    audioFeedback,
    reminderNotification,
    newsNotification,
    setAudioFeedback,
    setReminderNotification,
    setNewsNotification,
  } = useSettingsStore();

  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 統計情報取得
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['userStats', user?.uid],
    queryFn: () => fetchUserStats(user!.uid),
    enabled: !!user?.uid,
  });

  const handleLogout = async () => {
    setLogoutDialogVisible(false);
    try {
      await signOut();
      clearAuth();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('エラー', 'ログアウトに失敗しました。');
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteDialogVisible(false);
    setIsDeleting(true);

    try {
      await deleteAccount();
      clearAuth();
      Alert.alert(
        'アカウント削除完了',
        'アカウントの削除をスケジュールしました。30日以内にログインすると削除をキャンセルできます。',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error) {
      setIsDeleting(false);
      Alert.alert('エラー', 'アカウント削除に失敗しました。');
    }
  };

  const handleDataExport = () => {
    // Phase 2で実装
    Alert.alert('準備中', 'データエクスポート機能は準備中です。');
  };

  const handleDataDelete = () => {
    // Phase 2で実装
    Alert.alert('準備中', 'データ削除機能は準備中です。');
  };

  if (isDeleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>アカウントを削除中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* プロフィールセクション */}
      <Surface style={styles.profileSection} elevation={1}>
        <Avatar.Text
          size={64}
          label={user?.email?.charAt(0).toUpperCase() || 'U'}
          style={styles.avatar}
        />
        <Text variant="titleMedium" style={styles.userName}>
          {user?.displayName || 'ユーザー'}
        </Text>
        <Text variant="bodyMedium" style={styles.userEmail}>
          {user?.email}
        </Text>
      </Surface>

      {/* 統計情報セクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          トレーニング統計
        </Text>
        {statsLoading ? (
          <ActivityIndicator size="small" />
        ) : (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall">{stats?.totalSessions || 0}</Text>
              <Text variant="bodySmall">セッション数</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall">{stats?.totalDuration || 0}h</Text>
              <Text variant="bodySmall">総時間</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall">{stats?.averageScore || 0}</Text>
              <Text variant="bodySmall">平均スコア</Text>
            </View>
          </View>
        )}
      </Surface>

      {/* 同意状況セクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          同意状況
        </Text>
        <List.Item
          title="利用規約"
          right={() => (
            <Text style={tosAccepted ? styles.statusOk : styles.statusNg}>
              {tosAccepted ? '同意済' : '未同意'}
            </Text>
          )}
        />
        <Divider />
        <List.Item
          title="プライバシーポリシー"
          right={() => (
            <Text style={ppAccepted ? styles.statusOk : styles.statusNg}>
              {ppAccepted ? '同意済' : '未同意'}
            </Text>
          )}
        />
      </Surface>

      {/* トレーニング設定セクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          トレーニング設定
        </Text>
        <List.Item
          title="音声フィードバック"
          description="トレーニング中に音声でフィードバック"
          right={() => (
            <Switch
              value={audioFeedback}
              onValueChange={setAudioFeedback}
            />
          )}
        />
      </Surface>

      {/* 通知設定セクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          通知設定
        </Text>
        <List.Item
          title="リマインダー通知"
          description="トレーニングのリマインダー"
          right={() => (
            <Switch
              value={reminderNotification}
              onValueChange={setReminderNotification}
            />
          )}
        />
        <Divider />
        <List.Item
          title="お知らせ通知"
          description="アプリからのお知らせ"
          right={() => (
            <Switch
              value={newsNotification}
              onValueChange={setNewsNotification}
            />
          )}
        />
      </Surface>

      {/* データ管理セクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          データ管理
        </Text>
        <List.Item
          title="データエクスポート"
          description="トレーニングデータをエクスポート"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleDataExport}
        />
        <Divider />
        <List.Item
          title="データ削除"
          description="トレーニングデータを削除"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleDataDelete}
        />
      </Surface>

      {/* サポートセクション */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          サポート
        </Text>
        <List.Item
          title="ヘルプ"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => Alert.alert('準備中', 'ヘルプは準備中です。')}
        />
        <Divider />
        <List.Item
          title="利用規約"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/legal/terms')}
        />
        <Divider />
        <List.Item
          title="プライバシーポリシー"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/legal/privacy')}
        />
        <Divider />
        <List.Item
          title="お問い合わせ"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => Alert.alert('準備中', 'お問い合わせは準備中です。')}
        />
      </Surface>

      {/* アクションボタン */}
      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={() => setLogoutDialogVisible(true)}
          style={styles.logoutButton}
        >
          ログアウト
        </Button>

        <Button
          mode="text"
          textColor="#F44336"
          onPress={() => setDeleteDialogVisible(true)}
          style={styles.deleteButton}
        >
          アカウント削除
        </Button>
      </View>

      {/* ログアウト確認ダイアログ */}
      <Portal>
        <Dialog
          visible={logoutDialogVisible}
          onDismiss={() => setLogoutDialogVisible(false)}
        >
          <Dialog.Title>ログアウト</Dialog.Title>
          <Dialog.Content>
            <Text>ログアウトしますか？</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>
              キャンセル
            </Button>
            <Button onPress={handleLogout}>ログアウト</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* アカウント削除確認ダイアログ */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>アカウント削除</Dialog.Title>
          <Dialog.Content>
            <Text>
              アカウントを削除すると、30日後に全てのデータが完全に削除されます。
              {'\n\n'}
              30日以内にログインすると削除をキャンセルできます。
              {'\n\n'}
              本当に削除しますか？
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              キャンセル
            </Button>
            <Button textColor="#F44336" onPress={handleDeleteAccount}>
              削除する
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  profileSection: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#4CAF50',
  },
  userName: {
    marginTop: 12,
    fontWeight: '600',
  },
  userEmail: {
    marginTop: 4,
    color: '#666',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    padding: 16,
    paddingBottom: 8,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statusOk: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  statusNg: {
    color: '#F44336',
    fontWeight: '500',
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    marginBottom: 12,
  },
  deleteButton: {
    marginBottom: 16,
  },
});
```

### stores/settingsStore.ts

**設定ストア**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // トレーニング設定
  audioFeedback: boolean;

  // 通知設定
  reminderNotification: boolean;
  newsNotification: boolean;

  // アクション
  setAudioFeedback: (enabled: boolean) => void;
  setReminderNotification: (enabled: boolean) => void;
  setNewsNotification: (enabled: boolean) => void;
  resetSettings: () => void;
}

const initialState = {
  audioFeedback: true,
  reminderNotification: true,
  newsNotification: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setAudioFeedback: (enabled) => set({ audioFeedback: enabled }),
      setReminderNotification: (enabled) => set({ reminderNotification: enabled }),
      setNewsNotification: (enabled) => set({ newsNotification: enabled }),

      resetSettings: () => set(initialState),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### lib/auth.ts への追加

**アカウント削除関数**

```typescript
import { deleteUser, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const deleteAccount = async (): Promise<void> => {
  // GDPR準拠のため、Cloud Functionsを経由して削除スケジュール
  const scheduleAccountDeletion = httpsCallable(functions, 'scheduleAccountDeletion');
  await scheduleAccountDeletion();
};
```

### GDPR準拠のポイント

| 項目 | 対応内容 |
|-----|---------|
| 同意状況表示 | 利用規約・PPの同意状況を明示 |
| データエクスポート | ユーザーデータのエクスポート機能（Phase 2） |
| データ削除 | 30日猶予期間付きの削除機能 |
| 撤回可能 | 削除スケジュールのキャンセル機能 |

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 備考

- プロフィール編集機能はPhase 2で実装予定
- データエクスポート・削除機能はPhase 2で実装予定
- サブスクリプション管理セクションはPhase 3で追加予定
- Common/007のユーザーAPIと連携して統計情報を取得
- アカウント削除は30日間の猶予期間あり（GDPR準拠）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、標準フォーマットで再作成 |
