# 022 入力バリデーション強化

## 概要

APIに送られてくるデータが正しい形式かどうかをチェック（バリデーション）する機能を強化するチケットです。不正なデータやXSS（クロスサイトスクリプティング）、SQLインジェクションなどの攻撃を防ぎ、アプリケーションの安全性を高めます。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- common/003（Firebase Authentication統合）

## 要件

### 機能要件

- なし（セキュリティ強化チケットのため）

### 非機能要件

- NFR-033: 脆弱性対策 - OWASP Top 10の脆弱性に対応
- NFR-002: データ整合性 - 不正なデータの保存を防ぐ

## 受け入れ条件（Todo）

### バリデーションスキーマ作成

- [ ] Zodライブラリをインストール・設定
- [ ] ユーザープロフィール更新のスキーマを作成
- [ ] トレーニングセッションのスキーマを作成
- [ ] GDPR関連APIのスキーマを作成
- [ ] 課金関連APIのスキーマを作成

### サニタイズ処理実装

- [ ] HTML特殊文字のエスケープ処理を実装
- [ ] SQLインジェクション対策を実装
- [ ] NoSQLインジェクション対策を実装
- [ ] パストラバーサル対策を実装

### 共通バリデーションルール

- [ ] メールアドレスのフォーマットチェック
- [ ] パスワード強度チェック（8文字以上、英数字混在）
- [ ] 日付フォーマットチェック（YYYY-MM-DD）
- [ ] 数値範囲チェック（身長、体重など）
- [ ] 文字列長チェック（表示名など）

### エラーハンドリング

- [ ] バリデーションエラーの統一フォーマットを定義
- [ ] どのフィールドがエラーかを明確に返す
- [ ] ユーザーにわかりやすいエラーメッセージを返す
- [ ] ログにバリデーションエラーを記録

### テスト

- [ ] 各スキーマの正常系テストを作成
- [ ] 各スキーマの異常系テストを作成
- [ ] 境界値テストを実施
- [ ] 悪意のある入力のテストを実施

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様とリクエスト形式
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - 脆弱性管理
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データ型と制約

## 技術詳細

### Zodライブラリの導入

```bash
# functionsディレクトリで実行
npm install zod
```

### ユーザープロフィール更新スキーマ

```typescript
import { z } from 'zod';

// 性別の選択肢
const GenderEnum = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);

// フィットネスレベルの選択肢
const FitnessLevelEnum = z.enum(['beginner', 'intermediate', 'advanced']);

// プロフィールスキーマ
const ProfileSchema = z.object({
  height: z.number()
    .min(50, '身長は50cm以上で入力してください')
    .max(300, '身長は300cm以下で入力してください')
    .nullable()
    .optional(),

  weight: z.number()
    .min(10, '体重は10kg以上で入力してください')
    .max(500, '体重は500kg以下で入力してください')
    .nullable()
    .optional(),

  birthday: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .nullable()
    .optional(),

  gender: GenderEnum.nullable().optional(),

  fitnessLevel: FitnessLevelEnum.nullable().optional(),

  goals: z.array(z.string().max(100, '目標は100文字以内で入力してください'))
    .max(10, '目標は10個まで設定できます')
    .optional()
});

// プロフィール更新リクエストスキーマ
export const UpdateProfileRequestSchema = z.object({
  displayName: z.string()
    .min(1, '表示名を入力してください')
    .max(50, '表示名は50文字以内で入力してください')
    .nullable()
    .optional(),

  profile: ProfileSchema.optional()
});

// 型の自動生成
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
```

### トレーニングセッションスキーマ

