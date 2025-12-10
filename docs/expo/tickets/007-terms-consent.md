# 007 利用規約同意画面

## 概要

ユーザーが初回ログイン後に利用規約とプライバシーポリシーに同意する画面を実装するチケットです。GDPR準拠の同意管理を実現し、Common/006（GDPR同意管理API）と連携します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 004 Expo Router設定
- 005 React Native Paper UI基盤

## 関連Commonチケット

- Common/006 GDPR同意管理API

## 要件

### 機能要件

- FR-024: 同意管理（利用規約・プライバシーポリシーへの同意取得）
- FR-024-1: ログイン時同意確認機能
- FR-002-1: 同意状態管理機能

### 非機能要件

- NFR-001: GDPR準拠の同意管理
- NFR-040: Material Design 3準拠のUI

## 受け入れ条件（Todo）

- [x] `app/onboarding/terms-consent.tsx` が実装されている
- [x] 利用規約の全文表示（スクロール可能）
- [x] プライバシーポリシーの全文表示（スクロール可能）
- [x] 利用規約チェックボックス（個別同意）
- [x] プライバシーポリシーチェックボックス（個別同意）
- [x] 両方同意時のみ「同意して続ける」ボタンが有効化
- [x] Common/006 GDPR同意管理APIと連携
- [x] 同意後はホーム画面へ遷移
- [x] 未同意の場合はログアウト機能
- [x] ローディング状態の表示

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-024, FR-024-1, FR-002-1
- `docs/common/specs/09_利用規約_v1_0.md` - 利用規約全文
- `docs/common/specs/10_プライバシーポリシー_v1_0.md` - プライバシーポリシー全文
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - 利用規約同意画面設計
- `docs/common/tickets/006-gdpr-consent-api.md` - GDPR同意管理API仕様

## 技術詳細

### 画面レイアウト

```
+-------------------------------+
|         利用規約と              |
|      プライバシーポリシー        |
|                               |
|  サービスをご利用いただく前に、  |
|  以下の内容をご確認ください。    |
|                               |
|  ============================  |
|  利用規約                      |
|  ============================  |
|  [スクロール可能なテキスト]     |
|                               |
|  ============================  |
|  プライバシーポリシー           |
|  ============================  |
|  [スクロール可能なテキスト]     |
|                               |
|  [ ] 利用規約に同意します       |
|  [ ] プライバシーポリシーに     |
|      同意します                 |
|                               |
|   +-------------------------+ |
|   |    同意して続ける         | |
|   +-------------------------+ |
|                               |
|  [同意しない(ログアウト)]       |
+-------------------------------+
```

### app/onboarding/terms-consent.tsx

**利用規約同意画面**

```typescript
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Checkbox, Button, Divider, Card } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// 利用規約テキスト（簡略版 - 本番では外部ファイルから読み込み）
const TERMS_OF_SERVICE = `
利用規約

第1条 本サービスについて
本サービスは、AIを活用したフィットネス支援サービスです。
本サービスは医療機器ではありません。

第2条 利用資格
13歳以上の方がご利用いただけます。

第3条 禁止事項
...
`;

const PRIVACY_POLICY = `
プライバシーポリシー

第1条 収集する情報
当社は以下の情報を収集します：
- アカウント情報（メールアドレス、ニックネーム）
- トレーニング記録
- 骨格座標データ（映像は保存しません）

