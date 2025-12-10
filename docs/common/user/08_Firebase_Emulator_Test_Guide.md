# Firebase Emulator ローカルテストガイド

**対象**: 中学生〜高校生・初心者プログラマー
**最終更新**: 2025年12月10日

---

## このガイドについて

このガイドでは、Firebase Emulator（エミュレータ）を使って、Cloud Functionsをローカル環境でテストする方法を説明します。

**エミュレータ** とは、本番環境（実際のユーザーが使う環境）を自分のパソコン上で再現する仕組みです。エミュレータを使うと、本番環境に影響を与えずに開発やテストができます。

---

## 目次

1. [エミュレータを使うメリット](#エミュレータを使うメリット)
2. [前提条件](#前提条件)
3. [エミュレータの起動](#エミュレータの起動)
4. [Cloud Functionsのテスト](#cloud-functionsのテスト)
5. [エミュレータUIの使い方](#エミュレータuiの使い方)
6. [トラブルシューティング](#トラブルシューティング)
7. [参考情報](#参考情報)

---

## エミュレータを使うメリット

### なぜエミュレータが必要なのか

| メリット | 説明 |
|---------|------|
| **安全** | 本番のデータを壊す心配がない |
| **無料** | クラウドの利用料金がかからない |
| **速い** | ネットワーク遅延がない |
| **オフライン対応** | インターネットなしでも開発できる |
| **デバッグしやすい** | ログがすぐ見える、データを自由に変更できる |

### 本番環境との違い

```
本番環境:
  あなたのパソコン → インターネット → Googleのサーバー → Firebase
                     (遅い、お金かかる、失敗するとユーザーに影響)

エミュレータ:
  あなたのパソコン → あなたのパソコン内のエミュレータ
                     (速い、無料、安全)
```

---

## 前提条件

### 必要なソフトウェア

以下がインストールされていることを確認してください。

#### 1. Node.js（バージョン 24.x）

```bash
# バージョン確認
node --version
```

`v24.x.x` のように表示されればOKです。

**インストールされていない場合**:
https://nodejs.org/ から LTS版をダウンロードしてインストール

#### 2. Firebase CLI

```bash
# バージョン確認
firebase --version
```

バージョン番号が表示されればOKです。

**インストールされていない場合**:
```bash
npm install -g firebase-tools
```

#### 3. Java（Firestoreエミュレータ用）

```bash
# バージョン確認
java -version
```

`java version "11.x.x"` のように表示されればOKです。

**インストールされていない場合**:
- Windows: https://www.oracle.com/java/technologies/downloads/ からダウンロード
- Mac: `brew install openjdk@11`

### プロジェクトのセットアップ確認

```bash
# プロジェクトルートに移動
cd C:\Users\236149\Desktop\ai_fitness_app

# Firebaseプロジェクトの確認
firebase use
```

`Active Project: tokyo-list-478804-e5` と表示されればOKです。

### 依存パッケージのインストール

```bash
# Cloud Functionsの依存パッケージ
cd functions
npm install

# プロジェクトルートに戻る
cd ..
```

---

## エミュレータの起動

### ステップ1: プロジェクトルートに移動

```bash
cd C:\Users\236149\Desktop\ai_fitness_app
```

### ステップ2: エミュレータを起動

```bash
firebase emulators:start
```

### ステップ3: 起動ログを確認

起動に成功すると、以下のようなログが表示されます:

```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
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

### ステップ4: エミュレータUIを開く

ブラウザで http://localhost:4000 にアクセスします。

Firebaseのロゴと各エミュレータの状態が表示されればOKです。

### エミュレータの種類と役割

| エミュレータ | ポート | 役割 |
|-------------|--------|------|
| **Auth** | 9099 | ユーザー認証（ログイン・登録） |
| **Firestore** | 8080 | データベース |
| **Functions** | 5001 | サーバー側のプログラム（API） |
| **Storage** | 9199 | ファイル保存 |
| **UI** | 4000 | 管理画面（ブラウザで見る画面） |

### エミュレータの停止方法

エミュレータを停止するには、ターミナルで `Ctrl + C` を押します。

---

## Cloud Functionsのテスト

### テストの種類

このプロジェクトには2種類のテストがあります:

| テスト種類 | コマンド | 説明 |
|-----------|---------|------|
| **ユニットテスト** | `npm test` | 関数単体のテスト（エミュレータ不要） |
| **統合テスト** | `npm run test:integration` | 複数機能を組み合わせたテスト（エミュレータ必要） |

### ユニットテストの実行

ユニットテストは、エミュレータなしで実行できます。

```bash
# functionsフォルダに移動
cd functions

# ユニットテストを実行
npm test
```

#### テスト結果の見方

**成功した場合**:
```
PASS  tests/api/users/updateProfile.test.ts
  ✓ プロフィール更新が成功する (45ms)
  ✓ 未認証ユーザーは更新できない (12ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        3.5s
```

**失敗した場合**:
```
FAIL  tests/api/users/updateProfile.test.ts
  ✕ プロフィール更新が成功する (52ms)

  ● プロフィール更新が成功する
    expect(received).toEqual(expected)
    Expected: 200
    Received: 401

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 passed, 2 total
```

### 統合テストの実行

統合テストは、エミュレータが起動している状態で実行します。

**ターミナル1（エミュレータ用）**:
```bash
cd C:\Users\236149\Desktop\ai_fitness_app
firebase emulators:start
```

**ターミナル2（テスト用）**:
```bash
cd C:\Users\236149\Desktop\ai_fitness_app\functions
npm run test:integration
```

### その他のテストコマンド

```bash
# ウォッチモード（ファイル変更時に自動でテスト実行）
npm run test:watch

# カバレッジレポート（どこがテストされているか確認）
npm run test:coverage

# 特定のテストファイルだけ実行
npm test -- tests/api/users/updateProfile.test.ts

# 特定のテスト名で絞り込み
npm test -- -t "プロフィール更新"

# 全てのテストを実行（ユニット + 統合）
npm run test:all
```

---

## エミュレータUIの使い方

### アクセス方法

ブラウザで http://localhost:4000 を開きます。

### Firestore（データベース）の操作

1. **データの確認**: http://localhost:4000/firestore
2. **データの追加**: 「+ ドキュメントを追加」をクリック
3. **データの削除**: ドキュメントを選択して削除アイコンをクリック

### Auth（認証）の操作

1. **ユーザー一覧**: http://localhost:4000/auth
2. **ユーザーの追加**: 「ユーザーを追加」をクリック
3. **ユーザーの削除**: ユーザーを選択して削除

### Functions（関数）のログ確認

1. **ログ一覧**: http://localhost:4000/functions
2. **ログの検索**: 検索ボックスでフィルタリング
3. **エラーの確認**: 赤色で表示されるログがエラー

### データのインポート・エクスポート

```bash
# データを保存しながら終了
firebase emulators:start --export-on-exit=./emulator-data

# 保存したデータを読み込んで起動
firebase emulators:start --import=./emulator-data
```

---

## トラブルシューティング

### エミュレータが起動しない場合

#### エラー: `Port 8080 is already in use`

**原因**: ポート8080が別のプログラムに使われている

**解決法（Windows）**:
```bash
# ポートを使っているプログラムを探す
netstat -ano | findstr :8080

# 表示されたPID（数字）を使ってプログラムを終了
taskkill /PID <表示されたPID> /F
```

**解決法（Mac/Linux）**:
```bash
# ポートを使っているプログラムを探す
lsof -i :8080

# 表示されたPIDを使ってプログラムを終了
kill -9 <PID>
```

#### エラー: `java is not installed`

**原因**: Javaがインストールされていない

**解決法**:
- Windows: https://www.oracle.com/java/technologies/downloads/ からJava 11以上をインストール
- Mac: `brew install openjdk@11`

インストール後、確認:
```bash
java -version
```

#### エラー: `command not found: firebase`

**原因**: Firebase CLIがインストールされていない

**解決法**:
```bash
npm install -g firebase-tools
```

### テストが失敗する場合

#### エラー: `ECONNREFUSED localhost:8080`

**原因**: Firestoreエミュレータに接続できない

**解決法**:
1. エミュレータが起動しているか確認
2. 別のターミナルで `firebase emulators:start` を実行

#### エラー: `Cannot find module`

**原因**: 依存パッケージがインストールされていない

**解決法**:
```bash
cd functions
npm install
```

#### エラー: `Timeout - Async callback was not invoked`

**原因**: テストがタイムアウト（時間切れ）した

**解決法**:
1. エミュレータが正しく起動しているか確認
2. エミュレータを再起動してみる

### パフォーマンス問題

#### エミュレータが遅い

**解決法1**: 必要なエミュレータだけ起動
```bash
# Firestoreだけ起動
firebase emulators:start --only firestore

# FirestoreとFunctionsだけ起動
firebase emulators:start --only firestore,functions
```

**解決法2**: 古いデータを削除
```bash
# emulator-dataフォルダを削除して再起動
rm -rf emulator-data
firebase emulators:start
```

#### メモリ不足エラー

**症状**:
```
JavaScript heap out of memory
```

**解決法（Windows）**:
```bash
set NODE_OPTIONS=--max-old-space-size=4096
firebase emulators:start
```

**解決法（Mac/Linux）**:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
firebase emulators:start
```

### firebase.json の設定

このプロジェクトの `firebase.json` には、以下のエミュレータ設定があります:

```json
{
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "0.0.0.0"
    },
    "firestore": {
      "port": 8080,
      "host": "0.0.0.0"
    },
    "functions": {
      "port": 5001,
      "host": "0.0.0.0"
    },
    "storage": {
      "port": 9199,
      "host": "0.0.0.0"
    },
    "ui": {
      "enabled": true,
      "port": 4000,
      "host": "0.0.0.0"
    }
  }
}
```

**ポートを変更したい場合**:
`firebase.json` の `port` の値を変更してください。

---

## 参考情報

### 公式ドキュメント

| ドキュメント | URL |
|------------|-----|
| Firebase Emulator Suite | https://firebase.google.com/docs/emulator-suite |
| Functions テスト | https://firebase.google.com/docs/functions/unit-testing |
| Firestore Rules テスト | https://firebase.google.com/docs/rules/unit-tests |

### プロジェクト内の関連ファイル

| ファイル | 説明 |
|---------|------|
| `firebase.json` | エミュレータの設定ファイル |
| `functions/package.json` | テストスクリプトの定義 |
| `functions/tests/` | ユニットテストのコード |
| `firebase/firestore.rules` | Firestoreセキュリティルール |

### 関連ガイド

| ガイド | 内容 |
|-------|------|
| `01_開発環境セットアップ.md` | 開発環境の構築手順 |
| `02_テストの実行方法.md` | テストの詳しい実行方法 |
| `03_Cloud_Functionsの開発.md` | APIの開発方法 |
| `05_トラブルシューティング.md` | その他の問題解決 |

---

## コマンドまとめ

### エミュレータ関連

```bash
# エミュレータ起動
firebase emulators:start

# 特定のエミュレータだけ起動
firebase emulators:start --only firestore,functions

# データを保存しながら終了
firebase emulators:start --export-on-exit=./emulator-data

# 保存データを読み込んで起動
firebase emulators:start --import=./emulator-data

# エミュレータ停止
Ctrl + C
```

### テスト関連

```bash
# functionsフォルダに移動
cd functions

# ユニットテスト
npm test

# 統合テスト（要エミュレータ起動）
npm run test:integration

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage

# 全テスト
npm run test:all
```

---

## 用語集

| 用語 | 読み方 | 意味 |
|------|--------|------|
| **エミュレータ** | - | 本番環境を真似た開発用の環境 |
| **ポート** | - | プログラムが通信に使う出入口の番号 |
| **ユニットテスト** | - | 関数やクラス単体のテスト |
| **統合テスト** | - | 複数の機能を組み合わせたテスト |
| **カバレッジ** | - | コードのどこがテストされているかの割合 |
| **localhost** | ローカルホスト | 自分のパソコン自身を指すアドレス |

---

## 次のステップ

エミュレータでのテストができるようになったら:

1. **02_テストの実行方法.md** - テストの詳しい書き方
2. **03_Cloud_Functionsの開発.md** - 新しいAPIの作り方
3. **04_デプロイ方法.md** - 本番環境への公開方法

---

**お疲れさまでした！**

エミュレータを使ったローカルテストの方法をマスターしました。
これで安全に開発を進められます！
