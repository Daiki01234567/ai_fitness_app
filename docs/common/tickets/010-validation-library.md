# 010 バリデーション共通ライブラリ

## 概要

Firebase Cloud Functionsとモバイルアプリで使用する入力値バリデーションの共通ライブラリを実装するチケットです。Zodを使用したスキーマ定義、型安全なバリデーション、エラーメッセージの統一、カスタムバリデータの実装などを行います。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 001: Cloud Functions 基盤構築

## 要件

### 機能要件

- なし（基盤機能のため）

### 非機能要件

- NFR-002: バリデーション - 全ての入力値を厳格に検証

## 受け入れ条件（Todo）

- [ ] Zodスキーマ定義（ユーザープロフィール、トレーニングデータ等）
- [ ] バリデーションミドルウェアの実装（`validateRequest`）
- [ ] カスタムバリデータの実装（日本の電話番号、生年月日等）
- [ ] エラーメッセージの多言語対応（日本語）
- [ ] バリデーションエラーの統一レスポンス形式
- [ ] 型安全なバリデーション関数の実装
- [ ] バリデーションのテスト（カバレッジ80%以上）
- [ ] ドキュメント作成（スキーマ定義一覧、使用例）

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データモデル
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-002

## 技術詳細

### Zodを使用したスキーマ定義

#### ユーザープロフィールスキーマ

```typescript
import { z } from 'zod';

/**
 * 性別の列挙型
 */
export const GenderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);

/**
 * フィットネスレベルの列挙型
 */
export const FitnessLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

/**
 * ユーザープロフィールスキーマ
 */
export const UserProfileSchema = z.object({
  height: z.number()
    .min(100, { message: '身長は100cm以上を入力してください' })
    .max(250, { message: '身長は250cm以下を入力してください' })
    .nullable()
    .optional(),

  weight: z.number()
    .min(20, { message: '体重は20kg以上を入力してください' })
    .max(300, { message: '体重は300kg以下を入力してください' })
    .nullable()
    .optional(),

  birthday: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '生年月日はYYYY-MM-DD形式で入力してください' })
    .refine(isBirthdayValid, { message: '無効な生年月日です' })
    .nullable()
    .optional(),

  gender: GenderSchema.nullable().optional(),

  fitnessLevel: FitnessLevelSchema.nullable().optional(),

  goals: z.array(z.string())
    .max(10, { message: '目標は最大10個まで設定できます' })
    .optional(),
});

/**
 * ユーザープロフィール更新リクエストスキーマ
 */
export const UpdateProfileRequestSchema = z.object({
  displayName: z.string()
    .min(1, { message: '表示名を入力してください' })
    .max(50, { message: '表示名は50文字以内で入力してください' })
    .nullable()
    .optional(),

  profile: UserProfileSchema.optional(),
});

// TypeScript型を自動生成
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
```

#### トレーニングセッションスキーマ

```typescript
/**
 * 種目の列挙型
 */
export const ExerciseTypeSchema = z.enum([
  'squat',
  'pushup',
  'armcurl',
  'sidelateral',
  'shoulderpress',
]);

/**
 * カメラ位置の列挙型
 */
export const CameraPositionSchema = z.enum(['front', 'side']);

/**
 * トレーニングセッション作成リクエストスキーマ
 */
export const CreateSessionRequestSchema = z.object({
  exerciseType: ExerciseTypeSchema,

  cameraSettings: z.object({
    position: CameraPositionSchema,
    resolution: z.string(),
    fps: z.number()
      .min(15, { message: 'FPSは15以上を指定してください' })
      .max(60, { message: 'FPSは60以下を指定してください' }),
  }),
});

/**
 * トレーニングセッション完了リクエストスキーマ
 */
export const CompleteSessionRequestSchema = z.object({
  sessionId: z.string().min(1, { message: 'セッションIDを指定してください' }),

  repCount: z.number()
    .min(0, { message: 'レップ数は0以上を指定してください' })
    .max(1000, { message: 'レップ数は1000以下を指定してください' }),

  setCount: z.number()
    .min(1, { message: 'セット数は1以上を指定してください' })
    .max(100, { message: 'セット数は100以下を指定してください' }),

  formFeedback: z.object({
    overallScore: z.number()
      .min(0, { message: 'スコアは0以上を指定してください' })
      .max(100, { message: 'スコアは100以下を指定してください' }),
    goodFrames: z.number().min(0),
    warningFrames: z.number().min(0),
    errorFrames: z.number().min(0),
    warnings: z.array(z.object({
      type: z.string(),
      count: z.number().min(0),
      severity: z.enum(['low', 'medium', 'high']),
    })),
  }),

  sessionMetadata: z.object({
    totalFrames: z.number().min(0),
    processedFrames: z.number().min(0),
    averageFps: z.number().min(0),
    frameDropCount: z.number().min(0),
    averageConfidence: z.number().min(0).max(1),
    mediapipePerformance: z.object({
      averageInferenceTime: z.number().min(0),
      maxInferenceTime: z.number().min(0),
      minInferenceTime: z.number().min(0),
    }),
    deviceInfo: z.object({
      platform: z.enum(['iOS', 'Android']),
      osVersion: z.string(),
      deviceModel: z.string(),
      deviceMemory: z.number().nullable(),
    }),
  }),
});

// TypeScript型を自動生成
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type CompleteSessionRequest = z.infer<typeof CompleteSessionRequestSchema>;
```

### カスタムバリデータ

#### 生年月日バリデータ

