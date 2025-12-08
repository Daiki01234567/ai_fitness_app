# 054 課金画面実装

## 概要

ユーザーが有料プラン（プレミアムプラン）を購入するための画面を実装します。プランの説明、価格表示、購入ボタンを含む画面を作成し、スムーズな購入フローを実現します。

## Phase

Phase 3（Apple認証・課金）

## 依存チケット

- 007: スプラッシュ画面実装（基本画面構成）
- 052: Stripe決済基盤セットアップ

## 要件

### 機能要件

1. **プラン選択**
   - 無料プランとプレミアムプランの比較表示
   - プレミアムプランの特典を分かりやすく表示

2. **価格表示**
   - 月額500円の価格を明確に表示
   - 消費税込みの表記

3. **購入フロー**
   - Stripeによる安全な決済処理
   - 決済完了後の確認画面

4. **法的要件対応**
   - 利用規約へのリンク
   - 自動更新の説明
   - 解約方法の案内

## 受け入れ条件

- [ ] プラン比較が分かりやすく表示される
- [ ] 価格（月額500円）が明確に表示される
- [ ] 購入ボタンをタップしてStripe決済画面に遷移できる
- [ ] 決済完了後にプレミアムプランが有効になる
- [ ] 自動更新についての説明が表示される
- [ ] 利用規約へのリンクがある
- [ ] 解約方法へのリンクがある
- [ ] ローディング状態が適切に表示される

## 参照ドキュメント

- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` - FR-019, FR-020
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md`
- [Stripe Payment Sheet](https://stripe.com/docs/payments/accept-a-payment?platform=react-native)

## 技術詳細

### 画面構成

```
+----------------------------------+
|          プレミアムプラン          |
|                                  |
|  +----------------------------+  |
|  |   無料プラン    プレミアム  |  |
|  +----------------------------+  |
|  | 基本機能      |  全機能    |  |
|  | 広告あり      |  広告なし  |  |
|  | 履歴7日間    |  履歴無制限 |  |
|  | -           |  音声ガイド |  |
|  +----------------------------+  |
|                                  |
|     月額 500円（税込）           |
|     7日間無料トライアル付き       |
|                                  |
|  +----------------------------+  |
|  |    プレミアムを始める       |  |
|  +----------------------------+  |
|                                  |
|  自動更新について:              |
|  購入確定で月額500円が課金され   |
|  毎月自動的に更新されます。      |
|                                  |
|  利用規約 | プライバシーポリシー |
|  解約方法                       |
+----------------------------------+
```

### 実装コード例

#### 課金画面コンポーネント

```typescript
// app/(main)/billing.tsx
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useState } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const PREMIUM_PRICE = 500;
const TRIAL_DAYS = 7;

export default function BillingScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const isPremium = useSubscriptionStore((state) => state.isPremium());

  const handlePurchase = async () => {
    setLoading(true);
    try {
      // PaymentIntent取得
      const response = await createSubscription({ priceId: 'price_xxxxx' });

      // PaymentSheet初期化
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: response.clientSecret,
        merchantDisplayName: 'AIフィットネスアプリ',
        defaultBillingDetails: {
          name: 'ユーザー名',
        },
      });

      if (initError) {
        Alert.alert('エラー', '決済の準備に失敗しました');
        return;
      }

      // PaymentSheet表示
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('エラー', '決済に失敗しました');
        }
        return;
      }

      // 成功
      Alert.alert('購入完了', 'プレミアムプランをご利用いただけます');
    } catch (error) {
      Alert.alert('エラー', '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (isPremium) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>プレミアムプラン利用中</Text>
        <Text style={styles.description}>
          すべての機能をご利用いただけます
        </Text>
        <Pressable
          style={styles.manageButton}
          onPress={() => router.push('/subscription-manage')}
        >
          <Text style={styles.manageButtonText}>プラン管理</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>プレミアムプラン</Text>
        <Text style={styles.subtitle}>
          すべての機能を使って、効果的なトレーニングを
        </Text>
      </View>

      {/* プラン比較表 */}
      <View style={styles.comparisonTable}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>機能</Text>
          <Text style={styles.tableHeaderText}>無料</Text>
          <Text style={[styles.tableHeaderText, styles.premiumHeader]}>
            プレミアム
          </Text>
        </View>

        <ComparisonRow
          feature="フォームチェック"
          free={true}
          premium={true}
        />
        <ComparisonRow
          feature="5種目のトレーニング"
          free={true}
          premium={true}
        />
        <ComparisonRow
          feature="履歴の保存期間"
          freeText="7日間"
          premiumText="無制限"
        />
        <ComparisonRow
          feature="音声ガイダンス"
          free={false}
          premium={true}
        />
        <ComparisonRow
          feature="詳細な統計"
          free={false}
          premium={true}
        />
        <ComparisonRow
          feature="広告なし"
          free={false}
          premium={true}
        />
      </View>

      {/* 価格表示 */}
      <View style={styles.priceSection}>
        <Text style={styles.price}>
          月額 <Text style={styles.priceAmount}>{PREMIUM_PRICE}円</Text>
          <Text style={styles.priceTax}>（税込）</Text>
        </Text>
        <Text style={styles.trialText}>
          {TRIAL_DAYS}日間の無料トライアル付き
        </Text>
      </View>

      {/* 購入ボタン */}
      <Pressable
        style={[styles.purchaseButton, loading && styles.purchaseButtonDisabled]}
        onPress={handlePurchase}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.purchaseButtonText}>
            無料で{TRIAL_DAYS}日間試す
          </Text>
        )}
      </Pressable>

      {/* 自動更新の説明 */}
      <View style={styles.autoRenewSection}>
        <Text style={styles.autoRenewTitle}>自動更新について</Text>
        <Text style={styles.autoRenewText}>
          無料トライアル終了後、月額{PREMIUM_PRICE}円が自動的に課金されます。
          いつでも解約できます。
        </Text>
      </View>

      {/* 法的リンク */}
      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL('/terms')}>
          <Text style={styles.legalLinkText}>利用規約</Text>
        </Pressable>
        <Text style={styles.legalSeparator}>|</Text>
        <Pressable onPress={() => Linking.openURL('/privacy')}>
          <Text style={styles.legalLinkText}>プライバシーポリシー</Text>
        </Pressable>
        <Text style={styles.legalSeparator}>|</Text>
        <Pressable onPress={() => router.push('/cancel-guide')}>
          <Text style={styles.legalLinkText}>解約方法</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

#### 比較行コンポーネント

```typescript
// components/billing/ComparisonRow.tsx
interface ComparisonRowProps {
  feature: string;
  free?: boolean;
  premium?: boolean;
  freeText?: string;
  premiumText?: string;
}

function ComparisonRow({
  feature,
  free,
  premium,
  freeText,
  premiumText,
}: ComparisonRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.featureText}>{feature}</Text>
      <View style={styles.checkCell}>
        {freeText ? (
          <Text style={styles.cellText}>{freeText}</Text>
        ) : free ? (
          <Ionicons name="checkmark" size={20} color="#4CAF50" />
        ) : (
          <Ionicons name="close" size={20} color="#9E9E9E" />
        )}
      </View>
      <View style={[styles.checkCell, styles.premiumCell]}>
        {premiumText ? (
          <Text style={[styles.cellText, styles.premiumText]}>{premiumText}</Text>
        ) : premium ? (
          <Ionicons name="checkmark" size={20} color="#4CAF50" />
        ) : (
          <Ionicons name="close" size={20} color="#9E9E9E" />
        )}
      </View>
    </View>
  );
}
```

### スタイル定義

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  price: {
    fontSize: 16,
    color: '#333',
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  priceTax: {
    fontSize: 12,
    color: '#666',
  },
  trialText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
  },
  purchaseButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoRenewSection: {
    padding: 24,
    backgroundColor: '#F5F5F5',
    marginTop: 24,
  },
  autoRenewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  autoRenewText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 24,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#2196F3',
  },
  legalSeparator: {
    marginHorizontal: 8,
    color: '#9E9E9E',
  },
});
```

