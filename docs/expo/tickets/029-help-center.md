# 029 ヘルプセンター

## 概要

ヘルプセンター機能を実装します。FAQ一覧（アコーディオン形式）、お問い合わせフォーム、フィードバック送信、アプリ使い方ガイド、利用規約・プライバシーポリシーへのリンクを提供します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- expo/027: 設定画面実装（お問い合わせリンクからの遷移）
- common/024: ユーザーフィードバックAPI（バックエンド連携）

## 要件

### 機能要件

- FR-023: チュートリアル（アプリ使い方ガイド）
- FR-030: ヘルプセンター（FAQ一覧、使い方説明）
- FR-031: お問い合わせフォーム（直接質問の送信）

### 非機能要件

- NFR-019: レスポンシブデザイン対応
- NFR-021: 操作性（3タップ以内でヘルプにアクセス）
- NFR-022: エラーメッセージ（平易な言語で表示）

## 受け入れ条件（Todo）

- [x] ヘルプセンター画面が表示される
- [x] FAQ一覧が表示される
  - [x] アコーディオン形式で開閉が動作する
  - [x] カテゴリ別にFAQが分類されている
  - [x] 検索機能が動作する
- [x] お問い合わせ画面が表示される
  - [x] フィードバックタイプの選択が動作する（バグ報告、改善要望、一般、その他）
  - [x] 件名入力が動作する（100文字以内）
  - [x] 本文入力が動作する（1000文字以内）
  - [x] 送信ボタンが動作する
  - [x] 送信成功後に完了メッセージが表示される
  - [x] 1日10回のレート制限が表示される
- [x] アプリ使い方ガイドが表示される
- [x] 利用規約へのリンクが動作する
- [x] プライバシーポリシーへのリンクが動作する
- [x] ダークモード対応

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-023, FR-030, FR-031
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-019, NFR-021, NFR-022
- `docs/common/tickets/024-user-feedback-api.md` - フィードバックAPI仕様
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - 設定画面のお問い合わせ

## 技術詳細

### 画面構成

#### ヘルプセンター画面

```
+-------------------------------+
| [<- 設定]  ヘルプセンター       |
|                               |
|   +-------------------------+ |
|   | [Search] FAQを検索...   | |
|   +-------------------------+ |
|                               |
|  ============================  |
|  よくある質問                  |
|  ============================  |
|                               |
| +---------------------------+ |
| | [v] アカウントについて       | |
| +---------------------------+ |
| | > パスワードを忘れた場合     | |
| | > ログインできない場合       | |
| | > アカウントを削除したい     | |
| +---------------------------+ |
|                               |
| +---------------------------+ |
| | [>] トレーニングについて    | |
| +---------------------------+ |
|                               |
| +---------------------------+ |
| | [>] 課金・サブスクについて   | |
| +---------------------------+ |
|                               |
|  ============================  |
|  その他のサポート              |
|  ============================  |
|                               |
|  [>] アプリの使い方            |
|  [>] お問い合わせ              |
|  [>] 利用規約                  |
|  [>] プライバシーポリシー       |
|                               |
+-------------------------------+
```

#### お問い合わせ画面

```
+-------------------------------+
| [<- ヘルプ]  お問い合わせ       |
|                               |
|  お問い合わせの種類            |
|  ============================  |
|  ( ) バグ報告                  |
|  (*) 機能改善の要望            |
|  ( ) 一般的なフィードバック     |
|  ( ) その他                    |
|  ============================  |
|                               |
|  件名                         |
|   +-------------------------+ |
|   | 件名を入力(100文字以内)  | |
|   +-------------------------+ |
|                               |
|  お問い合わせ内容              |
|   +-------------------------+ |
|   |                         | |
|   | 詳細を入力               | |
|   | (1000文字以内)           | |
|   |                         | |
|   +-------------------------+ |
|   0 / 1000                    |
|                               |
|   +-------------------------+ |
|   |        送信する          | |
|   +-------------------------+ |
|                               |
|  本日の送信回数: 2 / 10回      |
|                               |
+-------------------------------+
```

### 使用ライブラリ

