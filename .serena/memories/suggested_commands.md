# 開発コマンド一覧

## Expo アプリ（expo_app/）

```powershell
# 依存関係インストール
cd expo_app && npm install

# 開発サーバー起動
npm start
# または
npx expo start

# Android エミュレータで実行
npm run android
# または
npx expo start --android

# iOS シミュレータで実行
npm run ios

# Lint チェック
npm run lint

# Lint 自動修正
npm run lint:fix

# コードフォーマット
npm run format

# フォーマットチェック
npm run format:check

# TypeScript 型チェック
npm run typecheck
```

## Firebase Functions（functions/）

```powershell
cd functions

# 依存関係インストール
npm install

# Lint チェック
npm run lint

# Lint 自動修正
npm run lint:fix

# フォーマット
npm run format

# ビルド
npm run build

# ウォッチモード
npm run build:watch

# テスト実行
npm test

# テストウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage

# ローカルエミュレーション
npm run serve
```

## Firebase 操作（プロジェクトルート）

```powershell
# エミュレータ起動（UI: localhost:4000）
firebase emulators:start

# 全体デプロイ
firebase deploy

# Functions のみデプロイ
firebase deploy --only functions

# セキュリティルールのみデプロイ
firebase deploy --only firestore:rules
```

## Windows 用ユーティリティ

```powershell
# ディレクトリ一覧
dir
# または
Get-ChildItem

# ファイル検索
Get-ChildItem -Recurse -Filter "*.ts"

# 文字列検索（grep相当）
Select-String -Path "*.ts" -Pattern "pattern"

# ファイル内容表示
Get-Content filename.ts

# Git 操作
git status
git add .
git commit -m "message"
git push
```