```typescript
import { z } from 'zod';

// 種目の選択肢
const ExerciseTypeEnum = z.enum([
  'squat',
  'pushup',
  'armcurl',
  'sidelateral',
  'shoulderpress'
]);

// カメラ位置の選択肢
const CameraPositionEnum = z.enum(['front', 'side']);

// セッション作成リクエストスキーマ
export const CreateSessionRequestSchema = z.object({
  exerciseType: ExerciseTypeEnum,

  cameraSettings: z.object({
    position: CameraPositionEnum,
    resolution: z.string().max(20),
    fps: z.number().min(15).max(60)
  })
});

// セッション完了リクエストスキーマ
export const CompleteSessionRequestSchema = z.object({
  sessionId: z.string()
    .min(20, 'セッションIDが不正です')
    .max(50, 'セッションIDが不正です'),

  repCount: z.number()
    .min(0, 'レップ数は0以上で入力してください')
    .max(1000, 'レップ数は1000以下で入力してください'),

  setCount: z.number()
    .min(1, 'セット数は1以上で入力してください')
    .max(100, 'セット数は100以下で入力してください'),

  formFeedback: z.object({
    overallScore: z.number().min(0).max(100),
    goodFrames: z.number().min(0),
    warningFrames: z.number().min(0),
    errorFrames: z.number().min(0),
    warnings: z.array(z.object({
      type: z.string().max(50),
      count: z.number().min(0),
      severity: z.enum(['low', 'medium', 'high'])
    }))
  }),

  sessionMetadata: z.object({
    totalFrames: z.number().min(0),
    processedFrames: z.number().min(0),
    averageFps: z.number().min(0).max(120),
    frameDropCount: z.number().min(0),
    averageConfidence: z.number().min(0).max(1),
    mediapipePerformance: z.object({
      averageInferenceTime: z.number().min(0),
      maxInferenceTime: z.number().min(0),
      minInferenceTime: z.number().min(0)
    }),
    deviceInfo: z.object({
      platform: z.enum(['iOS', 'Android']),
      osVersion: z.string().max(30),
      deviceModel: z.string().max(100),
      deviceMemory: z.number().nullable()
    })
  })
});
```

### サニタイズユーティリティ

```typescript
/**
 * HTML特殊文字をエスケープする
 * XSS攻撃を防ぐために使用
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };

  return str.replace(/[&<>"'\/]/g, (char) => htmlEntities[char] || char);
}

/**
 * NoSQLインジェクション対策
 * Firestoreで危険な演算子を除去
 */
export function sanitizeForFirestore(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // $で始まる文字列は危険（MongoDBの演算子など）
    if (obj.startsWith('$')) {
      return obj.substring(1);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // $で始まるキーは除去
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * パストラバーサル対策
 * ファイルパスから危険な文字を除去
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '')  // ..を除去
    .replace(/\/\//g, '/') // 連続スラッシュを1つに
    .replace(/^\//, '');   // 先頭スラッシュを除去
}
```

### バリデーションミドルウェア

```typescript
import { HttpsError } from 'firebase-functions/v2/https';
import { ZodSchema, ZodError } from 'zod';

/**
 * リクエストデータをバリデーションするミドルウェア
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      console.warn('バリデーションエラー:', fieldErrors);

      throw new HttpsError(
        'invalid-argument',
        '入力データが不正です',
        { fieldErrors }
      );
    }
    throw error;
  }
}

// 使用例
export const user_updateProfile = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  // バリデーション
  const validatedData = validateRequest(
    UpdateProfileRequestSchema,
    request.data
  );

  // サニタイズ
  const sanitizedData = sanitizeForFirestore(validatedData);

  // 処理続行...
});
```

### エラーレスポンス形式

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "入力データが不正です",
    "details": {
      "fieldErrors": [
        {
          "field": "profile.height",
          "message": "身長は50cm以上で入力してください"
        },
        {
          "field": "displayName",
          "message": "表示名は50文字以内で入力してください"
        }
      ]
    }
  }
}
```

## 見積もり

- 工数: 3日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- Zodを選択した理由：TypeScriptとの相性が良く、型推論が自動
- JOIも検討したが、TypeScript対応が弱いため見送り
- クライアント側のバリデーションと一致させることが重要

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