- **React Native Paper**: List, TextInput, RadioButton, Searchbar, Button, Snackbar
- **Expo Router**: 画面遷移
- **@tanstack/react-query**: フィードバック送信
- **expo-device**: デバイス情報取得
- **expo-constants**: アプリバージョン取得

### 主要コンポーネント

#### ファイル配置

```
expo_app/
├── app/
│   └── help/
│       ├── index.tsx           # ヘルプセンター画面
│       ├── contact.tsx         # お問い合わせ画面
│       ├── faq.tsx             # FAQ詳細画面
│       └── guide.tsx           # アプリ使い方ガイド
├── components/
│   └── help/
│       ├── FAQItem.tsx         # FAQアイテムコンポーネント
│       ├── FAQCategory.tsx     # FAQカテゴリコンポーネント
│       └── ContactForm.tsx     # お問い合わせフォーム
├── constants/
│   └── faqData.ts              # FAQデータ定義
└── services/
    └── feedback/
        └── feedbackService.ts  # フィードバックサービス
```

#### FAQデータ定義

```typescript
// constants/faqData.ts
export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQCategory {
  id: string;
  title: string;
  icon: string;
  items: FAQItem[];
}

export const FAQ_DATA: FAQCategory[] = [
  {
    id: 'account',
    title: 'アカウントについて',
    icon: 'account-circle',
    items: [
      {
        id: 'forgot-password',
        question: 'パスワードを忘れた場合はどうすればいいですか？',
        answer: 'ログイン画面の「パスワードをお忘れですか？」をタップしてください。登録したメールアドレスにパスワードリセットのリンクが送信されます。リンクをクリックして新しいパスワードを設定してください。',
      },
      {
        id: 'login-issue',
        question: 'ログインできない場合はどうすればいいですか？',
        answer: 'メールアドレスとパスワードが正しいか確認してください。それでもログインできない場合は、パスワードをリセットするか、お問い合わせフォームからご連絡ください。',
      },
      {
        id: 'delete-account',
        question: 'アカウントを削除したいです',
        answer: '設定画面から「アカウント削除」をタップしてください。削除をリクエストすると、30日間の猶予期間の後にアカウントとすべてのデータが完全に削除されます。猶予期間中はいつでもキャンセルできます。',
      },
      {
        id: 'change-email',
        question: 'メールアドレスを変更したいです',
        answer: 'プロフィール画面からメールアドレスを変更できます。変更後は新しいメールアドレスに確認メールが送信されます。',
      },
    ],
  },
  {
    id: 'training',
    title: 'トレーニングについて',
    icon: 'dumbbell',
    items: [
      {
        id: 'camera-setup',
        question: 'カメラの設置方法を教えてください',
        answer: 'トレーニングを始める前に、カメラ設定画面で全身が映るように調整してください。カメラから1.5〜2.5m離れ、明るい場所で背景がシンプルな環境が推奨されます。種目によって横向き・正面の推奨があるので、画面の指示に従ってください。',
      },
      {
        id: 'voice-feedback',
        question: '音声フィードバックが聞こえません',
        answer: 'デバイスの音量を確認し、マナーモードがオフになっていることを確認してください。設定画面から音声フィードバックがONになっていることも確認してください。',
      },
      {
        id: 'score-calculation',
        question: 'スコアはどのように計算されますか？',
        answer: 'スコアはAIがフォームを分析して算出した参考値です。関節の角度、体の姿勢、動作の滑らかさなどを総合的に評価しています。あくまで参考情報としてご利用ください。',
      },
      {
        id: 'exercise-types',
        question: 'どんな種目ができますか？',
        answer: '現在は5種目に対応しています：スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス。今後も種目を追加していく予定です。',
      },
    ],
  },
  {
    id: 'subscription',
    title: '課金・サブスクリプションについて',
    icon: 'credit-card',
    items: [
      {
        id: 'free-plan',
        question: '無料プランでは何ができますか？',
        answer: '無料プランでは1日3回までトレーニングができます。5種目すべてにアクセスできますが、回数制限があります。',
      },
      {
        id: 'premium-plan',
        question: 'プレミアムプランの特典は何ですか？',
        answer: '月額500円で無制限のトレーニング、広告なし、履歴の無制限保存などの特典があります。最初の1週間は無料でお試しいただけます。',
      },
      {
        id: 'cancel-subscription',
        question: 'サブスクリプションをキャンセルしたいです',
        answer: '設定画面の「サブスクリプション管理」からキャンセルできます。キャンセル後も次回更新日までは引き続きプレミアム機能をご利用いただけます。',
      },
      {
        id: 'payment-method',
        question: 'どのような支払い方法が使えますか？',
        answer: 'クレジットカード（Visa、Mastercard、American Express、JCB）でお支払いいただけます。支払い情報は安全に処理され、アプリには保存されません。',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'プライバシーについて',
    icon: 'shield-lock',
    items: [
      {
        id: 'camera-data',
        question: 'カメラの映像はどうなりますか？',
        answer: 'カメラの映像はデバイス内でのみ処理され、外部に送信されることはありません。プライバシーを最優先に設計しています。',
      },
      {
        id: 'data-download',
        question: '自分のデータをダウンロードできますか？',
        answer: 'はい。プロフィール画面の「データ管理」から、ご自身のトレーニング記録などをダウンロードできます。',
      },
      {
        id: 'data-deletion',
        question: 'データを完全に削除してほしいです',
        answer: 'アカウント削除をリクエストすると、30日後にすべてのデータが完全に削除されます。個別のデータ削除については、お問い合わせフォームからご連絡ください。',
      },
    ],
  },
];
```

