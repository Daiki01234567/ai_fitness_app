# Cloud Functionsの開発ガイド

**対象**: 中学生〜高校生・初心者プログラマー
**最終更新**: 2025年12月10日

---

## このガイドについて

このガイドでは、Firebase Cloud Functions（サーバー側のプログラム）を開発する方法を説明します。

**Cloud Functions** とは、サーバーレスで動くプログラムのことです。サーバーを用意しなくても、Google のクラウド上でプログラムを実行できます。

---

## Cloud Functionsとは？

### 通常のサーバーとの違い

**通常のサーバー**:
- サーバーマシンを常に起動しておく必要がある
- 利用者が少なくてもサーバー代がかかる
- サーバーの管理（アップデート、セキュリティ対策）が大変

**Cloud Functions（サーバーレス）**:
- プログラムが必要な時だけ実行される
- 使った分だけ料金がかかる
- サーバーの管理は Google が自動でやってくれる

### このプロジェクトでのCloud Functionsの役割

```
モバイルアプリ (Flutter)
    ↓ HTTPSでAPIを呼び出し
Cloud Function (Tokyo リージョン)
    ↓ データの読み書き
Firestore データベース
    ↓ 分析データを送信
BigQuery 分析基盤
```

---

## プロジェクト構造

```
functions/
├── src/
│   ├── index.ts              # エントリーポイント（全関数をエクスポート）
│   ├── api/                  # HTTPSで呼べるAPI関数
│   │   ├── consent/          # 同意管理API
│   │   │   ├── record.ts     # 同意の記録
│   │   │   ├── revoke.ts     # 同意の撤回
│   │   │   └── status.ts     # 同意状態の取得
│   │   ├── users/            # ユーザー管理API
│   │   │   ├── updateProfile.ts  # プロフィール更新
│   │   │   └── getProfile.ts     # プロフィール取得
│   │   └── gdpr/             # GDPR対応API
│   │       ├── deleteData.ts     # データ削除
│   │       ├── exportData.ts     # データエクスポート
│   │       └── recoverData.ts    # データ復元
│   ├── auth/                 # 認証トリガー
│   │   ├── onCreate.ts       # ユーザー作成時
│   │   └── onDelete.ts       # ユーザー削除時
│   ├── middleware/           # 共通処理
│   │   ├── auth.ts           # 認証チェック
│   │   ├── validation.ts     # 入力検証
│   │   └── rateLimit.ts      # レート制限
│   ├── services/             # ビジネスロジック
│   │   ├── bigquery.ts       # BigQuery操作
│   │   └── cloudTasks.ts     # CloudTasks操作
│   ├── types/                # TypeScript型定義
│   │   └── index.ts
│   └── utils/                # ユーティリティ
│       ├── logger.ts         # ログ出力
│       ├── errors.ts         # エラー処理
│       └── crypto.ts         # 暗号化
└── tests/                    # テストコード
    ├── api/
    ├── auth/
    └── __mocks__/
```

---

## Cloud Functions の種類

このプロジェクトでは、主に3種類のCloud Functionsを使います。

### 1. HTTPSトリガー関数（Callable Functions）

クライアントアプリから HTTPS で呼び出せる関数です。

**例**: プロフィール更新API

```typescript
// functions/src/api/users/updateProfile.ts
import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";

export const updateProfile = functions.https.onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "認証が必要です"
    );
  }

  const userId = request.auth.uid;
  const data = request.data;

  // Firestoreに保存
  await getFirestore()
    .collection("users")
    .doc(userId)
    .update({
      displayName: data.displayName,
      updatedAt: new Date(),
    });

  return { success: true };
});
```

**使い方（クライアント側）**:
```dart
// Flutter
final result = await FirebaseFunctions.instance
  .httpsCallable('updateProfile')
  .call({'displayName': '新しい名前'});
```

### 2. 認証トリガー関数

ユーザーが作成・削除されたときに自動で実行される関数です。

**例**: ユーザー作成時の処理

```typescript
// functions/src/auth/onCreate.ts
import * as functions from "firebase-functions/v2/identity";
import { getFirestore } from "firebase-admin/firestore";

export const authOnCreate = functions.beforeUserCreated(async (event) => {
  const user = event.data;

  // Firestoreにユーザードキュメントを作成
  await getFirestore()
    .collection("users")
    .doc(user.uid)
    .set({
      email: user.email,
      createdAt: new Date(),
      tosAccepted: false,
      ppAccepted: false,
    });
});
```

