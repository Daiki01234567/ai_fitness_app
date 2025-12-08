# 009 オンボーディング画面実装

## 概要

初回起動時に表示されるオンボーディング画面を実装します。3画面構成でアプリの特徴を紹介し、薬機法対応として「医療機器ではない」旨を明示します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [007 基本UIコンポーネント作成](./007-base-ui-components.md)
- [008 スプラッシュ画面実装](./008-splash-screen.md)

## 要件

### 画面構成

| ページ | タイトル | 内容 |
|--------|---------|------|
| 1/3 | 医療機器ではありません | 参考情報としての利用を明示（薬機法対応） |
| 2/3 | リアルタイムフィードバック | AIによるフォーム確認補助機能の紹介 |
| 3/3 | 低価格 | 月額500円、1週間無料トライアルの案内 |

### 画面要素

| 要素 | 配置 | 動作 |
|-----|------|------|
| スキップボタン | 右上（1-2ページ目のみ） | ログイン画面へ遷移 |
| イラスト | 中央上部 | 各画面の内容を視覚化 |
| タイトル | 中央 | 主要メッセージ |
| 説明文 | タイトル下 | 詳細な説明（2-3行） |
| ページインジケーター | 下部 | 現在位置表示（● ○ ○） |
| 次へボタン | 下部（1-2ページ目） | 次のページへ |
| 始めるボタン | 下部（3ページ目のみ） | ログイン画面へ遷移 |

### 表示条件

- 初回起動時のみ表示
- 一度表示したら`AsyncStorage`に記録し、2回目以降は表示しない

## 受け入れ条件

- [ ] 3ページ構成のオンボーディング画面が表示される
- [ ] スワイプで次のページへ移動できる
- [ ] 「次へ」ボタンで次のページへ移動できる
- [ ] 「スキップ」ボタンでログイン画面へ遷移できる
- [ ] 最終ページの「始める」ボタンでログイン画面へ遷移できる
- [ ] ページインジケーターが現在位置を表示する
- [ ] 1ページ目で「医療機器ではない」旨が明示されている
- [ ] 完了後、次回起動時はオンボーディングが表示されない

## 参照ドキュメント

- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md) - 3.2 オンボーディング画面
- [要件定義書 Part 4（画面設計）](../specs/04_要件定義書_Expo版_v1_Part4.md)

## 技術詳細

### Expo Routerパス

`app/onboarding/index.tsx`

### ワイヤーフレーム（1ページ目）

```
+-------------------------------+
|                       [スキップ]|
|                               |
|     [イラスト: スマホと人]       |
|                               |
|   「本サービスは医療機器では    |
|      ありません」               |
|                               |
|  ・参考情報としてご利用ください  |
|  ・医学的判断は行いません       |
|  ・最終判断はご自身で           |
|                               |
|          ● ○ ○               |
|                               |
|          [次へ ->]             |
+-------------------------------+
```

### オンボーディングデータ

```typescript
// lib/constants/onboarding.ts
export const ONBOARDING_PAGES = [
  {
    id: 1,
    title: '本サービスは医療機器ではありません',
    description: [
      '参考情報としてご利用ください',
      '医学的判断は行いません',
      '最終判断はご自身でお願いいたします',
    ],
    image: require('@/assets/images/onboarding-1.png'),
  },
  {
    id: 2,
    title: 'AIがあなたのフォームを確認補助',
    description: [
      'カメラでフォームをチェック',
      '音声で参考情報を提供',
      '映像はデバイス内で処理（外部送信なし）',
    ],
    image: require('@/assets/images/onboarding-2.png'),
  },
  {
    id: 3,
    title: '月額500円で始められる',
    description: [
      '1週間無料トライアル',
      'いつでもキャンセル可能',
    ],
    image: require('@/assets/images/onboarding-3.png'),
  },
];
```

### 実装コード

```typescript
// app/onboarding/index.tsx
import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeContainer } from '@/components';
import { ONBOARDING_PAGES } from '@/lib/constants/onboarding';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'hasSeenOnboarding';

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleStart = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/auth/login');
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const isLastPage = currentIndex === ONBOARDING_PAGES.length - 1;

  return (
    <SafeContainer style={styles.container}>
      {/* スキップボタン */}
      {!isLastPage && (
        <View style={styles.skipContainer}>
          <Button mode="text" onPress={handleSkip}>
            スキップ
          </Button>
        </View>
      )}

      {/* ページコンテンツ */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Image
              source={item.image}
              style={styles.image}
              resizeMode="contain"
            />
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.descriptionContainer}>
              {item.description.map((text, index) => (
                <Text key={index} style={styles.description}>
                  ・{text}
                </Text>
              ))}
            </View>
          </View>
        )}
      />

      {/* ページインジケーター */}
      <View style={styles.indicatorContainer}>
        {ONBOARDING_PAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              currentIndex === index && styles.indicatorActive,
            ]}
          />
        ))}
      </View>

      {/* ボタン */}
      <View style={styles.buttonContainer}>
        {isLastPage ? (
          <Button
            mode="contained"
            onPress={handleStart}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            始める
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={handleNext}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            次へ
          </Button>
        )}
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  page: {
    width,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#212121',
  },
  descriptionContainer: {
    alignItems: 'flex-start',
  },
  description: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 8,
    lineHeight: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 5,
  },
  indicatorActive: {
    backgroundColor: '#4CAF50',
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  button: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
```

### アニメーション付きページインジケーター（オプション）

```typescript
// components/PageIndicator.tsx
import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface PageIndicatorProps {
  totalPages: number;
  currentIndex: number;
}

export function PageIndicator({ totalPages, currentIndex }: PageIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            currentIndex === index ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  dotActive: {
    backgroundColor: '#4CAF50',
    width: 24, // アクティブは少し長く
  },
  dotInactive: {
    backgroundColor: '#E0E0E0',
  },
});
```

## 注意事項

- 薬機法対応のため、1ページ目で「医療機器ではない」旨を必ず明示すること
- 「参考情報」「確認補助」などの適切な表現を使用すること
- イラストは著作権フリーのものを使用するか、自作すること
- スワイプとボタンの両方でページ移動できるようにすること

## 見積もり

- 想定工数: 4-6時間
- 難易度: 低

## 進捗

- [ ] 未着手
