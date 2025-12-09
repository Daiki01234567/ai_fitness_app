# Firebase セットアップガイド（Expo版）

このガイドでは、Expo版AIフィットネスアプリの開発を始めるために必要な Firebase の設定方法を説明します。

## このガイドの対象者

- Expo版AIフィットネスアプリを開発する方
- 初めてFirebaseを使う方でも大丈夫です

## 必要なもの

- パソコン（Windows / Mac / Linux）
- インターネット接続
- Googleアカウント（Gmailなど）

---

## ステップ1: Firebaseコンソールにアクセス

1. ブラウザで [Firebase Console](https://console.firebase.google.com/) を開きます
2. Googleアカウントでログインします
3. プロジェクト一覧から `tokyo-list-478804-e5` を選択します

---

## ステップ2: 設定ファイルをダウンロード

### Android用（google-services.json）

1. Firebaseコンソールの左メニューから **プロジェクトの設定**（歯車アイコン）をクリック
2. **全般** タブを選択
3. 下にスクロールして **マイアプリ** セクションを探す
4. **AI Fitness Expo Android**（パッケージ名: `com.aifitness.expo`）を見つける
5. **google-services.json** ボタンをクリックしてダウンロード
6. ダウンロードしたファイルを以下の場所に保存：
   ```
   expo_app/google-services.json
   ```

### iOS用（GoogleService-Info.plist）

1. 同じ **プロジェクトの設定** 画面で
2. **AI Fitness Expo iOS**（バンドルID: `com.aifitness.expo`）を見つける
3. **GoogleService-Info.plist** ボタンをクリックしてダウンロード
4. ダウンロードしたファイルを以下の場所に保存：
   ```
   expo_app/GoogleService-Info.plist
   ```

---

## ステップ3: 環境変数ファイルを作成

### 3-1. テンプレートをコピー

1. `expo_app/.env.example` ファイルを見つける
2. このファイルをコピーして `.env.development` という名前で保存

### 3-2. 値を入力

`.env.development` ファイルをテキストエディタで開き、以下の値を入力します：

```env
# Firebase設定（開発環境）
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyChLgQ1cX__COAhAnSHK5ShPzTYTJVjxXY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tokyo-list-478804-e5.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tokyo-list-478804-e5
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tokyo-list-478804-e5.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=895851221884
EXPO_PUBLIC_FIREBASE_APP_ID=1:895851221884:web:07a9f4a94f794b9ecb8af9

# 環境識別
EXPO_PUBLIC_ENV=development
```

> **注意**: 上記の値はプロジェクト共通の設定値です。本番環境用の値は別途管理します。

---

## ステップ4: .gitignore の確認

機密情報がGitにコミットされないよう、以下のファイルが `.gitignore` に含まれていることを確認してください：

```gitignore
# 環境変数
.env
.env.local
.env.development.local
.env.production.local

# Firebase設定ファイル
google-services.json
GoogleService-Info.plist
```

---

## ステップ5: 接続テスト

環境構築が正しく行われたかテストします。

### 5-1. 依存関係のインストール

```bash
cd expo_app
npm install
```

### 5-2. 開発サーバーの起動

```bash
npx expo start
```

### 5-3. 確認ポイント

- エラーなく起動すること
- Firebase接続エラーが出ないこと

---

## よくある質問（FAQ）

### Q1: `google-services.json` が見つかりません

**A**: Firebaseコンソールの「プロジェクトの設定」→「全般」タブ→「マイアプリ」セクションで確認してください。Androidアプリが登録されていない場合は、管理者に連絡してください。

### Q2: 環境変数が読み込まれません

**A**: 以下を確認してください：
- ファイル名が `.env.development` になっているか
- `EXPO_PUBLIC_` プレフィックスが付いているか
- 開発サーバーを再起動したか

### Q3: Firebaseに接続できません

**A**: 以下を確認してください：
- インターネット接続があるか
- API キーが正しいか
- Firebaseプロジェクトが有効か

---

## トラブルシューティング

### エラー: "Firebase: No Firebase App"

**原因**: Firebase が初期化されていない

**解決方法**:
1. `firebaseConfig.ts` ファイルが存在するか確認
2. アプリのエントリーポイントで Firebase が初期化されているか確認

### エラー: "Invalid API Key"

**原因**: API キーが正しくない

**解決方法**:
1. `.env.development` の `EXPO_PUBLIC_FIREBASE_API_KEY` を確認
2. Firebaseコンソールで正しいAPIキーを取得し直す

---

## 次のステップ

Firebase のセットアップが完了したら、以下のチケットに進んでください：

- [002-expo-project-init](../tickets/002-expo-project-init.md) - Expoプロジェクト初期化

---

## 関連ドキュメント

- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)
- [チケット001](../tickets/001-firebase-project-setup.md)

---

## サポート

問題が解決しない場合は、以下の情報を添えて報告してください：

1. エラーメッセージのスクリーンショット
2. 実行したコマンド
3. OSとNode.jsのバージョン（`node -v` で確認）

---

*最終更新: 2025年12月9日*
