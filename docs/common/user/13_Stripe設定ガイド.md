# Stripe 設定ガイド

このガイドでは、AIフィットネスアプリでStripe（決済サービス）を使えるようにするための設定方法を説明します。

初めてStripeを使う人でもわかるように、ステップバイステップで説明しています。

---

## 目次

1. [Stripeとは？](#1-stripeとは)
2. [Stripeアカウントの作成](#2-stripeアカウントの作成)
3. [APIキーの取得](#3-apiキーの取得)
4. [Firebase Secret Managerへの登録](#4-firebase-secret-managerへの登録)
5. [Stripe Webhookの設定](#5-stripe-webhookの設定)
6. [テスト環境と本番環境の切り替え](#6-テスト環境と本番環境の切り替え)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. Stripeとは？

Stripeは、インターネットでの支払いを簡単に処理できるサービスです。

**Stripeを使うメリット**:
- クレジットカード情報を直接扱わなくていい（安全）
- 世界中で使われている信頼性の高いサービス
- テスト環境が用意されているので、実際にお金を使わずにテストできる

**このアプリでの使い方**:
- ユーザーが月額500円のプレミアムプランに加入するときに使います
- Stripeが決済ページを提供してくれるので、カード情報の管理はStripeがやってくれます

---

## 2. Stripeアカウントの作成

まずは、Stripeのアカウントを作りましょう。

### 手順

1. **Stripeの公式サイトにアクセス**

   ブラウザで以下のURLを開きます：
   ```
   https://dashboard.stripe.com/register
   ```

2. **必要な情報を入力**

   - メールアドレス
   - 氏名
   - パスワード（強いパスワードを設定してください）
   - 国（「日本」を選択）

3. **メール認証**

   登録したメールアドレスに確認メールが届きます。
   メール内のリンクをクリックして、アカウントを有効化してください。

4. **ダッシュボードにログイン**

   認証が完了したら、Stripeダッシュボードにログインできるようになります。

### 注意点

- **本番環境を使う前に**：ビジネス情報の登録が必要です（銀行口座の登録など）
- **今はテスト環境だけでOK**：開発中はテスト環境を使うので、ビジネス情報の登録は後でも大丈夫です

---

## 3. APIキーの取得

Stripeと通信するために、APIキーが必要です。
APIキーは「パスワード」のようなものだと思ってください。

### 手順

1. **Stripeダッシュボードにログイン**

   ```
   https://dashboard.stripe.com/
   ```

2. **テストモードであることを確認**

   画面右上に「テストモード」と表示されていることを確認してください。
   表示されていない場合は、スイッチをクリックしてテストモードに切り替えます。

3. **APIキーのページを開く**

   左側のメニューから「開発者」をクリックし、「APIキー」を選択します。

   または、以下のURLを直接開いてください：
   ```
   https://dashboard.stripe.com/test/apikeys
   ```

4. **シークレットキーをコピー**

   画面に2種類のキーが表示されます：

   - **公開可能キー（Publishable key）**: `pk_test_` で始まる文字列
   - **シークレットキー（Secret key）**: `sk_test_` で始まる文字列

   「シークレットキー」の「表示」ボタンをクリックして、キーをコピーしてください。

### 注意点

- **シークレットキーは絶対に他人に見せない！**
- **コードに直接書き込まない！**（次のセクションで安全な保存方法を説明します）
- テストキーは `pk_test_` や `sk_test_` で始まります
- 本番キーは `pk_live_` や `sk_live_` で始まります

---

## 4. Firebase Secret Managerへの登録

シークレットキーは、Firebase Secret Managerという安全な場所に保存します。

### なぜSecret Managerを使うの？

- キーをコードに書くと、誰かにコードを見られたときにバレてしまいます
- Secret Managerは暗号化されているので、安全に保管できます
- 環境ごと（テスト/本番）に違うキーを使えます

### 手順

1. **Firebase CLIがインストールされていることを確認**

   ターミナル（コマンドプロンプト）で以下を実行：
   ```bash
   firebase --version
   ```

   バージョン番号が表示されればOKです。
   表示されない場合は、まずFirebase CLIをインストールしてください。

2. **プロジェクトにログイン**

   ```bash
   firebase login
   ```

   ブラウザが開くので、Googleアカウントでログインしてください。

3. **プロジェクトを選択**

   プロジェクトのディレクトリに移動してから：
   ```bash
   cd C:\Users\236149\Desktop\ai_fitness_app
   firebase use tokyo-list-478804-e5
   ```

4. **Stripeシークレットキーを登録**

   以下のコマンドを実行します：
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```

   「Enter a value for STRIPE_SECRET_KEY」と表示されたら、
   先ほどコピーしたシークレットキー（`sk_test_...`）を貼り付けてEnterを押します。

   **注意**：入力した文字は画面に表示されません（セキュリティのため）

5. **Webhookシークレットを登録**（後で設定するもの）

   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

   Webhookシークレットはこの後の「Webhook設定」で取得します。
   今はスキップしても大丈夫です。

### 登録できたか確認する方法

```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
```

キーが表示されれば、正しく登録されています。

---

## 5. Stripe Webhookの設定

Webhookは、Stripeから「何か起きたよ！」と通知を受け取る仕組みです。

### Webhookで通知されるイベントの例

- ユーザーが支払いを完了した
- サブスクリプションが更新された
- 支払いが失敗した

### 手順

1. **Webhookページを開く**

   Stripeダッシュボードで「開発者」→「Webhook」を選択します。

   または：
   ```
   https://dashboard.stripe.com/test/webhooks
   ```

2. **「エンドポイントを追加」をクリック**

3. **エンドポイントURLを入力**

   以下の形式でURLを入力します：
   ```
   https://asia-northeast1-tokyo-list-478804-e5.cloudfunctions.net/stripe_handleWebhook
   ```

   **注意**：本番環境ではデプロイ後の実際のURLに置き換えてください。

4. **イベントを選択**

   「イベントを選択」をクリックして、以下のイベントにチェックを入れます：

   - `checkout.session.completed`（決済完了）
   - `customer.subscription.created`（サブスクリプション作成）
   - `customer.subscription.updated`（サブスクリプション更新）
   - `customer.subscription.deleted`（サブスクリプション削除）
   - `invoice.payment_succeeded`（支払い成功）
   - `invoice.payment_failed`（支払い失敗）

5. **「エンドポイントを追加」をクリック**

6. **Webhookシークレットをコピー**

   作成されたエンドポイントの詳細画面で、
   「署名シークレット」の「表示」をクリックしてコピーします。

   キーは `whsec_` で始まります。

7. **Firebase Secret Managerに登録**

   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

   コピーしたWebhookシークレットを貼り付けてEnterを押します。

### ローカル開発時のWebhookテスト

ローカルで開発中にWebhookをテストしたい場合は、Stripe CLIを使います：

1. **Stripe CLIをインストール**

   Windows（PowerShell）：
   ```powershell
   scoop install stripe
   ```

   または公式サイトからダウンロード：
   ```
   https://stripe.com/docs/stripe-cli
   ```

2. **Stripe CLIにログイン**

   ```bash
   stripe login
   ```

3. **ローカルにイベントを転送**

   ```bash
   stripe listen --forward-to localhost:5001/tokyo-list-478804-e5/asia-northeast1/stripe_handleWebhook
   ```

   表示されるWebhookシークレット（`whsec_...`）をメモしておきます。

4. **ローカルの環境変数を設定**

   `functions/.env.local` ファイルを作成（または編集）：
   ```
   STRIPE_SECRET_KEY=sk_test_あなたのキー
   STRIPE_WEBHOOK_SECRET=whsec_stripe_listenで表示されたキー
   ```

---

## 6. テスト環境と本番環境の切り替え

Stripeには2つの環境があります：

| 環境 | 用途 | キーの形式 |
|------|------|-----------|
| テスト環境（Test Mode） | 開発・テスト用。実際のお金は動かない | `sk_test_...`, `pk_test_...` |
| 本番環境（Live Mode） | 実際のサービス用。本物のお金が動く | `sk_live_...`, `pk_live_...` |

### テスト環境での動作確認

テスト環境では、以下のテスト用カード番号を使えます：

| カード番号 | 結果 |
|-----------|------|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 0002` | カード拒否 |
| `4000 0025 0000 3155` | 3Dセキュア認証が必要 |

**有効期限**：未来の日付ならなんでもOK（例：12/25）
**CVC**：3桁ならなんでもOK（例：123）

### 本番環境への切り替え手順

1. **Stripeダッシュボードでテストモードをオフにする**

   画面右上のスイッチをクリックして、本番モードに切り替えます。

2. **本番用のAPIキーを取得**

   テストと同じ手順で、本番用のシークレットキー（`sk_live_...`）を取得します。

3. **Firebase Secret Managerに本番キーを登録**

   本番環境用のFirebaseプロジェクトで：
   ```bash
   firebase use production-project-id
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```

   本番用のシークレットキーを入力します。

4. **本番用のWebhookエンドポイントを作成**

   Stripeダッシュボードの本番モードで、新しいWebhookエンドポイントを作成します。

### 注意点

- **本番環境では実際にお金が動きます！**
- **テスト環境で十分にテストしてから本番に移行してください**
- テストキーと本番キーを混同しないように注意してください

---

## 7. トラブルシューティング

よくある問題と解決方法をまとめました。

### 問題1: 「STRIPE_SECRET_KEY is not set」エラー

**原因**：Secret Managerにキーが登録されていない、またはデプロイ時に読み込めていない

**解決方法**：

1. キーが登録されているか確認：
   ```bash
   firebase functions:secrets:access STRIPE_SECRET_KEY
   ```

2. 登録されていない場合は登録：
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```

3. Cloud Functionsを再デプロイ：
   ```bash
   firebase deploy --only functions
   ```

### 問題2: Webhookの署名検証に失敗

**原因**：Webhookシークレットが間違っている、または古い

**解決方法**：

1. Stripeダッシュボードで最新のWebhookシークレットを確認

2. Secret Managerを更新：
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

3. 再デプロイ：
   ```bash
   firebase deploy --only functions
   ```

### 問題3: テストカードで決済できない

**原因**：本番モードのキーを使っている

**解決方法**：

1. 使っているキーが `sk_test_` で始まることを確認

2. Stripeダッシュボードがテストモードになっていることを確認

### 問題4: ローカルでWebhookが受信できない

**原因**：Stripe CLIが起動していない、または転送先のURLが間違っている

**解決方法**：

1. Stripe CLIが起動しているか確認：
   ```bash
   stripe listen --forward-to localhost:5001/tokyo-list-478804-e5/asia-northeast1/stripe_handleWebhook
   ```

2. Firebaseエミュレータが起動しているか確認：
   ```bash
   firebase emulators:start --only functions
   ```

3. ポート番号（5001）が正しいか確認

### 問題5: 「No such price」エラー

**原因**：指定したPrice IDがStripeに存在しない

**解決方法**：

1. Stripeダッシュボードで「商品」→「価格」を確認

2. Price IDをコピーして、正しいIDを使っているか確認

3. テスト環境と本番環境で別の価格を作成する必要があります

---

## まとめ

このガイドで説明した内容：

1. **Stripeアカウントの作成** - 公式サイトで登録
2. **APIキーの取得** - ダッシュボードの「開発者」→「APIキー」
3. **Firebase Secret Managerへの登録** - `firebase functions:secrets:set` コマンド
4. **Webhook設定** - イベント通知を受け取るためのURL設定
5. **環境の切り替え** - テスト環境と本番環境の違い

### 次のステップ

設定が完了したら、以下のことを試してみてください：

1. Firebaseエミュレータを起動して、ローカルで決済フローをテスト
2. テストカードを使って、サブスクリプション作成APIを呼び出す
3. Stripeダッシュボードで、作成されたCustomerやSubscriptionを確認

---

## 参考リンク

- [Stripe公式ドキュメント](https://stripe.com/docs)
- [Stripe APIリファレンス](https://stripe.com/docs/api)
- [Stripe テストカード一覧](https://stripe.com/docs/testing)
- [Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env#secret-manager)

---

**作成日**: 2025年12月11日
**更新日**: 2025年12月11日
**対象読者**: 開発者、運用担当者
