# 開発環境セットアップガイド（Expo版）

このガイドでは、Expo版AIフィットネスアプリの開発環境を準備する方法を説明します。

## このガイドの対象者

- 開発者の方
- プログラミングの基本的な知識がある方

## 必要なもの

### ソフトウェア

| ソフトウェア | バージョン | 確認コマンド |
|-------------|-----------|-------------|
| Node.js | 20.x以上 | `node -v` |
| npm | 10.x以上 | `npm -v` |
| Git | 最新版 | `git --version` |

### オプション（実機テスト用）

- **iOS**: macOS + Xcode（App Storeからインストール）
- **Android**: Android Studio（[ダウンロード](https://developer.android.com/studio)）
- **スマートフォン**: Expo Goアプリ（App Store / Google Play）

---

## ステップ1: リポジトリをクローン

```bash
# リポジトリをクローン
git clone <リポジトリURL>
cd ai_fitness_app
```

---

## ステップ2: 環境変数を設定

### 2-1. 環境変数ファイルの確認

`expo_app/.env.development` ファイルが存在することを確認してください。

ない場合は、`.env.example` をコピーして作成：

```bash
cd expo_app
cp .env.example .env.development
```

### 2-2. 環境変数の値

開発環境の設定値（チーム内で共有されたもの）を入力してください：

```env
EXPO_PUBLIC_FIREBASE_API_KEY=（チームから取得）
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tokyo-list-478804-e5.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tokyo-list-478804-e5
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tokyo-list-478804-e5.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=（チームから取得）
EXPO_PUBLIC_FIREBASE_APP_ID=（チームから取得）
EXPO_PUBLIC_ENV=development
```

---

## ステップ3: 依存関係をインストール

```bash
# expo_appディレクトリにいることを確認
cd expo_app

# 依存関係をインストール
npm install
```

**インストールにかかる時間**: 約2〜5分

---

## ステップ4: 開発サーバーを起動

```bash
# 開発サーバーを起動
npm start
```

起動すると、以下のような画面が表示されます：

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Using Expo Go
› Press s │ switch to development build

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
› Press o │ open project code in your editor

› Press ? │ show all commands
```

---

## ステップ5: アプリを確認

### 方法A: スマートフォンで確認（推奨）

1. スマートフォンに **Expo Go** アプリをインストール
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. 開発サーバーの画面に表示されたQRコードをスキャン
   - iOS: カメラアプリでスキャン
   - Android: Expo Goアプリでスキャン

3. アプリが起動すればOK！

### 方法B: シミュレーター/エミュレーターで確認

**iOS（macOSのみ）**:
```bash
# iを押す、または
npm run ios
```

**Android**:
```bash
# aを押す、または
npm run android
```

### 方法C: Webブラウザで確認

```bash
# wを押す、または
npm run web
```

---

## よくある質問（FAQ）

### Q1: `npm install` でエラーが出る

**A**: 以下を試してください：

```bash
# キャッシュをクリア
npm cache clean --force

# node_modulesを削除して再インストール
rm -rf node_modules
npm install
```

### Q2: QRコードをスキャンしてもアプリが起動しない

**A**: 以下を確認してください：
- パソコンとスマートフォンが同じWi-Fiに接続されているか
- ファイアウォールがポート8081をブロックしていないか
- Expo Goアプリが最新版か

### Q3: "Metro bundler" が起動しない

**A**: ポートが使用中の可能性があります：

```bash
# 別のポートで起動
npx expo start --port 8082
```

### Q4: TypeScriptのエラーが出る

**A**: 型チェックを実行してエラーを確認：

```bash
npm run typecheck
```

---

## 利用可能なコマンド

| コマンド | 説明 |
|---------|------|
| `npm start` | 開発サーバー起動 |
| `npm run ios` | iOSシミュレーターで起動 |
| `npm run android` | Androidエミュレーターで起動 |
| `npm run web` | Webブラウザで起動 |
| `npm run typecheck` | TypeScript型チェック |
| `npm run lint` | ESLintでコードチェック |
| `npm run lint:fix` | ESLintで自動修正 |
| `npm run format` | Prettierでフォーマット |

---

## 次のステップ

開発環境のセットアップが完了したら、以下のドキュメントを参照してください：

- [チケット一覧](../tickets/000-ticket-overview.md) - 開発タスクの全体像
- [要件定義書](../specs/) - アプリの仕様

---

## サポート

問題が解決しない場合は、以下の情報を添えて報告してください：

1. 実行したコマンド
2. エラーメッセージ（全文）
3. Node.jsのバージョン（`node -v`）
4. OSの種類とバージョン

---

*最終更新: 2025年12月9日*