### 3. Firestoreトリガー関数

Firestoreのデータが作成・更新・削除されたときに自動で実行される関数です。

**例**: セッションデータが作成されたらBigQueryに同期

```typescript
import * as functions from "firebase-functions/v2/firestore";

export const onSessionCreate = functions.onDocumentCreated(
  "users/{userId}/sessions/{sessionId}",
  async (event) => {
    const sessionData = event.data.data();

    // BigQueryにデータを送信
    await sendToBigQuery(sessionData);
  }
);
```

---

## 新しいAPI関数の作り方

### ステップ1: ファイルを作成

例: ユーザーの目標体重を設定するAPI

```bash
# functions/src/api/users/setGoalWeight.ts を作成
touch functions/src/api/users/setGoalWeight.ts
```

### ステップ2: 関数を実装

```typescript
// functions/src/api/users/setGoalWeight.ts
import * as functions from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

// 入力データのバリデーションスキーマ
const schema = z.object({
  goalWeight: z.number().min(30).max(300), // 30kg〜300kg
});

export const setGoalWeight = functions.onCall(async (request) => {
  // 1. 認証チェック
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "認証が必要です"
    );
  }

  // 2. 入力バリデーション
  const validationResult = schema.safeParse(request.data);
  if (!validationResult.success) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "入力データが不正です: " + validationResult.error.message
    );
  }

  const userId = request.auth.uid;
  const { goalWeight } = validationResult.data;

  // 3. Firestoreに保存
  try {
    await getFirestore()
      .collection("users")
      .doc(userId)
      .update({
        goalWeight: goalWeight,
        updatedAt: new Date(),
      });

    // 4. ログ出力
    functions.logger.info("Goal weight updated", {
      userId,
      goalWeight,
    });

    return { success: true, goalWeight };
  } catch (error) {
    // 5. エラーハンドリング
    functions.logger.error("Failed to update goal weight", {
      userId,
      error,
    });
    throw new functions.https.HttpsError(
      "internal",
      "目標体重の設定に失敗しました"
    );
  }
});
```

### ステップ3: エクスポート

```typescript
// functions/src/index.ts
// 既存のエクスポートに追加
export { setGoalWeight } from "./api/users/setGoalWeight";
```

### ステップ4: テストを書く

```typescript
// functions/tests/api/users/setGoalWeight.test.ts
import { setGoalWeight } from "../../../src/api/users/setGoalWeight";

describe("setGoalWeight", () => {
  test("目標体重が正しく設定される", async () => {
    const mockRequest = {
      auth: { uid: "test-user-123" },
      data: { goalWeight: 70 },
    };

    const result = await setGoalWeight(mockRequest);

    expect(result.success).toBe(true);
    expect(result.goalWeight).toBe(70);
  });

  test("未認証ユーザーはエラー", async () => {
    const mockRequest = {
      auth: null,
      data: { goalWeight: 70 },
    };

    await expect(setGoalWeight(mockRequest)).rejects.toThrow(
      "unauthenticated"
    );
  });

  test("範囲外の体重はエラー", async () => {
    const mockRequest = {
      auth: { uid: "test-user-123" },
      data: { goalWeight: 500 }, // 範囲外
    };

    await expect(setGoalWeight(mockRequest)).rejects.toThrow(
      "invalid-argument"
    );
  });
});
```

### ステップ5: テスト実行

```bash
cd functions
npm test
```

### ステップ6: エミュレータで動作確認

```bash
# プロジェクトルートで
firebase emulators:start
```

ブラウザで http://localhost:4000 を開いて、Functionsタブで関数が表示されるか確認。

---

## API開発のベストプラクティス

### 1. 必ず認証チェックを入れる

```typescript
// ✅ 良い
if (!request.auth) {
  throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
}

// ❌ 悪い（認証チェックなし）
// セキュリティリスク！
```

### 2. 入力値を必ずバリデーションする

```typescript
// ✅ 良い: Zodを使ったバリデーション
const schema = z.object({
  age: z.number().min(13).max(120),
  name: z.string().min(1).max(50),
});

const result = schema.safeParse(request.data);
if (!result.success) {
  throw new functions.https.HttpsError(
    "invalid-argument",
    result.error.message
  );
}

// ❌ 悪い: バリデーションなし
const age = request.data.age; // ← 何でも入る！
```

### 3. エラーハンドリングを適切に