### ファイル構成

```
app/
├── (main)/
│   ├── billing.tsx             # 課金画面
│   └── cancel-guide.tsx        # 解約方法案内
└── components/
    └── billing/
        ├── ComparisonRow.tsx   # 比較行
        ├── PriceDisplay.tsx    # 価格表示
        └── PurchaseButton.tsx  # 購入ボタン
```

## 注意事項

1. **価格表示の明確さ**
   - 税込み表示を明記
   - 自動更新であることを明記

2. **特定商取引法対応**
   - 事業者情報の表示
   - 返金ポリシーの説明

3. **App Store審査対応**
   - 価格は「月額500円」など具体的に表示
   - 解約方法を明記

4. **デザインガイドライン**
   - Material Design / Human Interface Guidelines に準拠
   - アクセシビリティ対応

5. **ローディング状態**
   - 決済処理中は適切なローディング表示
   - 二重送信防止

## 見積もり

| 作業項目 | 工数 |
|---------|------|
| UI設計・デザイン | 3時間 |
| 画面実装 | 5時間 |
| Stripe連携 | 3時間 |
| エラーハンドリング | 2時間 |
| テスト | 3時間 |
| **合計** | **16時間（2日）** |

## 進捗

- [ ] 画面デザイン確定
- [ ] 課金画面コンポーネント実装
- [ ] プラン比較表実装
- [ ] 価格表示実装
- [ ] 購入ボタン・Stripe連携
- [ ] 自動更新説明セクション
- [ ] 法的リンク追加
- [ ] ローディング・エラー状態
- [ ] UIテスト
- [ ] 実機テスト