```typescript
/**
 * 生年月日が有効かチェック
 * @param birthday - 生年月日（YYYY-MM-DD形式）
 * @returns 有効な場合true
 */
function isBirthdayValid(birthday: string): boolean {
  const date = new Date(birthday);

  // 無効な日付
  if (isNaN(date.getTime())) {
    return false;
  }

  // 未来の日付は無効
  if (date > new Date()) {
    return false;
  }

  // 120歳以上は無効
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 120);
  if (date < maxDate) {
    return false;
  }

  return true;
}
```

#### 日本の電話番号バリデータ

```typescript
/**
 * 日本の電話番号スキーマ
 */
export const JapanesePhoneSchema = z.string()
  .regex(/^0\d{9,10}$/, { message: '正しい電話番号を入力してください（例: 09012345678）' })
  .refine(isJapanesePhoneValid, { message: '無効な電話番号です' });

/**
 * 日本の電話番号が有効かチェック
 */
function isJapanesePhoneValid(phone: string): boolean {
  // 携帯電話番号（090, 080, 070）
  if (/^0[789]0\d{8}$/.test(phone)) return true;

  // 固定電話番号（市外局番 + 市内局番 + 加入者番号）
  if (/^0\d{9,10}$/.test(phone)) return true;

  return false;
}
```

### バリデーションミドルウェア

```typescript
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

/**
 * バリデーションミドルウェア
 * @param schema - Zodスキーマ
 * @param request - Callable関数のリクエスト
 * @returns バリデーション済みデータ
 * @throws HttpsError - バリデーションエラー
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  request: CallableRequest
): z.infer<T> {
  try {
    return schema.parse(request.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpsError(
        'invalid-argument',
        '入力内容に誤りがあります',
        formatZodError(error)
      );
    }
    throw error;
  }
}

/**
 * Zodエラーを読みやすい形式に変換
 * @param error - ZodError
 * @returns フォーマット済みエラー
 */
function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
```

### 使用例

#### API関数でのバリデーション

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { validateRequest } from '../utils/validation';
import { UpdateProfileRequestSchema } from '../schemas/user';

export const user_updateProfile = onCall(async (request) => {
  // バリデーション
  const validatedData = validateRequest(UpdateProfileRequestSchema, request);

  // validatedData は型安全
  // validatedData.displayName: string | null | undefined
  // validatedData.profile?.height: number | null | undefined

  // ビジネスロジック
  // ...

  return { success: true };
});
```

#### クライアント側でのバリデーション（共通スキーマ使用）

```typescript
// Expo/React Native版
import { UpdateProfileRequestSchema } from '../schemas/user';

function validateProfileForm(data: any) {
  try {
    UpdateProfileRequestSchema.parse(data);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodError(error),
      };
    }
    throw error;
  }
}
```

### エラーレスポンス形式

#### バリデーションエラー

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "入力内容に誤りがあります",
    "details": {
      "displayName": ["表示名は50文字以内で入力してください"],
      "profile.height": ["身長は100cm以上を入力してください"],
      "profile.birthday": ["生年月日はYYYY-MM-DD形式で入力してください"]
    }
  }
}
```

### ディレクトリ構成

```
functions/
├── src/
│   ├── schemas/
│   │   ├── user.ts              # ユーザー関連スキーマ
│   │   ├── training.ts          # トレーニング関連スキーマ
│   │   ├── consent.ts           # 同意関連スキーマ
│   │   └── index.ts             # エクスポート
│   ├── utils/
│   │   ├── validation.ts        # バリデーションユーティリティ
│   │   └── index.ts             # エクスポート
│   └── tests/
│       └── schemas/
│           ├── user.test.ts     # ユーザースキーマテスト
│           └── training.test.ts # トレーニングスキーマテスト
```

### テストケース

#### スキーマのテスト

```typescript
import { UpdateProfileRequestSchema } from '../schemas/user';

describe('UpdateProfileRequestSchema', () => {
  it('should validate valid profile data', () => {
    const validData = {
      displayName: 'テストユーザー',
      profile: {
        height: 170,
        weight: 65,
        birthday: '1990-01-01',
        gender: 'male',
      },
    };

    expect(() => UpdateProfileRequestSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid height', () => {
    const invalidData = {
      profile: {
        height: 50,  // 100未満は無効
      },
    };

    expect(() => UpdateProfileRequestSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid birthday format', () => {
    const invalidData = {
      profile: {
        birthday: '1990/01/01',  // スラッシュ区切りは無効
      },
    };

    expect(() => UpdateProfileRequestSchema.parse(invalidData)).toThrow();
  });
});
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

### Zodのメリット

- **型安全**: TypeScriptの型を自動生成
- **豊富なバリデーション**: 文字列、数値、配列、オブジェクトなど
- **カスタムバリデータ**: `.refine()` で独自のバリデーションを追加
- **エラーメッセージのカスタマイズ**: 日本語のエラーメッセージを設定可能

### バリデーションのベストプラクティス

- **クライアント側でも検証**: サーバー側だけでなく、クライアント側でも同じスキーマを使用
- **早期検証**: 入力フォームでリアルタイムに検証
- **わかりやすいエラーメッセージ**: ユーザーが理解しやすい日本語で表示
- **セキュリティ**: 常にサーバー側で最終的な検証を行う

### 今後の拡張

- **多言語対応**: エラーメッセージを英語、中国語などに対応
- **動的スキーマ**: データベースから取得した設定値に基づいてスキーマを生成
- **共通スキーマパッケージ**: モバイルアプリとバックエンドで共有する npm パッケージ化

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