```typescript
// ✅ 良い
try {
  await firestore.collection("users").doc(userId).update(data);
} catch (error) {
  functions.logger.error("Update failed", { userId, error });
  throw new functions.https.HttpsError(
    "internal",
    "更新に失敗しました"
  );
}

// ❌ 悪い: エラーを握りつぶす
try {
  await firestore.collection("users").doc(userId).update(data);
} catch (error) {
  // 何もしない ← NG
}
```

### 4. ログを適切に出力する

```typescript
// ✅ 良い: 構造化ログ
functions.logger.info("Profile updated", {
  userId: "abc123",
  fields: ["displayName", "age"],
  duration: 250, // ms
});

// ❌ 悪い: センシティブ情報をログに出す
functions.logger.info("Updated: " + JSON.stringify(personalData));
// パスワードやメールアドレスをログに出してはいけない
```

### 5. レート制限を実装する

```typescript
import { rateLimit } from "../../middleware/rateLimit";

export const sendMessage = functions.onCall(
  async (request) => {
    // レート制限: 1分間に10回まで
    await rateLimit(request.auth.uid, "sendMessage", 10, 60);

    // 実際の処理
    // ...
  }
);
```

---

## TypeScript の基礎

### 型定義

TypeScript では、変数やパラメータに「型」を指定します。

```typescript
// 基本的な型
const name: string = "太郎";          // 文字列
const age: number = 15;               // 数値
const isStudent: boolean = true;      // 真偽値

// オブジェクトの型
interface User {
  userId: string;
  displayName: string;
  age: number;
  email?: string;  // ? = オプション（省略可能）
}

const user: User = {
  userId: "abc123",
  displayName: "太郎",
  age: 15,
  // email は省略可能
};
```

### async/await（非同期処理）

データベースへのアクセスなど、時間がかかる処理は `async/await` を使います。

```typescript
// 非同期関数の定義
async function getUser(userId: string): Promise<User> {
  // await = 処理が終わるまで待つ
  const doc = await firestore.collection("users").doc(userId).get();
  return doc.data() as User;
}

// 使い方
const user = await getUser("abc123");
console.log(user.displayName);
```

**重要**: `await` を使うには、関数に `async` をつける必要があります。

```typescript
// ✅ 良い
async function myFunction() {
  const result = await someAsyncOperation();
}

// ❌ 悪い: asyncがない
function myFunction() {
  const result = await someAsyncOperation(); // エラー！
}
```

---

## デバッグ方法

### 1. ログを使ったデバッグ

```typescript
import * as functions from "firebase-functions/v2";

export const myFunction = functions.onCall(async (request) => {
  functions.logger.info("Function called", { data: request.data });

  // 途中経過を確認
  const result = calculateSomething();
  functions.logger.info("Calculated", { result });

  return result;
});
```

**ログの確認方法**:
```bash
# エミュレータのログを見る
firebase emulators:start

# 別のターミナルで関数を呼び出し
# → エミュレータのターミナルにログが表示される
```

### 2. テストでデバッグ

```typescript
test("デバッグ用", async () => {
  const input = { goalWeight: 70 };
  console.log("Input:", input);  // デバッグ出力

  const result = await setGoalWeight({ auth: { uid: "test" }, data: input });
  console.log("Result:", result);  // デバッグ出力

  expect(result.success).toBe(true);
});
```

```bash
# テスト実行
npm test

# 特定のテストだけ実行
npm test -- -t "デバッグ用"
```

---

## よくあるエラーと解決法

### エラー: `Module not found`

**原因**: インポートパスが間違っている

```typescript
// ❌ 間違い
import { something } from "./wrong/path";

// ✅ 正しい
import { something } from "../correct/path";
```

**解決法**: ファイルの場所を確認して、正しいパスを指定する。

---

### エラー: `Property 'xxx' does not exist on type 'yyy'`

**原因**: 型定義が間違っている

```typescript
// ❌ 間違い
interface User {
  name: string;
}

const user: User = { displayName: "太郎" }; // エラー！

// ✅ 正しい
interface User {
  displayName: string;  // プロパティ名を合わせる
}
```

---

### エラー: `Function returned undefined`

**原因**: 関数が値を返していない

```typescript
// ❌ 間違い
export const myFunction = functions.onCall(async (request) => {
  await doSomething();
  // return がない！
});

// ✅ 正しい
export const myFunction = functions.onCall(async (request) => {
  await doSomething();
  return { success: true };  // 必ず値を返す
});
```

