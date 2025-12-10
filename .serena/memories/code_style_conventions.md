# コードスタイル・コンベンション

## 言語方針

### 日本語で記述するもの（原則）
- ドキュメント作成（README、設計書、チケット等）
- Docstring / JSDoc / DartDoc
- ユーザー向けコンソール出力・ログメッセージ
- エラーメッセージ（ユーザー向け）
- コミットメッセージ
- PRの説明文

### 英語で記述するもの
- コード内コメント（インラインコメント）
- 変数名・関数名・クラス名
- 内部システムログ（デバッグ用）

## TypeScript/React Native (Expo)

### ESLint 設定
- Expo 推奨設定 + Prettier 連携
- `.eslintrc.js` で設定

### 型安全性
- `any` を避け、明示的な型定義を使用
- Zod 等でランタイム検証も追加

### コンポーネント設計
- 関数コンポーネント優先
- React Hooks 活用
- コンポーネントは小さく分割

### 状態管理（Zustand）
- ストアは機能単位で分割
- ミューテーション関数を明示的に定義

### ファイル構成パターン
```
expo_app/
├── app/               # Expo Router 画面
├── components/        # 再利用コンポーネント
│   └── ui/           # 共通UIコンポーネント
├── lib/              # サービス、ユーティリティ
│   └── theme/        # テーマ設定
├── stores/           # Zustand ストア
└── types/            # 型定義
```

## Firebase Functions (TypeScript)

### ESLint 設定
- Google スタイル
- ダブルクォート使用

### 関数設計
- 単一責任
- 純粋関数優先
- 冪等性を保つ

### セキュリティパターン
```typescript
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
  if (context.auth.uid !== data.userId) throw new functions.https.HttpsError("permission-denied", "権限がありません");
  // ... validation and processing
});
```

### ログ出力
```typescript
logger.info("Session created", { userId, sessionId, exerciseType, duration: performance.now() - startTime });
```

## React Native Paper / Material Design 3

### テーマ構成
- `expo_app/lib/theme/index.ts` で一元管理
- `lightTheme` / `darkTheme` を提供
- `colors`, `spacing`, `typography`, `borderRadius` をエクスポート

### UIコンポーネント
- `expo_app/components/ui/` に配置
- `App` プレフィックス（例: `AppButton`, `AppTextInput`）
- アクセシビリティ対応（WCAG 44x44 タッチターゲット）

## 法的制約

### 薬機法
- 医療機器ではない
- 禁止用語: 「治療」「診断」「治す」
- 使用可能: 「フィットネス」「運動」「トレーニング」「健康維持」

### GDPR
- 削除30日間猶予期間
- 同意追跡は不変コレクション
- 72時間以内の違反通知