#### FAQカテゴリコンポーネント

```typescript
// components/help/FAQCategory.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { FAQCategory as FAQCategoryType, FAQItem as FAQItemType } from '@/constants/faqData';

interface FAQCategoryProps {
  category: FAQCategoryType;
  searchQuery?: string;
}

export function FAQCategory({ category, searchQuery }: FAQCategoryProps) {
  const [expanded, setExpanded] = useState(false);

  // 検索クエリがある場合はフィルタリング
  const filteredItems = searchQuery
    ? category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category.items;

  // 検索結果がない場合は非表示
  if (searchQuery && filteredItems.length === 0) {
    return null;
  }

  // 検索中は自動展開
  const isExpanded = searchQuery ? true : expanded;

  return (
    <List.Accordion
      title={category.title}
      left={(props) => <List.Icon {...props} icon={category.icon} />}
      expanded={isExpanded}
      onPress={() => setExpanded(!expanded)}
      style={styles.accordion}
    >
      {filteredItems.map((item) => (
        <FAQItem key={item.id} item={item} />
      ))}
    </List.Accordion>
  );
}

interface FAQItemProps {
  item: FAQItemType;
}

function FAQItem({ item }: FAQItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <List.Accordion
      title={item.question}
      expanded={expanded}
      onPress={() => setExpanded(!expanded)}
      style={styles.itemAccordion}
      titleNumberOfLines={2}
    >
      <View style={styles.answerContainer}>
        <Text style={styles.answerText}>{item.answer}</Text>
      </View>
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  accordion: {
    backgroundColor: '#fff',
  },
  itemAccordion: {
    backgroundColor: '#f9f9f9',
    paddingLeft: 16,
  },
  answerContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  answerText: {
    lineHeight: 22,
    color: '#666',
  },
});
```

#### ヘルプセンター画面