---

### エラー: `DEADLINE_EXCEEDED` （タイムアウト）

**原因**: 処理に時間がかかりすぎている

**解決法**:
1. 重い処理を最適化する
2. タイムアウト時間を延長する

```typescript
import * as functions from "firebase-functions/v2";

export const heavyFunction = functions.runWith({
  timeoutSeconds: 300,  // 5分（デフォルトは60秒）
}).onCall(async (request) => {
  // 重い処理
});
```

---

### エラー: `UNAUTHENTICATED`

**原因**: 認証されていないユーザーがAPIを呼び出した

**確認項目**:
1. クライアント側でログインしているか
2. トークンが期限切れになっていないか

```typescript
// クライアント側（Flutter）で確認
final user = FirebaseAuth.instance.currentUser;
if (user == null) {
  print("ログインしていません");
} else {
  print("ログイン中: ${user.uid}");
}
```

---

## デプロイ

### ローカルテスト → デプロイの流れ

```bash
# 1. Lint（コードスタイルチェック）
cd functions
npm run lint

# 2. テスト実行
npm test

# 3. ビルド
npm run build

# 4. エミュレータで動作確認
cd ..
firebase emulators:start

# 5. デプロイ（本番環境）
firebase deploy --only functions
```

### 特定の関数だけデプロイ

```bash
# updateProfile 関数だけデプロイ
firebase deploy --only functions:updateProfile

# 複数指定
firebase deploy --only functions:updateProfile,functions:getProfile
```

---

## パフォーマンス最適化

### 1. コールドスタート対策

関数が初めて呼ばれるとき（コールドスタート）は起動に時間がかかります。

**対策**: グローバル変数でFirestoreインスタンスを再利用

```typescript
import { getFirestore } from "firebase-admin/firestore";

// ✅ 良い: グローバル変数で再利用
const firestore = getFirestore();

export const myFunction = functions.onCall(async (request) => {
  await firestore.collection("users").doc(userId).get();
  // 2回目以降は高速
});

// ❌ 悪い: 毎回初期化
export const myFunction = functions.onCall(async (request) => {
  const firestore = getFirestore();  // 毎回初期化される
  await firestore.collection("users").doc(userId).get();
});
```

### 2. 並列処理

複数の非同期処理は `Promise.all()` で並列実行

```typescript
// ✅ 良い: 並列実行（速い）
const [user, sessions, consents] = await Promise.all([
  firestore.collection("users").doc(userId).get(),
  firestore.collection("users").doc(userId).collection("sessions").get(),
  firestore.collection("consents").where("userId", "==", userId).get(),
]);

// ❌ 悪い: 順次実行（遅い）
const user = await firestore.collection("users").doc(userId).get();
const sessions = await firestore.collection("users").doc(userId).collection("sessions").get();
const consents = await firestore.collection("consents").where("userId", "==", userId).get();
```

### 3. Firestoreの読み取り回数を減らす

```typescript
// ✅ 良い: 1回の読み取り
const userDoc = await firestore.collection("users").doc(userId).get();
const userData = userDoc.data();
console.log(userData.displayName);
console.log(userData.age);

// ❌ 悪い: 2回読み取り
const name = (await firestore.collection("users").doc(userId).get()).data().displayName;
const age = (await firestore.collection("users").doc(userId).get()).data().age;
```

---

## セキュリティチェックリスト

新しいAPIを作る際は、必ずこのチェックリストを確認してください。

- [ ] 認証チェック（`request.auth` の確認）
- [ ] 入力バリデーション（Zodスキーマ）
- [ ] 本人確認（`request.auth.uid` とリソースの所有者が一致）
- [ ] エラーハンドリング（try-catch）
- [ ] ログ出力（センシティブ情報を除外）
- [ ] レート制限（必要に応じて）
- [ ] ユニットテストを作成
- [ ] エミュレータで動作確認

---

## 次のステップ

Cloud Functionsの開発方法が分かったら:

1. **04_デプロイ方法.md** - 本番環境への公開
2. **05_トラブルシューティング.md** - 困ったときの対処法
3. **API設計書** - `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md`

---

## 参考資料

- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod（バリデーションライブラリ）](https://zod.dev/)
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md`

---

**おめでとうございます！** 🎉

Cloud Functionsの開発方法をマスターしました。
これで新しいAPIを作成し、アプリの機能を拡張できます！
