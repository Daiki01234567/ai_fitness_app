# 002 Expo開発環境セットアップ

## 概要

Expo/React Nativeアプリの開発環境を構築し、チーム全員が開発できる状態にするチケットです。プロジェクトの初期化、必要なライブラリのインストール、開発サーバーの起動確認を行います。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Expo（フロントエンド）

## 依存チケット

- 001 Firebase接続設定

## 要件

### 機能要件

- なし（環境構築チケットのため）

### 非機能要件

- NFR-035: React Native最新版の使用
- NFR-036: Expo Routerの使用

## 受け入れ条件（Todo）

- [x] Expoプロジェクトが作成されている
- [x] `package.json` に必要な依存関係が定義されている
- [x] `npx expo start` で開発サーバーが起動する
- [x] iOSシミュレータで動作確認できる
- [x] Androidエミュレータで動作確認できる
- [x] ESLintとPrettierが設定されている
- [x] `tsconfig.json` が正しく設定されている
- [x] Development Buildのセットアップ（MediaPipe用）

## 参照ドキュメント

- `docs/expo/specs/01_技術スタック_v1_0.md` - 使用ライブラリ一覧
- `docs/expo/specs/02_開発計画_v1_0.md` - 開発環境セットアップ手順
- Expo公式ドキュメント: https://docs.expo.dev/

## 技術詳細

### セットアップ手順

#### ステップ1: 前提条件の確認

```bash
# Node.js バージョン確認
node --version  # 20.x以上

# npm バージョン確認
npm --version   # 10.x以上
```

#### ステップ2: 依存関係のインストール

```bash
cd expo_app
npm install
```

#### ステップ3: 開発サーバー起動

```bash
# Expo Goで起動
npx expo start

# iOSシミュレータで起動
npx expo start --ios

# Androidエミュレータで起動
npx expo start --android
```

#### ステップ4: Development Buildのセットアップ

MediaPipe統合のために必要（Phase 2で使用）

```bash
# expo-dev-clientをインストール
npx expo install expo-dev-client

# ネイティブプロジェクトを生成
npx expo prebuild

# Development Buildでビルド
npx expo run:ios
npx expo run:android
```

### 主要ライブラリ

**`package.json`**（抜粋）

```json
{
  "dependencies": {
    "expo": "^52.0.0",
    "expo-router": "^4.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "typescript": "^5.3.3",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "react-native-paper": "^5.12.5",
    "zod": "^3.23.8",
    "@react-native-firebase/app": "^21.3.0",
    "@react-native-firebase/auth": "^21.3.0",
    "@react-native-firebase/firestore": "^21.3.0"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "@types/react-native": "^0.76.0",
    "eslint": "^8.57.1",
    "prettier": "^3.4.2",
    "jest": "^29.7.0"
  }
}
```

### ESLint設定

**`.eslintrc.js`**

```javascript
module.exports = {
  extends: [
    'expo',
    'prettier',
  ],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### Prettier設定

**`.prettierrc`**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### TypeScript設定

**`tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npx expo start` | Expo Goで開発サーバー起動 |
| `npx expo start --ios` | iOSシミュレータで実行 |
| `npx expo start --android` | Androidエミュレータで実行 |
| `npm run lint` | ESLintでコードチェック |
| `npm run format` | Prettierでコード整形 |
| `npm test` | Jestでテスト実行 |
| `npx expo prebuild` | ネイティブコード生成 |

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月9日

## 備考

- expo_appディレクトリは既に作成済み
- 基本的なディレクトリ構造は既に整備されている
- Development Buildは将来のMediaPipe統合（チケット011）で必須となる
- チーム全員が同じバージョンのNode.js/npmを使用すること

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成、完了ステータスに更新 |