```typescript
// app/help/index.tsx
import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Searchbar, List, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { FAQ_DATA } from '@/constants/faqData';
import { FAQCategory } from '@/components/help/FAQCategory';

export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  // 検索結果の件数を計算
  const searchResultCount = useMemo(() => {
    if (!searchQuery) return null;

    let count = 0;
    FAQ_DATA.forEach((category) => {
      category.items.forEach((item) => {
        if (
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          count++;
        }
      });
    });
    return count;
  }, [searchQuery]);

  return (
    <ScrollView style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="FAQを検索..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
        {searchQuery && (
          <List.Subheader>
            {searchResultCount}件の結果
          </List.Subheader>
        )}
      </View>

      {/* FAQセクション */}
      <List.Section>
        <List.Subheader>よくある質問</List.Subheader>
        {FAQ_DATA.map((category) => (
          <FAQCategory
            key={category.id}
            category={category}
            searchQuery={searchQuery}
          />
        ))}
      </List.Section>

      <Divider />

      {/* その他のサポート */}
      <List.Section>
        <List.Subheader>その他のサポート</List.Subheader>
        <List.Item
          title="アプリの使い方"
          left={(props) => <List.Icon {...props} icon="book-open-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/help/guide')}
        />
        <List.Item
          title="お問い合わせ"
          left={(props) => <List.Icon {...props} icon="email" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/help/contact')}
        />
        <List.Item
          title="利用規約"
          left={(props) => <List.Icon {...props} icon="file-document" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/legal/terms')}
        />
        <List.Item
          title="プライバシーポリシー"
          left={(props) => <List.Icon {...props} icon="shield-lock" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/legal/privacy')}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
  },
  searchbar: {
    backgroundColor: '#fff',
  },
});
```

#### フィードバックサービス

```typescript
// services/feedback/feedbackService.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type FeedbackType = 'bug_report' | 'feature_request' | 'general_feedback' | 'other';

export interface FeedbackData {
  type: FeedbackType;
  subject: string;
  message: string;
}

export interface SubmitFeedbackResult {
  success: boolean;
  feedbackId?: string;
  message: string;
}

// デバイス情報を取得
function getDeviceInfo() {
  return {
    platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: Platform.Version.toString(),
    appVersion: Constants.expoConfig?.version || '1.0.0',
    deviceModel: Device.modelName,
  };
}

// フィードバックを送信
export async function submitFeedback(data: FeedbackData): Promise<SubmitFeedbackResult> {
  const submitFeedbackFn = httpsCallable(functions, 'feedback_submitFeedback');

  const result = await submitFeedbackFn({
    type: data.type,
    subject: data.subject,
    message: data.message,
    deviceInfo: getDeviceInfo(),
  });

  const response = result.data as any;

  return {
    success: response.success,
    feedbackId: response.data?.feedbackId,
    message: response.message,
  };
}
```

#### お問い合わせ画面

```typescript
// app/help/contact.tsx
import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  TextInput,
  RadioButton,
  Button,
  Text,
  HelperText,
} from 'react-native-paper';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { submitFeedback, FeedbackType } from '@/services/feedback/feedbackService';

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug_report', label: 'バグ報告' },
  { value: 'feature_request', label: '機能改善の要望' },
  { value: 'general_feedback', label: '一般的なフィードバック' },
  { value: 'other', label: 'その他' },
];

const MAX_SUBJECT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 1000;

export default function ContactScreen() {
  const [type, setType] = useState<FeedbackType>('general_feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: (result) => {
      if (result.success) {
        Alert.alert(
          '送信完了',
          'お問い合わせを受け付けました。ご協力ありがとうございます。',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    },
    onError: (error: any) => {
      const message = error.message || '送信に失敗しました';

      // レート制限エラーの場合
      if (error.code === 'resource-exhausted') {
        Alert.alert('送信制限', '1日の送信上限（10回）に達しました。明日以降に再度お試しください。');
      } else {
        Alert.alert('エラー', message);
      }
    },
  });

  const isSubjectValid = subject.length > 0 && subject.length <= MAX_SUBJECT_LENGTH;
  const isMessageValid = message.length > 0 && message.length <= MAX_MESSAGE_LENGTH;
  const canSubmit = isSubjectValid && isMessageValid && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    mutation.mutate({
      type,
      subject,
      message,
    });
  }, [type, subject, message, canSubmit]);

  return (
    <ScrollView style={styles.container}>
      {/* フィードバックタイプ選択 */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          お問い合わせの種類
        </Text>
        <RadioButton.Group
          onValueChange={(value) => setType(value as FeedbackType)}
          value={type}
        >
          {FEEDBACK_TYPES.map((item) => (
            <RadioButton.Item
              key={item.value}
              label={item.label}
              value={item.value}
            />
          ))}
        </RadioButton.Group>
      </View>

      {/* 件名入力 */}
      <View style={styles.section}>
        <TextInput
          label="件名"
          value={subject}
          onChangeText={setSubject}
          mode="outlined"
          maxLength={MAX_SUBJECT_LENGTH}
          error={subject.length > MAX_SUBJECT_LENGTH}
        />
        <HelperText type={subject.length > MAX_SUBJECT_LENGTH ? 'error' : 'info'}>
          {subject.length} / {MAX_SUBJECT_LENGTH}文字
        </HelperText>
      </View>

      {/* 本文入力 */}
      <View style={styles.section}>
        <TextInput
          label="お問い合わせ内容"
          value={message}
          onChangeText={setMessage}
          mode="outlined"
          multiline
          numberOfLines={8}
          maxLength={MAX_MESSAGE_LENGTH}
          error={message.length > MAX_MESSAGE_LENGTH}
          style={styles.messageInput}
        />
        <HelperText type={message.length > MAX_MESSAGE_LENGTH ? 'error' : 'info'}>
          {message.length} / {MAX_MESSAGE_LENGTH}文字
        </HelperText>
      </View>

      {/* 送信ボタン */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={mutation.isPending}
          disabled={!canSubmit}
          style={styles.submitButton}
        >
          送信する
        </Button>
      </View>

      {/* 送信回数の表示 */}
      <Text style={styles.rateLimit}>
        1日10回まで送信できます
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  messageInput: {
    minHeight: 150,
  },
  buttonContainer: {
    padding: 16,
  },
  submitButton: {
    paddingVertical: 8,
  },
  rateLimit: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginBottom: 32,
  },
});
```

