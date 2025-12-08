# 002 Expo開発環境構築

## 概要

Expo（React Native）を使用したアプリ開発環境を構築します。Node.js、Expo SDK、TypeScriptなどの開発に必要なツールとライブラリをセットアップします。

## Phase

Phase 1（基盤構築）

## 依存チケット

- [001 Firebaseプロジェクトセットアップ](./001-firebase-project-setup.md)

## 要件

### 開発環境の要件

| 項目 | バージョン | 備考 |
|------|-----------|------|
| Node.js | 20.x 以上 | LTS版を推奨 |
| Expo SDK | 52+ | 最新の安定版 |
| TypeScript | 5.0+ | 型安全な開発のため |
| React Native | Expo SDKに対応するバージョン | Expo Managedで管理 |

### プロジェクト構成

```
ai-fitness-expo/
├── app/                    # Expo Routerの画面ファイル
│   ├── _layout.tsx         # ルートレイアウト
│   ├── (splash)/           # スプラッシュ画面
│   ├── onboarding/         # オンボーディング
│   ├── auth/               # 認証関連画面
│   ├── (tabs)/             # タブナビゲーション
│   ├── training/           # トレーニング関連画面
│   ├── settings/           # 設定画面
│   └── subscription/       # 課金関連画面
├── components/             # 共通コンポーネント
├── hooks/                  # カスタムフック
├── stores/                 # Zustand ストア
├── lib/                    # ユーティリティ
├── types/                  # 型定義
├── assets/                 # 画像・フォントなど
├── app.json                # Expo設定
├── package.json            # 依存関係
├── tsconfig.json           # TypeScript設定
└── .env.local              # 環境変数（gitignore）
```

### 必須パッケージ

```json
{
  "dependencies": {
    "expo": "^52.0.0",
    "expo-router": "^4.0.0",
    "react": "^18.2.0",
    "react-native": "^0.74.0",
    "react-native-paper": "^5.12.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@react-native-async-storage/async-storage": "^1.23.0",
    "expo-dev-client": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
  }
}
```

## 受け入れ条件

- [ ] Node.js 20.x 以上がインストールされている
- [ ] Expo CLI（`npx expo`）が使用可能
- [ ] プロジェクトが`npx create-expo-app`で作成されている
- [ ] TypeScript 5.0+が設定されている
- [ ] ESLint/Prettierが設定されている
- [ ] Expo Routerが動作している
- [ ] React Native Paperがインストールされている
- [ ] Zustandがインストールされている
- [ ] TanStack Queryがインストールされている
- [ ] iOS Simulatorまたは実機でアプリが起動する
- [ ] Android Emulatorまたは実機でアプリが起動する

## 参照ドキュメント

- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md)

## 技術詳細

### Expoプロジェクト作成コマンド

```bash
# プロジェクト作成
npx create-expo-app@latest ai-fitness-expo --template tabs

# ディレクトリ移動
cd ai-fitness-expo

# TypeScript設定
npx expo install typescript @types/react

# Expo Router設定（テンプレートに含まれる場合はスキップ）
npx expo install expo-router

# UI ライブラリ
npx expo install react-native-paper react-native-safe-area-context

# 状態管理
npm install zustand @tanstack/react-query

# ストレージ
npx expo install @react-native-async-storage/async-storage

# 開発ビルド対応（MediaPipe統合に必要）
npx expo install expo-dev-client
```

### tsconfig.json の設定

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### ESLint設定

```json
{
  "extends": [
    "expo",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
```

### 開発サーバー起動

```bash
# 開発サーバー起動
npx expo start

# iOS Simulatorで起動
npx expo start --ios

# Android Emulatorで起動
npx expo start --android
```

## 注意事項

- Expo SDK 52以上を使用すること（最新の機能とセキュリティ修正のため）
- `expo-dev-client`は必須（Phase 2のMediaPipe統合で必要）
- 環境変数は`.env.local`で管理し、Gitにはコミットしないこと
- iOS開発にはmacOSとXcodeが必要

## 見積もり

- 想定工数: 4-6時間
- 難易度: 中

## 進捗

- [ ] 未着手