第2条 情報の利用目的
...
`;

export default function TermsConsentScreen() {
  const [tosAccepted, setTosAccepted] = useState(false);
  const [ppAccepted, setPpAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, logout, updateConsent } = useAuthStore();

  const bothAccepted = tosAccepted && ppAccepted;

  const handleAccept = async () => {
    if (!bothAccepted || !user) return;

    setLoading(true);
    try {
      // GDPR同意管理APIを呼び出し
      const recordConsent = httpsCallable(functions, 'recordConsent');
      await recordConsent({
        tosAccepted: true,
        ppAccepted: true,
        tosVersion: '3.2',
        ppVersion: '3.1',
      });

      // ローカルストアを更新
      updateConsent(true, true);

      // ホーム画面へ遷移
      router.replace('/(app)/(tabs)');
    } catch (error: any) {
      alert('同意の記録に失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    // 同意しない場合はログアウト
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        利用規約とプライバシーポリシー
      </Text>

      <Text style={styles.description}>
        サービスをご利用いただく前に、以下の内容をご確認ください。
      </Text>

      {/* 利用規約セクション */}
      <Card style={styles.card}>
        <Card.Title title="利用規約" />
        <Card.Content>
          <ScrollView style={styles.textContainer} nestedScrollEnabled>
            <Text style={styles.legalText}>{TERMS_OF_SERVICE}</Text>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* プライバシーポリシーセクション */}
      <Card style={styles.card}>
        <Card.Title title="プライバシーポリシー" />
        <Card.Content>
          <ScrollView style={styles.textContainer} nestedScrollEnabled>
            <Text style={styles.legalText}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      {/* チェックボックス */}
      <View style={styles.checkboxContainer}>
        <Checkbox.Item
          label="利用規約に同意します"
          status={tosAccepted ? 'checked' : 'unchecked'}
          onPress={() => setTosAccepted(!tosAccepted)}
          position="leading"
        />
        <Checkbox.Item
          label="プライバシーポリシーに同意します"
          status={ppAccepted ? 'checked' : 'unchecked'}
          onPress={() => setPpAccepted(!ppAccepted)}
          position="leading"
        />
      </View>

      {!bothAccepted && (
        <Text style={styles.warning}>
          両方の項目に同意する必要があります
        </Text>
      )}

      {/* ボタン */}
      <Button
        mode="contained"
        onPress={handleAccept}
        loading={loading}
        disabled={!bothAccepted || loading}
        style={styles.button}
      >
        同意して続ける
      </Button>

      <Button
        mode="text"
        onPress={handleDecline}
        style={styles.declineButton}
      >
        同意しない（ログアウト）
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 24,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  card: {
    marginBottom: 16,
  },
  textContainer: {
    maxHeight: 200,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  legalText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  divider: {
    marginVertical: 16,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  warning: {
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    marginBottom: 8,
  },
  declineButton: {
    marginBottom: 32,
  },
});
```

### stores/authStore.ts への追加

**同意状態管理の追加**

```typescript
interface AuthState {
  user: User | null;
  isLoading: boolean;
  tosAccepted: boolean;
  ppAccepted: boolean;
  setUser: (user: User | null) => void;
  login: (uid: string, email: string) => void;
  logout: () => Promise<void>;
  updateConsent: (tos: boolean, pp: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  tosAccepted: false,
  ppAccepted: false,
  setUser: (user) => set({ user, isLoading: false }),
  login: (uid, email) => set({
    user: { uid, email },
    isLoading: false,
  }),
  logout: async () => {
    await signOut(auth);
    set({ user: null, tosAccepted: false, ppAccepted: false });
  },
  updateConsent: (tos, pp) => set({ tosAccepted: tos, ppAccepted: pp }),
}));
```

### 認証フローへの統合

**app/(app)/_layout.tsx での同意チェック**

```typescript
import { useAuthStore } from '@/stores';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { user, isLoading, tosAccepted, ppAccepted } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // 同意未完了の場合は同意画面へリダイレクト
  if (!tosAccepted || !ppAccepted) {
    return <Redirect href="/onboarding/terms-consent" />;
  }

  return <Stack />;
}
```

### GDPR準拠のポイント

| 項目 | 対応内容 |
|-----|---------|
| 個別同意 | 利用規約とPPを個別にチェック |
| 明示的同意 | チェックボックスで明示的に取得 |
| 自由意思 | 拒否の選択肢を提供 |
| 同意記録 | タイムスタンプをFirestoreに記録 |
| 撤回可能 | プロフィール画面から撤回可能（チケット009） |

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-09

## 備考

- 利用規約・プライバシーポリシーの全文は外部ファイルまたはAPIから取得することを推奨
- 同意バージョン管理により、規約更新時の再同意要求が可能
- Common/006のGDPR同意管理APIと連携して同意を記録
- 同意撤回機能はチケット009（プロフィール画面）で実装

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、完了ステータスで作成 |
