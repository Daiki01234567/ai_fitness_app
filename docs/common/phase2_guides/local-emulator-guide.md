# Firebaseローカルエミュレータ動作確認ガイド

**対象**: 中学生〜高校生・初心者プログラマー
**最終更新**: 2025年12月10日

---

## このガイドについて

このガイドでは、Firebase エミュレータを使って、Auth（認証）、Firestore（データベース）、Functions（サーバー機能）の動作確認を行う方法を説明します。

チケット011〜030の「ローカルエミュレータでの動作確認」を実施するためのステップバイステップガイドです。

---

## 目次

1. [エミュレータとは何か](#1-エミュレータとは何か)
2. [必要なもの](#2-必要なもの)
3. [環境構築手順](#3-環境構築手順)
4. [エミュレータの起動方法](#4-エミュレータの起動方法)
5. [各サービスの動作確認方法](#5-各サービスの動作確認方法)
6. [テストデータの作成方法](#6-テストデータの作成方法)
7. [よくあるトラブルと解決方法](#7-よくあるトラブルと解決方法)

---

## 1. エミュレータとは何か

### エミュレータの簡単な説明

**エミュレータ（Emulator）** とは、本物の環境を「まね」する仕組みです。

例えば、ゲームの世界で考えてみましょう。昔のファミコンのゲームをパソコンで遊べる「ファミコンエミュレータ」を聞いたことがあるかもしれません。これは、パソコンの中にファミコンを「まね」した環境を作って、ゲームを動かしています。

Firebaseエミュレータも同じ考え方です。本来はインターネット上のGoogleのサーバーで動いているFirebase（データベースや認証機能）を、**あなたのパソコンの中で動かす**ことができます。

### なぜエミュレータを使うのか

```
本番環境（インターネット上のサーバー）:

  あなたのパソコン → インターネット → Googleのサーバー（Firebase）
                        ↑
                    遅い、お金がかかる、失敗すると本物のデータに影響

エミュレータ（あなたのパソコン内）:

  あなたのパソコン → あなたのパソコン内のエミュレータ
                        ↑
                    速い、無料、失敗してもOK（練習用）
```

### エミュレータを使うメリット

| メリット | 説明 |
|---------|------|
| **安全** | 本番のデータを壊す心配がない |
| **無料** | Googleクラウドの利用料金がかからない |
| **速い** | インターネットを経由しないので高速 |
| **オフライン対応** | インターネットがなくても開発できる |
| **自由に実験できる** | 何度でもデータをリセットして最初からやり直せる |

---

## 2. 必要なもの

エミュレータを動かすには、以下の3つのソフトウェアが必要です。

### 2.1 Node.js（ノード・ジェイエス）

**何をするソフト？**: JavaScript（プログラミング言語）をパソコンで動かすためのソフト

**必要なバージョン**: 24.x 以上

**確認方法**:
```bash
node --version
```

`v24.x.x` のように表示されればOKです。

**インストール方法**:
1. https://nodejs.org/ にアクセス
2. 「LTS」と書かれた緑のボタンをクリックしてダウンロード
3. ダウンロードしたファイルをダブルクリックしてインストール

### 2.2 Java（ジャバ）

**何をするソフト？**: Firestoreエミュレータを動かすために必要

**必要なバージョン**: 11 以上

**確認方法**:
```bash
java -version
```

`java version "11.x.x"` または `openjdk version "11.x.x"` のように表示されればOKです。

**インストール方法**:

**Windowsの場合**:
1. https://www.oracle.com/java/technologies/downloads/ にアクセス
2. 「Java 21」または「Java 17」の「Windows」版をダウンロード
3. ダウンロードしたファイルをダブルクリックしてインストール

**Macの場合**:
```bash
brew install openjdk@17
```

### 2.3 Firebase CLI（ファイアベース・シーエルアイ）

**何をするソフト？**: Firebaseの機能をコマンドで操作するためのツール

**確認方法**:
```bash
firebase --version
```

バージョン番号が表示されればOKです。

**インストール方法**:
```bash
npm install -g firebase-tools
```

---

## 3. 環境構築手順

### ステップ1: プロジェクトフォルダに移動

コマンドプロンプト（Windows）またはターミナル（Mac）を開いて、プロジェクトフォルダに移動します。

```bash
cd C:\Users\katos\Desktop\ai_fitness_app
```

### ステップ2: Firebaseにログイン

```bash
firebase login
```

ブラウザが開くので、Googleアカウントでログインして「許可」をクリックします。

### ステップ3: Firebaseプロジェクトを選択

```bash
firebase use tokyo-list-478804-e5
```

確認:
```bash
firebase use
```

`Active Project: tokyo-list-478804-e5` と表示されればOKです。

### ステップ4: 依存パッケージをインストール

Cloud Functionsの依存パッケージをインストールします。

```bash
cd functions
npm install
cd ..
```

---

## 4. エミュレータの起動方法

### 基本的な起動方法

プロジェクトルートで以下のコマンドを実行します。

```bash
firebase emulators:start
```

### 起動成功時の画面

起動に成功すると、以下のような画面が表示されます:

```
┌─────────────────────────────────────────────────────────────┐
│ +  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4000                │
└─────────────────────────────────────────────────────────────┘

┌───────────┬────────────────┬─────────────────────────────────┐
│ Emulator  │ Host:Port      │ View in Emulator UI             │
├───────────┼────────────────┼─────────────────────────────────┤
│ Auth      │ 0.0.0.0:9099   │ http://localhost:4000/auth      │
├───────────┼────────────────┼─────────────────────────────────┤
│ Firestore │ 0.0.0.0:8080   │ http://localhost:4000/firestore │
├───────────┼────────────────┼─────────────────────────────────┤
│ Functions │ 0.0.0.0:5001   │ http://localhost:4000/functions │
├───────────┼────────────────┼─────────────────────────────────┤
│ Storage   │ 0.0.0.0:9199   │ http://localhost:4000/storage   │
└───────────┴────────────────┴─────────────────────────────────┘
```

### エミュレータUIを開く

ブラウザで以下のURLにアクセスします:

**http://localhost:4000**

Firebaseのダッシュボード画面が表示されます。ここから各サービスの状態を確認できます。

### エミュレータの種類と役割

| エミュレータ | ポート | 役割 | 用途 |
|-------------|--------|------|------|
| **Auth** | 9099 | ユーザー認証 | ログイン、登録、パスワードリセット |
| **Firestore** | 8080 | データベース | ユーザー情報、トレーニング記録の保存 |
| **Functions** | 5001 | サーバー処理 | API、バックエンドロジック |
| **Storage** | 9199 | ファイル保存 | 画像、動画など |
| **UI** | 4000 | 管理画面 | ブラウザでエミュレータを操作 |

### エミュレータの停止方法

ターミナルで `Ctrl + C` を押します。

### 特定のエミュレータだけ起動する方法

全てのエミュレータを起動すると重い場合は、必要なものだけ起動できます。

```bash
# Firestoreだけ起動
firebase emulators:start --only firestore

# FirestoreとFunctionsだけ起動
firebase emulators:start --only firestore,functions

# Auth、Firestore、Functionsを起動
firebase emulators:start --only auth,firestore,functions
```

---

## 5. 各サービスの動作確認方法

### 5.1 Auth（認証）の動作確認

#### ブラウザでの確認

1. エミュレータUIにアクセス: http://localhost:4000/auth
2. 「Add user」ボタンをクリック
3. 以下の情報を入力:
   - Email: `test@example.com`
   - Password: `password123`
4. 「Save」をクリック

ユーザー一覧にテストユーザーが表示されればOKです。

#### コードからの確認（TypeScript）

`functions/tests/` フォルダ内でテストを実行:

```bash
cd functions
npm run test:integration
```

テストが成功すれば、Authエミュレータが正常に動作しています。

#### 手動でAPIを呼び出して確認

新しいターミナルを開いて、curlコマンドでテストできます:

```bash
# ユーザー一覧を取得（管理者API）
curl http://localhost:9099/emulator/v1/projects/tokyo-list-478804-e5/accounts
```

### 5.2 Firestore（データベース）の動作確認

#### ブラウザでの確認

1. エミュレータUIにアクセス: http://localhost:4000/firestore
2. 「+ Start collection」をクリック
3. Collection ID に `test_collection` と入力
4. Document ID に `test_doc` と入力
5. フィールドを追加:
   - Field: `message`
   - Type: `string`
   - Value: `Hello, Emulator!`
6. 「Save」をクリック

コレクションとドキュメントが表示されればOKです。

#### セキュリティルールのテスト

Firestoreのセキュリティルールが正しく動作するか確認します。

```bash
cd functions
npm test -- --testPathPattern=firestore-rules
```

#### 手動でデータを確認

エミュレータUIの Firestore タブで:

1. 左側のコレクション一覧からコレクションを選択
2. ドキュメント一覧から確認したいドキュメントを選択
3. 右側にフィールドの値が表示される

### 5.3 Functions（サーバー機能）の動作確認

#### ブラウザでの確認

1. エミュレータUIにアクセス: http://localhost:4000/functions
2. 登録されているFunctionsの一覧が表示される
3. 各Functionの実行ログがリアルタイムで表示される

#### HTTPSトリガー関数のテスト

Functionsが公開するAPIエンドポイントをcurlで呼び出します。

```bash
# 例: ヘルスチェックエンドポイント
curl http://localhost:5001/tokyo-list-478804-e5/asia-northeast1/healthCheck
```

#### Callable関数のテスト

Callable関数（アプリから呼び出す関数）をテストするには、テストコードを実行します:

```bash
cd functions
npm run test:integration
```

#### ログの確認

Functions実行時のログは、エミュレータを起動したターミナルに表示されます。

また、エミュレータUI（http://localhost:4000/functions）でも確認できます。

---

## 6. テストデータの作成方法

### 6.1 エミュレータUIから手動で作成

#### ユーザーの作成（Auth）

1. http://localhost:4000/auth にアクセス
2. 「Add user」をクリック
3. 以下を入力:
   - Email: `user1@example.com`
   - Password: `test1234`
4. 「Save」をクリック

#### ユーザードキュメントの作成（Firestore）

1. http://localhost:4000/firestore にアクセス
2. 「+ Start collection」をクリック
3. Collection ID: `users`
4. Document ID: （Authで作成したユーザーのUID）
5. フィールドを追加:

| Field | Type | Value |
|-------|------|-------|
| email | string | user1@example.com |
| tosAccepted | boolean | true |
| ppAccepted | boolean | true |
| createdAt | timestamp | （現在時刻を選択） |
| updatedAt | timestamp | （現在時刻を選択） |

### 6.2 スクリプトでテストデータを作成

より効率的にテストデータを作成するには、スクリプトを使います。

`functions/tests/helpers/seed-data.ts` を作成:

```typescript
/**
 * テストデータ作成スクリプト
 * エミュレータ環境でのテスト用データを生成します
 */

import * as admin from "firebase-admin";

// エミュレータ環境の設定
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// Firebase Admin 初期化
admin.initializeApp({
  projectId: "tokyo-list-478804-e5",
});

const db = admin.firestore();
const auth = admin.auth();

/**
 * テストユーザーを作成
 */
async function createTestUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  // Auth にユーザーを作成
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
  });

  // Firestore にユーザードキュメントを作成
  await db.collection("users").doc(userRecord.uid).set({
    email,
    displayName,
    tosAccepted: true,
    ppAccepted: true,
    tosAcceptedAt: admin.firestore.Timestamp.now(),
    ppAcceptedAt: admin.firestore.Timestamp.now(),
    tosVersion: "1.0",
    ppVersion: "1.0",
    deletionScheduled: false,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    profile: {
      height: null,
      weight: null,
      gender: null,
      fitnessLevel: "beginner",
    },
  });

  console.log(`ユーザー作成完了: ${email} (UID: ${userRecord.uid})`);
  return userRecord.uid;
}

/**
 * テストセッションを作成
 */
async function createTestSession(
  userId: string,
  exerciseType: string
): Promise<string> {
  const sessionRef = db.collection("users").doc(userId).collection("sessions").doc();

  await sessionRef.set({
    sessionId: sessionRef.id,
    userId,
    exerciseType,
    startTime: admin.firestore.Timestamp.now(),
    status: "completed",
    repCount: 10,
    setCount: 3,
    averageScore: 85,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log(`セッション作成完了: ${exerciseType} (ID: ${sessionRef.id})`);
  return sessionRef.id;
}

/**
 * メイン処理
 */
async function main() {
  console.log("===== テストデータ作成開始 =====\n");

  try {
    // テストユーザー1: 一般ユーザー
    const user1Id = await createTestUser(
      "user1@example.com",
      "password123",
      "テストユーザー1"
    );
    await createTestSession(user1Id, "squat");
    await createTestSession(user1Id, "pushup");

    // テストユーザー2: プレミアムユーザー（想定）
    const user2Id = await createTestUser(
      "premium@example.com",
      "password123",
      "プレミアムユーザー"
    );
    await createTestSession(user2Id, "armcurl");
    await createTestSession(user2Id, "sideraise");
    await createTestSession(user2Id, "shoulderpress");

    // テストユーザー3: 新規ユーザー（セッションなし）
    await createTestUser(
      "newuser@example.com",
      "password123",
      "新規ユーザー"
    );

    console.log("\n===== テストデータ作成完了 =====");
    console.log("\n作成したユーザー:");
    console.log("- user1@example.com (password123)");
    console.log("- premium@example.com (password123)");
    console.log("- newuser@example.com (password123)");

  } catch (error) {
    console.error("エラー:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
```

スクリプトの実行方法:

```bash
cd functions
npx ts-node --project tsconfig.json tests/helpers/seed-data.ts
```

### 6.3 データのインポート・エクスポート

テストデータを保存しておいて、後から再利用できます。

#### データを保存しながらエミュレータを終了

```bash
firebase emulators:start --export-on-exit=./emulator-data
```

エミュレータを `Ctrl + C` で終了すると、`emulator-data` フォルダにデータが保存されます。

#### 保存したデータを読み込んで起動

```bash
firebase emulators:start --import=./emulator-data
```

これで、前回終了時のデータが復元された状態で起動します。

#### 両方を組み合わせる（推奨）

```bash
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

これで、起動時にデータを読み込み、終了時に自動保存されます。

---

## 7. よくあるトラブルと解決方法

### エミュレータが起動しない

#### エラー: `Port 8080 is already in use`

**原因**: ポート8080が他のプログラムに使われている

**解決方法（Windows）**:
```bash
# ポートを使っているプログラムを探す
netstat -ano | findstr :8080

# 表示されたPID（数字）でプログラムを終了
taskkill /PID <PIDの数字> /F
```

**解決方法（Mac/Linux）**:
```bash
# ポートを使っているプログラムを探す
lsof -i :8080

# 表示されたPIDでプログラムを終了
kill -9 <PIDの数字>
```

#### エラー: `java is not installed` または `Could not find java`

**原因**: Javaがインストールされていない、またはパスが通っていない

**解決方法**:
1. Javaをインストール（セクション2.2参照）
2. インストール後、ターミナルを再起動
3. `java -version` で確認

**Windowsで環境変数を設定する場合**:
1. 「システムのプロパティ」→「環境変数」を開く
2. 「Path」に Javaの bin フォルダを追加
   例: `C:\Program Files\Java\jdk-17\bin`

#### エラー: `command not found: firebase`

**原因**: Firebase CLIがインストールされていない

**解決方法**:
```bash
npm install -g firebase-tools
```

### テストが失敗する

#### エラー: `ECONNREFUSED localhost:8080`

**原因**: Firestoreエミュレータに接続できない

**解決方法**:
1. 別のターミナルでエミュレータが起動しているか確認
2. エミュレータを起動: `firebase emulators:start`
3. 起動完了を待ってからテストを実行

#### エラー: `Cannot find module`

**原因**: 依存パッケージがインストールされていない

**解決方法**:
```bash
cd functions
npm install
```

#### エラー: `Timeout - Async callback was not invoked`

**原因**: テストがタイムアウトした

**解決方法**:
1. エミュレータが正常に動作しているか確認
2. ネットワーク接続を確認
3. エミュレータを再起動してからテストを再実行

### パフォーマンスの問題

#### エミュレータが遅い

**解決方法1**: 必要なエミュレータだけ起動
```bash
firebase emulators:start --only firestore,functions
```

**解決方法2**: 古いデータを削除
```bash
# emulator-dataフォルダを削除
rm -rf emulator-data

# 再起動
firebase emulators:start
```

**解決方法3**: PCを再起動

#### メモリ不足エラー

**症状**:
```
JavaScript heap out of memory
```

**解決方法（Windows）**:
```bash
set NODE_OPTIONS=--max-old-space-size=4096
firebase emulators:start
```

**解決方法（Mac/Linux）**:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
firebase emulators:start
```

### データが消えてしまう

#### 原因

エミュレータを停止すると、デフォルトではデータは消えます。

#### 解決方法

データを保存するオプションを使います:

```bash
firebase emulators:start --export-on-exit=./emulator-data --import=./emulator-data
```

### ブラウザでUIが表示されない

#### 原因

エミュレータUIのポートがブロックされている可能性があります。

#### 解決方法

1. http://localhost:4000 にアクセスできるか確認
2. ファイアウォールの設定を確認
3. 別のブラウザで試す
4. `firebase.json` のUIポートを変更してみる:

```json
{
  "emulators": {
    "ui": {
      "port": 4001
    }
  }
}
```

---

## コマンド早見表

### エミュレータ操作

| コマンド | 説明 |
|---------|------|
| `firebase emulators:start` | 全エミュレータを起動 |
| `firebase emulators:start --only firestore,functions` | 指定したエミュレータのみ起動 |
| `firebase emulators:start --import=./emulator-data` | データを読み込んで起動 |
| `firebase emulators:start --export-on-exit=./emulator-data` | 終了時にデータを保存 |
| `Ctrl + C` | エミュレータを停止 |

### テスト実行

| コマンド | 説明 |
|---------|------|
| `cd functions && npm test` | ユニットテストを実行 |
| `cd functions && npm run test:integration` | 統合テストを実行（要エミュレータ） |
| `cd functions && npm run test:coverage` | カバレッジレポートを出力 |
| `cd functions && npm run test:all` | 全テストを実行 |

### エミュレータURL

| サービス | URL |
|---------|-----|
| エミュレータUI | http://localhost:4000 |
| Auth | http://localhost:4000/auth |
| Firestore | http://localhost:4000/firestore |
| Functions | http://localhost:4000/functions |
| Storage | http://localhost:4000/storage |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `01_開発環境セットアップ.md` | 開発環境の初期構築手順 |
| `02_テストの実行方法.md` | テストコードの書き方と実行方法 |
| `03_Cloud_Functionsの開発.md` | APIの開発方法 |
| `05_トラブルシューティング.md` | その他の問題解決方法 |
| `08_Firebase_Emulator_Test_Guide.md` | エミュレータテストの詳細ガイド |

---

## 用語集

| 用語 | 読み方 | 意味 |
|------|--------|------|
| エミュレータ | - | 本番環境をまねた開発用の環境 |
| Auth | オース | ユーザー認証（ログイン）の機能 |
| Firestore | ファイアストア | Firebaseのデータベース |
| Functions | ファンクションズ | サーバー側で動くプログラム |
| ポート | - | プログラムが通信に使う出入口の番号 |
| localhost | ローカルホスト | 自分のパソコン自身を指すアドレス |
| UID | ユーアイディー | ユーザーを識別する一意のID |
| curl | カール | コマンドラインでHTTPリクエストを送るツール |

---

## 次のステップ

エミュレータでの動作確認ができるようになったら:

1. **チケット011〜030の動作確認** - 各機能をエミュレータでテスト
2. **テストコードの作成** - 自動テストを書いて品質を確保
3. **本番デプロイ** - 動作確認が完了したら本番環境にデプロイ

---

**お疲れさまでした！**

このガイドに従えば、エミュレータを使った開発・テストができるようになります。
分からないことがあれば、遠慮なく質問してください。