#### アプリ使い方ガイド画面

```typescript
// app/help/guide.tsx
import React from 'react';
import { ScrollView, StyleSheet, Image } from 'react-native';
import { List, Text, Card } from 'react-native-paper';

const GUIDE_SECTIONS = [
  {
    id: 'getting-started',
    title: 'はじめに',
    content: 'このアプリは、AIを活用してトレーニングフォームの確認を補助するアプリです。カメラで撮影しながら、リアルタイムでフォームのフィードバックを受けることができます。',
  },
  {
    id: 'camera-setup',
    title: 'カメラの設置',
    steps: [
      'スマートフォンを安定した場所に置きます',
      'カメラから1.5〜2.5m離れた位置に立ちます',
      '全身が画面に映るように調整します',
      '種目によって横向き・正面の推奨があります',
    ],
  },
  {
    id: 'training-flow',
    title: 'トレーニングの流れ',
    steps: [
      'ホーム画面から「トレーニング開始」をタップ',
      'トレーニング種目を選択',
      'カメラを設置してチェック項目を確認',
      'トレーニング開始（カウントダウン後）',
      'フォームを確認しながらトレーニング',
      '終了後に結果とフィードバックを確認',
    ],
  },
  {
    id: 'exercises',
    title: '対応種目',
    content: '現在、以下の5種目に対応しています：',
    list: [
      'スクワット - 下半身を鍛える基本種目（横向き推奨）',
      'プッシュアップ - 胸と腕を鍛える自重種目（横向き推奨）',
      'アームカール - 腕を鍛えるダンベル種目（正面推奨）',
      'サイドレイズ - 肩を鍛えるダンベル種目（正面推奨）',
      'ショルダープレス - 肩と腕を鍛えるダンベル種目（正面推奨）',
    ],
  },
  {
    id: 'tips',
    title: 'より良い結果のために',
    list: [
      '明るい場所でトレーニングしましょう',
      '背景はできるだけシンプルに',
      '動きやすい服装で',
      '音声フィードバックを活用しましょう',
      'スコアは参考値として捉えてください',
    ],
  },
  {
    id: 'disclaimer',
    title: '重要なお知らせ',
    content: 'このアプリは医療機器ではありません。フォーム確認の参考情報として提供しています。実際のトレーニングは、ご自身の体調や能力に合わせて行ってください。痛みや不調を感じた場合は、すぐにトレーニングを中止し、医療専門家にご相談ください。',
  },
];

export default function GuideScreen() {
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            アプリの使い方
          </Text>
          <Text variant="bodyMedium" style={styles.headerDescription}>
            このガイドでは、アプリの基本的な使い方を説明します。
          </Text>
        </Card.Content>
      </Card>

      {GUIDE_SECTIONS.map((section) => (
        <Card key={section.id} style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {section.title}
            </Text>

            {section.content && (
              <Text variant="bodyMedium" style={styles.sectionContent}>
                {section.content}
              </Text>
            )}

            {section.steps && (
              <List.Section>
                {section.steps.map((step, index) => (
                  <List.Item
                    key={index}
                    title={step}
                    left={() => (
                      <Text style={styles.stepNumber}>{index + 1}.</Text>
                    )}
                    titleNumberOfLines={3}
                    style={styles.stepItem}
                  />
                ))}
              </List.Section>
            )}

            {section.list && (
              <List.Section>
                {section.list.map((item, index) => (
                  <List.Item
                    key={index}
                    title={item}
                    left={(props) => <List.Icon {...props} icon="check" />}
                    titleNumberOfLines={3}
                    style={styles.listItem}
                  />
                ))}
              </List.Section>
            )}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    backgroundColor: '#4CAF50',
  },
  headerTitle: {
    color: '#fff',
    marginBottom: 8,
  },
  headerDescription: {
    color: '#fff',
    opacity: 0.9,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionContent: {
    lineHeight: 22,
    color: '#666',
  },
  stepNumber: {
    width: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
  },
  stepItem: {
    paddingVertical: 4,
  },
  listItem: {
    paddingVertical: 4,
  },
});
```

