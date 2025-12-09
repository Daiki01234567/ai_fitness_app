# 020 メニュー選択画面

## 概要

5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）の中から、ユーザーがトレーニングしたい種目を選択する画面を実装するチケットです。各種目のカード、説明、推奨難易度を表示します。

## Phase

Phase 2（MediaPipe統合・画面実装）

## プラットフォーム

expo（フロントエンド）

## 依存チケット

- **010**: ボトムナビゲーション

## 要件

### 機能要件

- FR-001: ユーザーアカウント機能（ログイン状態で利用）
- FR-014: フォーム評価機能（5種目選択）

### 非機能要件

- NFR-026: ユーザビリティ（直感的な操作）
- NFR-028: アクセシビリティ（スクリーンリーダー対応）

## 受け入れ条件（Todo）

- [ ] 5種目のカードを縦スクロールで表示
- [ ] 各カードに種目名、カテゴリ、難易度、器具の有無、説明を表示
- [ ] カードをタップすると、トレーニング実行画面（021）に遷移
- [ ] 種目ごとにアイコンまたは画像を表示
- [ ] ログイン状態でのみアクセス可能（未ログインは認証画面にリダイレクト）
- [ ] ローディング状態を表示
- [ ] エラーハンドリング（種目データ取得失敗時）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-001, FR-014
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-026, NFR-028
- `docs/common/specs/01_プロジェクト概要_v1_0.md` - 5種目定義
- `docs/expo/specs/07_画面遷移図_ワイヤーフレーム_v1_0.md` - メニュー選択画面UI

## 技術詳細

### ファイル配置

```
app/
└── (tabs)/
    └── menu.tsx                # メニュー選択画面

components/
└── training/
    └── ExerciseCard.tsx        # 種目カードコンポーネント

types/
└── exercise.ts                 # 種目の型定義
```

### 種目データ型定義

```typescript
export enum ExerciseType {
  SQUAT = 'squat',
  PUSHUP = 'pushup',
  ARM_CURL = 'arm_curl',
  SIDE_RAISE = 'side_raise',
  SHOULDER_PRESS = 'shoulder_press',
}

export enum ExerciseCategory {
  LOWER_BODY = 'lower_body',
  CHEST = 'chest',
  ARM = 'arm',
  SHOULDER = 'shoulder',
}

export enum ExerciseDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export interface Exercise {
  id: ExerciseType;
  name: string;
  nameEn: string;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  requiresEquipment: boolean;
  equipmentName?: string;
  description: string;
  iconName: string;
}
```

### 種目データ定義

```typescript
export const EXERCISES: Exercise[] = [
  {
    id: ExerciseType.SQUAT,
    name: 'スクワット',
    nameEn: 'Squat',
    category: ExerciseCategory.LOWER_BODY,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: false,
    description: '下半身を鍛える基本種目。膝の角度と姿勢をチェックします。',
    iconName: 'barbell-outline',
  },
  {
    id: ExerciseType.PUSHUP,
    name: 'プッシュアップ',
    nameEn: 'Pushup',
    category: ExerciseCategory.CHEST,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: false,
    description: '胸と腕を鍛える基本種目。体のラインと肘の角度をチェックします。',
    iconName: 'fitness-outline',
  },
  {
    id: ExerciseType.ARM_CURL,
    name: 'アームカール',
    nameEn: 'Arm Curl',
    category: ExerciseCategory.ARM,
    difficulty: ExerciseDifficulty.BEGINNER,
    requiresEquipment: true,
    equipmentName: 'ダンベル',
    description: '上腕二頭筋を鍛える種目。肘の角度と位置をチェックします。',
    iconName: 'barbell-outline',
  },
  {
    id: ExerciseType.SIDE_RAISE,
    name: 'サイドレイズ',
    nameEn: 'Side Raise',
    category: ExerciseCategory.SHOULDER,
    difficulty: ExerciseDifficulty.INTERMEDIATE,
    requiresEquipment: true,
    equipmentName: 'ダンベル',
    description: '肩を鍛える種目。腕の挙上角度と左右対称性をチェックします。',
    iconName: 'barbell-outline',
  },
  {
    id: ExerciseType.SHOULDER_PRESS,
    name: 'ショルダープレス',
    nameEn: 'Shoulder Press',
    category: ExerciseCategory.SHOULDER,
    difficulty: ExerciseDifficulty.INTERMEDIATE,
    requiresEquipment: true,
    equipmentName: 'ダンベル',
    description: '肩を鍛える種目。肘の角度と手首の高さをチェックします。',
    iconName: 'barbell-outline',
  },
];
```

### 画面実装（menu.tsx）

```typescript
import { FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ExerciseCard } from '@/components/training/ExerciseCard';
import { EXERCISES } from '@/types/exercise';

export default function MenuScreen() {
  const router = useRouter();

  const handleExercisePress = (exerciseId: ExerciseType) => {
    router.push(`/training/${exerciseId}`);
  };

  return (
    <FlatList
      data={EXERCISES}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ExerciseCard
          exercise={item}
          onPress={() => handleExercisePress(item.id)}
        />
      )}
    />
  );
}
```

### ExerciseCardコンポーネント

```typescript
import { Card, Text, IconButton } from 'react-native-paper';

export function ExerciseCard({ exercise, onPress }) {
  return (
    <Card onPress={onPress} style={{ margin: 16 }}>
      <Card.Title
        title={exercise.name}
        subtitle={`${exercise.category} | ${exercise.difficulty}`}
        left={(props) => <IconButton {...props} icon={exercise.iconName} />}
      />
      <Card.Content>
        <Text>{exercise.description}</Text>
        {exercise.requiresEquipment && (
          <Text>器具: {exercise.equipmentName}</Text>
        )}
      </Card.Content>
    </Card>
  );
}
```

## 見積もり

- 工数: 1.5日
- 難易度: 低

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- **アイコン**: Ionicons（react-native-vector-icons）を使用
- **将来的な拡張**: 種目のフィルタリング、検索、お気に入り機能を追加予定（Phase 3）
- **デザイン**: Material Design 3に準拠し、React Native Paperで実装

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