## テスト項目

### 単体テスト（Jest）

- [ ] FAQデータの構造が正しい
- [ ] FAQCategoryコンポーネントが正しくレンダリングされる
- [ ] FAQItemコンポーネントの開閉が動作する
- [ ] 検索フィルタリングが正しく動作する
- [ ] フィードバックバリデーションが正しい

### 統合テスト

- [ ] ヘルプセンター画面が正しく表示される
- [ ] FAQ検索が動作する
- [ ] お問い合わせフォームの送信が動作する
- [ ] エラーハンドリングが正しく動作する

### 実機テスト

- [ ] iPhone（iOS）で正しく表示される
- [ ] Android端末で正しく表示される
- [ ] ダークモードで正しく表示される
- [ ] FAQのアコーディオンがスムーズに動作する
- [ ] お問い合わせ送信が完了する

## 見積もり

- 工数: 3日
- 難易度: 中（複数画面、アコーディオンUI、フォームバリデーション）

## 進捗

- [x] 実装完了（2025-12-11）

## 完了日

2025-12-11



## 備考

- expo/027（設定画面）の「お問い合わせ」リンクから遷移
- common/024（ユーザーフィードバックAPI）と連携してフィードバックを送信
- FAQデータは静的に定義（将来的にはFirestoreから取得に変更可能）
- 検索機能は質問と回答の両方を対象
- 1日10回のフィードバック送信制限はAPI側で制御
- 利用規約・プライバシーポリシーはWebViewまたはモーダルで表示（別チケットで実装）

## 実装済みファイル一覧

- `expo_app/app/help/index.tsx` - ヘルプセンター画面
- `expo_app/app/help/contact.tsx` - お問い合わせ画面
- `expo_app/app/help/faq.tsx` - FAQ画面
- `expo_app/app/help/guide.tsx` - アプリ使い方ガイド画面
- `expo_app/app/help/_layout.tsx` - ヘルプ関連画面レイアウト
- `expo_app/components/help/FAQItem.tsx` - FAQアイテム（アコーディオン）
- `expo_app/constants/faqData.ts` - FAQデータ定義
- `expo_app/services/help/feedbackService.ts` - フィードバック送信サービス

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-11 | 初版作成 |
| 2025-12-11 | コード実装完了（ヘルプセンター、FAQ、お問い合わせ、ガイド画面、feedbackService） |
