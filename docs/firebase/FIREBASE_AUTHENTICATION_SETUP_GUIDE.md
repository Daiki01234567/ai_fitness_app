# Firebase Authentication セットアップガイド

**対象者**: 初学者・開発者
**所要時間**: 約90分（全セクション完了時）
**前提条件**:
- Firebase プロジェクト（`tokyo-list-478804-e5`）へのアクセス権限
- Google アカウント（プロジェクト管理者権限）
- Apple Developer アカウント（Apple Sign In設定時のみ）

**参照仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` - FR-001, FR-015
- `docs/specs/07_セキュリティポリシー_v1_0.md` - セクション4

---

## 目次

1. [前提条件と必要な権限](#1-前提条件と必要な権限)
2. [メール/パスワード認証有効化](#2-メールパスワード認証有効化) ✅ 設定済み
3. [Google OAuth設定](#3-google-oauth設定) ✅ 設定済み
4. [Apple Sign In設定](#4-apple-sign-in設定) ⬜ 未設定
5. [パスワードポリシー設定](#5-パスワードポリシー設定) ⬜ 未設定
6. [メールテンプレート日本語化](#6-メールテンプレート日本語化) ⬜ 未設定
7. [App Check有効化](#7-app-check有効化) ⬜ 未設定
8. [電話番号認証について](#8-電話番号認証について)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. 前提条件と必要な権限

**推定所要時間**: 5分

### 1.1 Firebase プロジェクト情報

| 項目 | 値 |
|-----|-----|
| プロジェクトID | `tokyo-list-478804-e5` |
| プロジェクト名 | AI Fitness App |
| リージョン | asia-northeast1（東京） |
| Firebase Console URL | https://console.firebase.google.com/project/tokyo-list-478804-e5 |

### 1.2 必要な権限

Firebase Authentication の設定を行うには、以下の権限が必要です：

| 権限 | 説明 | 必要な操作 |
|-----|------|-----------|
| **Firebase 管理者** | Authentication設定の変更 | 全セクション |
| **プロジェクトオーナー** | OAuth同意画面設定 | Google OAuth設定 |
| **Apple Developer** | App ID作成・設定 | Apple Sign In設定 |

### 1.3 権限の確認方法

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `tokyo-list-478804-e5` を選択
3. 左側メニュー「プロジェクトの設定」（歯車アイコン）をクリック
4. 「ユーザーと権限」タブを選択
5. 自分のアカウントの権限を確認

> **注意**: 「オーナー」または「編集者」権限がない場合は、プロジェクトオーナーに権限付与を依頼してください。

---

## 2. メール/パスワード認証有効化

✅ **設定済み**

**推定所要時間**: 10分（参考）

### 2.1 概要

メール/パスワード認証は、ユーザーがメールアドレスとパスワードを使用してアカウントを作成・ログインする最も基本的な認証方式です。

**技術仕様**（セキュリティポリシーv1.0より）:
- Firebase Authentication を使用
- パスワードは bcrypt でハッシュ化（コストファクター12以上）
- セッショントークン（JWT）の有効期限: 1時間
- リフレッシュトークンの有効期限: 30日

### 2.2 設定手順（参考）

以下は既に完了している設定手順です。確認や再設定が必要な場合に参照してください。

**Firebase Console での操作**:

1. [Firebase Authentication プロバイダ設定](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/providers) にアクセス

2. 「Sign-in method」タブが表示されていることを確認

3. 「ネイティブ プロバイダ」セクションで「メール/パスワード」をクリック

4. 設定画面で以下を有効化:
   - 「メール/パスワード」: **有効**
   - 「メールリンク（パスワードなしでログイン）」: **無効**（セキュリティ上、パスワード認証を推奨）

5. 「保存」ボタンをクリック

### 2.3 設定確認

1. 「Sign-in method」タブで「メール/パスワード」の横に「有効」と表示されていることを確認
2. ステータスが緑色のチェックマークになっていることを確認

---

## 3. Google OAuth設定

✅ **設定済み**

**推定所要時間**: 20分（参考）

### 3.1 概要

Google OAuth は、ユーザーが Google アカウントを使用してワンクリックでログインできる認証方式です。

**メリット**:
- ユーザーがパスワードを新たに覚える必要がない
- Google による強力なセキュリティ
- メールアドレスの確認が不要

### 3.2 OAuth同意画面設定（参考）

**Google Cloud Console での操作**:

1. [OAuth同意画面](https://console.cloud.google.com/apis/credentials/consent?project=tokyo-list-478804-e5) にアクセス

2. 「User Type」で以下を選択:
   - **開発中**: 「内部」（組織内ユーザーのみ）または「外部」
   - **本番公開時**: 「外部」を選択し、Google の審査を受ける

3. アプリ情報を入力:
   - **アプリ名**: AI Fitness App
   - **ユーザーサポートメール**: `<your-support-email@example.com>`
   - **デベロッパーの連絡先メール**: `<your-developer-email@example.com>`

4. スコープ設定:
   - 「スコープを追加または削除」をクリック
   - 以下のスコープを追加:
     - `email`（ユーザーのメールアドレス）
     - `profile`（ユーザーの基本プロフィール）
     - `openid`（OpenID Connect）

5. テストユーザー設定（外部タイプの場合）:
   - 開発中は、テストユーザーとして自分のメールアドレスを追加
   - 「ユーザーを追加」をクリックしてメールアドレスを入力

6. 「保存して続行」をクリック

### 3.3 クライアントID/シークレット設定（参考）

**Google Cloud Console での操作**:

1. [認証情報](https://console.cloud.google.com/apis/credentials?project=tokyo-list-478804-e5) にアクセス

2. 「認証情報を作成」→「OAuth クライアント ID」をクリック

3. アプリケーションの種類を選択:
   - **Android アプリ**: Android用
   - **iOS アプリ**: iOS用
   - **ウェブ アプリケーション**: Web用

4. 各プラットフォームの設定:

   **Android の場合**:
   - 名前: `AI Fitness App Android`
   - パッケージ名: `com.example.ai_fitness_app`（実際のパッケージ名に置き換え）
   - SHA-1 証明書フィンガープリント: 開発・本番それぞれの署名証明書から取得

   **iOS の場合**:
   - 名前: `AI Fitness App iOS`
   - バンドルID: `com.example.aiFitnessApp`（実際のバンドルIDに置き換え）

5. 「作成」をクリック

6. 表示されたクライアントIDとシークレットを安全に保存

> **重要**: クライアントシークレットは絶対にソースコードにハードコードしないでください。環境変数や Secret Manager を使用してください。

### 3.4 Firebase Console での設定（参考）

1. [Firebase Authentication プロバイダ設定](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/providers) にアクセス

2. 「追加のプロバイダ」セクションで「Google」をクリック

3. 「有効にする」トグルをオンにする

4. 以下の情報を入力:
   - **プロジェクト サポート メール**: プルダウンから選択
   - **ウェブ クライアント ID**: Google Cloud Console で作成したウェブ用クライアントID
   - **ウェブ クライアント シークレット**: 対応するシークレット

5. 「保存」をクリック

### 3.5 設定確認

1. 「Sign-in method」タブで「Google」の横に「有効」と表示されていることを確認
2. テスト用に Google アカウントでログインを試行

---

## 4. Apple Sign In設定

⬜ **未設定**

**推定所要時間**: 30分

### 4.1 概要

Apple Sign In は、iOS ユーザーが Apple ID を使用してログインできる認証方式です。App Store に公開するアプリで他のソーシャルログインを提供する場合、Apple Sign In の提供が**必須**です。

**メリット**:
- iOS ユーザーにとって馴染みのある認証方式
- Face ID / Touch ID との連携
- メールアドレスを隠すオプション（Hide My Email）

### 4.2 Apple Developer Console での設定

#### 4.2.1 App ID の設定

1. [Apple Developer Console](https://developer.apple.com/account/) にサインイン

2. 左側メニュー「Certificates, Identifiers & Profiles」をクリック

3. 「Identifiers」を選択

4. 既存の App ID を選択するか、新規作成:
   - 「+」ボタンをクリック
   - 「App IDs」を選択して「Continue」
   - 「App」を選択して「Continue」

5. App ID の設定:
   - **Description**: `AI Fitness App`
   - **Bundle ID**: `com.example.aiFitnessApp`（実際のバンドルIDに置き換え）
   - **Explicit Bundle ID** を選択

6. Capabilities セクションで「Sign In with Apple」にチェック

7. 「Continue」→「Register」をクリック

#### 4.2.2 サービスID の設定（Web認証用）

1. 「Identifiers」画面で「+」ボタンをクリック

2. 「Services IDs」を選択して「Continue」

3. サービスID の設定:
   - **Description**: `AI Fitness App Web`
   - **Identifier**: `com.example.aiFitnessApp.web`（App IDと異なるIDを設定）

4. 「Continue」→「Register」をクリック

5. 作成したサービスIDをクリックして編集

6. 「Sign In with Apple」にチェックを入れ、「Configure」をクリック

7. 設定画面:
   - **Primary App ID**: 上記で作成した App ID を選択
   - **Domains and Subdomains**: `tokyo-list-478804-e5.firebaseapp.com`
   - **Return URLs**: `https://tokyo-list-478804-e5.firebaseapp.com/__/auth/handler`

8. 「Save」→「Continue」→「Save」をクリック

#### 4.2.3 秘密鍵の作成

1. 左側メニュー「Keys」をクリック

2. 「+」ボタンをクリック

3. Key の設定:
   - **Key Name**: `AI Fitness App Sign In Key`
   - 「Sign In with Apple」にチェック
   - 「Configure」をクリックして Primary App ID を選択

4. 「Continue」→「Register」をクリック

5. 秘密鍵（.p8ファイル）をダウンロード

> **重要**: 秘密鍵は一度しかダウンロードできません。安全な場所に保存してください。

6. **Key ID** をメモ（Firebase設定で使用）

#### 4.2.4 Team ID の確認

1. [Apple Developer Console](https://developer.apple.com/account/) の右上に表示されている名前をクリック

2. 「Membership」または「Account」セクションで **Team ID** を確認（10文字の英数字）

### 4.3 Firebase Console での設定

1. [Firebase Authentication プロバイダ設定](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/providers) にアクセス

2. 「追加のプロバイダ」セクションで「Apple」をクリック

3. 「有効にする」トグルをオンにする

4. 以下の情報を入力:

   | 項目 | 値 |
   |-----|-----|
   | **サービスID** | `com.example.aiFitnessApp.web`（上記で作成） |
   | **Apple チーム ID** | Apple Developer Console で確認した Team ID |
   | **キー ID** | 秘密鍵作成時に表示された Key ID |
   | **秘密鍵** | ダウンロードした .p8 ファイルの内容をペースト |

5. 「OAuth コード フロー設定」セクション:
   - Firebase が自動的に設定を生成

6. 「保存」をクリック

### 4.4 Flutter アプリでの追加設定

**iOS プロジェクト設定**:

1. Xcode で iOS プロジェクトを開く

2. ターゲットを選択 →「Signing & Capabilities」タブ

3. 「+ Capability」をクリック

4. 「Sign In with Apple」を追加

**pubspec.yaml に依存関係を追加**（必要に応じて）:

```yaml
dependencies:
  sign_in_with_apple: ^5.0.0
```

### 4.5 設定確認チェックリスト

- [ ] Apple Developer Console で App ID に Sign In with Apple が有効
- [ ] サービスID が作成され、ドメインとReturn URL が設定済み
- [ ] 秘密鍵（.p8）がダウンロード済み
- [ ] Firebase Console で Apple プロバイダが有効
- [ ] Flutter プロジェクトに Sign In with Apple capability が追加

---

## 5. パスワードポリシー設定

⬜ **未設定**

**推定所要時間**: 10分

### 5.1 概要

セキュリティポリシーv1.0（セクション4.1.1）に基づき、以下のパスワード要件を設定します：

| 要件 | 設定値 |
|-----|--------|
| 最小文字数 | 8文字 |
| 英大文字 | 必須 |
| 英小文字 | 必須 |
| 数字 | 必須 |
| 記号 | 必須 |

### 5.2 Firebase Console での設定

1. [Firebase Authentication 設定](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/settings) にアクセス

2. 「パスワード ポリシー」タブをクリック

3. 「パスワード ポリシーを有効にする」トグルをオンにする

4. 以下のオプションを設定:

   **文字数制限**:
   - 「最小パスワード長」: `8`

   **必須文字タイプ**:
   - 「小文字を含める」: **有効**
   - 「大文字を含める」: **有効**
   - 「数字を含める」: **有効**
   - 「英数字以外の文字を含める」（記号）: **有効**

5. 「保存」をクリック

### 5.3 クライアント側でのバリデーション

Firebase のパスワードポリシーはサーバー側で適用されますが、UX向上のためにクライアント側でも事前チェックを行います。

**Flutter での実装例**:

```dart
/// パスワードバリデーション
/// セキュリティポリシーv1.0 セクション4.1.1準拠
String? validatePassword(String? password) {
  if (password == null || password.isEmpty) {
    return 'パスワードを入力してください';
  }

  if (password.length < 8) {
    return 'パスワードは8文字以上で入力してください';
  }

  if (!RegExp(r'[a-z]').hasMatch(password)) {
    return 'パスワードには小文字を含めてください';
  }

  if (!RegExp(r'[A-Z]').hasMatch(password)) {
    return 'パスワードには大文字を含めてください';
  }

  if (!RegExp(r'[0-9]').hasMatch(password)) {
    return 'パスワードには数字を含めてください';
  }

  if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) {
    return 'パスワードには記号を含めてください';
  }

  return null; // バリデーション成功
}
```

### 5.4 設定確認

1. テスト用に弱いパスワード（例: `test123`）でアカウント作成を試行
2. 「パスワードが要件を満たしていません」等のエラーが表示されることを確認
3. 強いパスワード（例: `Test@1234`）でアカウント作成が成功することを確認

---

## 6. メールテンプレート日本語化

⬜ **未設定**

**推定所要時間**: 15分

### 6.1 概要

Firebase Authentication から送信されるメールを日本語化し、ユーザーにとって分かりやすいメッセージにカスタマイズします。

### 6.2 メールテンプレートの種類

| テンプレート | 用途 | 送信タイミング |
|-------------|------|----------------|
| パスワード リセット | パスワード忘れ時 | パスワードリセット要求時 |
| メールアドレスの確認 | 新規登録時 | アカウント作成時 |
| メールアドレスの変更 | メアド変更時 | メールアドレス変更要求時 |

### 6.3 パスワードリセットメールの設定

1. [Firebase Authentication テンプレート設定](https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/emails) にアクセス

2. 「テンプレート」タブで「パスワードのリセット」をクリック

3. 「編集」（鉛筆アイコン）をクリック

4. 以下の内容を入力:

   **件名**:
   ```
   【AI Fitness App】パスワードリセットのご案内
   ```

   **送信者名**:
   ```
   AI Fitness App
   ```

   **メッセージ本文**:
   ```
   %DISPLAY_NAME% 様

   AI Fitness App をご利用いただきありがとうございます。

   パスワードリセットのリクエストを受け付けました。
   下記のリンクをクリックして、新しいパスワードを設定してください。

   %LINK%

   このリンクは24時間有効です。

   ※このメールに心当たりがない場合は、このメールを無視してください。
   パスワードが変更されることはありません。

   ※このメールは送信専用です。返信いただいても対応できませんのでご了承ください。

   ---------------------------------
   AI Fitness App サポートチーム
   ```

5. 「保存」をクリック

### 6.4 メールアドレス確認メールの設定

1. 「メールアドレスの確認」をクリック

2. 「編集」（鉛筆アイコン）をクリック

3. 以下の内容を入力:

   **件名**:
   ```
   【AI Fitness App】メールアドレスの確認
   ```

   **送信者名**:
   ```
   AI Fitness App
   ```

   **メッセージ本文**:
   ```
   %DISPLAY_NAME% 様

   AI Fitness App へのご登録ありがとうございます。

   メールアドレスの確認を完了するため、下記のリンクをクリックしてください。

   %LINK%

   このリンクは24時間有効です。

   メールアドレスの確認が完了すると、AI Fitness App の全機能をご利用いただけます。

   ※このメールに心当たりがない場合は、このメールを無視してください。

   ※このメールは送信専用です。返信いただいても対応できませんのでご了承ください。

   ---------------------------------
   AI Fitness App サポートチーム
   ```

4. 「保存」をクリック

### 6.5 メールアドレス変更メールの設定

1. 「メールアドレスの変更」をクリック

2. 「編集」（鉛筆アイコン）をクリック

3. 以下の内容を入力:

   **件名**:
   ```
   【AI Fitness App】メールアドレス変更のご確認
   ```

   **送信者名**:
   ```
   AI Fitness App
   ```

   **メッセージ本文**:
   ```
   %DISPLAY_NAME% 様

   AI Fitness App をご利用いただきありがとうございます。

   メールアドレスの変更リクエストを受け付けました。
   変更を確定するには、下記のリンクをクリックしてください。

   %LINK%

   このリンクは24時間有効です。

   ※このメールに心当たりがない場合は、お早めにパスワードを変更し、
   アカウントのセキュリティをご確認ください。

   ※このメールは送信専用です。返信いただいても対応できませんのでご了承ください。

   ---------------------------------
   AI Fitness App サポートチーム
   ```

4. 「保存」をクリック

### 6.6 送信元メールアドレスのカスタマイズ（オプション）

デフォルトでは `noreply@tokyo-list-478804-e5.firebaseapp.com` から送信されます。
カスタムドメインを設定する場合:

1. 「SMTPの設定」タブをクリック

2. 独自の SMTP サーバー情報を入力:
   - SMTP ホスト
   - ポート
   - ユーザー名
   - パスワード

> **注意**: カスタム SMTP は追加の設定が必要です。初期段階ではデフォルトのまま運用することを推奨します。

### 6.7 テンプレート変数一覧

メールテンプレートで使用可能な変数:

| 変数 | 説明 |
|-----|------|
| `%DISPLAY_NAME%` | ユーザーの表示名 |
| `%EMAIL%` | ユーザーのメールアドレス |
| `%LINK%` | アクション用リンク（リセット、確認等） |
| `%APP_NAME%` | アプリ名 |

---

## 7. App Check有効化

⬜ **未設定**

**推定所要時間**: 20分

### 7.1 概要

Firebase App Check は、不正なクライアントからの API アクセスを防止するセキュリティ機能です。

**メリット**:
- バックエンドリソースの不正利用を防止
- ボットやスクリプトからのアクセスをブロック
- 正規のアプリからのリクエストのみを許可

**対応プラットフォーム**:
| プラットフォーム | プロバイダ |
|-----------------|-----------|
| Android | Play Integrity |
| iOS | App Attest / DeviceCheck |
| Web | reCAPTCHA v3 / reCAPTCHA Enterprise |

### 7.2 Android 設定（Play Integrity）

#### 7.2.1 Firebase Console での設定

1. [Firebase App Check](https://console.firebase.google.com/project/tokyo-list-478804-e5/appcheck) にアクセス

2. 「アプリ」タブで Android アプリを選択

3. 「Play Integrity」を選択

4. 「有効にする」をクリック

#### 7.2.2 Google Play Console での設定

1. [Google Play Console](https://play.google.com/console/) にアクセス

2. アプリを選択

3. 左側メニュー「リリース」→「設定」→「アプリの署名」

4. 「SHA-256 証明書フィンガープリント」をコピー

5. Firebase Console に戻り、上記のフィンガープリントを登録

#### 7.2.3 Flutter プロジェクトへの追加

**pubspec.yaml**:

```yaml
dependencies:
  firebase_app_check: ^0.2.1+8
```

**main.dart での初期化**:

```dart
import 'package:firebase_app_check/firebase_app_check.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.playIntegrity,
  );

  runApp(const MyApp());
}
```

### 7.3 iOS 設定（App Attest）

#### 7.3.1 Firebase Console での設定

1. [Firebase App Check](https://console.firebase.google.com/project/tokyo-list-478804-e5/appcheck) にアクセス

2. 「アプリ」タブで iOS アプリを選択

3. 「App Attest」を選択（iOS 14.0以上）
   - 古いiOSをサポートする場合は「DeviceCheck」も設定

4. 「有効にする」をクリック

#### 7.3.2 Xcode での設定

1. Xcode でプロジェクトを開く

2. ターゲットを選択 →「Signing & Capabilities」

3. 「+ Capability」をクリック

4. 「App Attest」を追加

#### 7.3.3 Flutter プロジェクトでの初期化

**main.dart**:

```dart
await FirebaseAppCheck.instance.activate(
  appleProvider: AppleProvider.appAttest,
);
```

### 7.4 Web 設定（reCAPTCHA v3）

#### 7.4.1 reCAPTCHA サイトキーの取得

1. [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) にアクセス

2. 「+」ボタンで新しいサイトを作成

3. 設定:
   - **ラベル**: `AI Fitness App Web`
   - **reCAPTCHA タイプ**: reCAPTCHA v3
   - **ドメイン**: `tokyo-list-478804-e5.firebaseapp.com`

4. 「送信」をクリック

5. **サイトキー**と**シークレットキー**をメモ

#### 7.4.2 Firebase Console での設定

1. [Firebase App Check](https://console.firebase.google.com/project/tokyo-list-478804-e5/appcheck) にアクセス

2. 「アプリ」タブで Web アプリを選択

3. 「reCAPTCHA v3」を選択

4. 上記で取得したサイトキーを入力

5. 「有効にする」をクリック

#### 7.4.3 Web アプリでの初期化

```javascript
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('<YOUR_RECAPTCHA_SITE_KEY>'),
  isTokenAutoRefreshEnabled: true
});
```

### 7.5 App Check の適用

#### 7.5.1 Firebase サービスへの適用

1. [Firebase App Check](https://console.firebase.google.com/project/tokyo-list-478804-e5/appcheck) にアクセス

2. 「API」タブをクリック

3. 各サービスの「適用」ボタンをクリック:
   - Cloud Firestore
   - Cloud Functions
   - Cloud Storage
   - Authentication

> **警告**: 適用を有効にすると、App Check トークンのないリクエストは拒否されます。開発環境ではデバッグトークンを使用してください。

#### 7.5.2 デバッグトークン（開発用）

開発中は、エミュレータやデバッグビルドで App Check をバイパスするためにデバッグトークンを使用します。

**Flutter での設定**:

```dart
// デバッグビルドでのみ有効
if (kDebugMode) {
  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.debug,
    appleProvider: AppleProvider.debug,
  );
}
```

**デバッグトークンの登録**:

1. アプリを起動し、コンソールログからデバッグトークンを確認
2. Firebase Console →「App Check」→「アプリ」→ 対象アプリ
3. 「デバッグトークンを管理」をクリック
4. 「デバッグトークンを追加」でトークンを登録

### 7.6 設定確認チェックリスト

- [ ] Android: Play Integrity が有効
- [ ] iOS: App Attest が有効
- [ ] Web: reCAPTCHA v3 が有効
- [ ] Flutter プロジェクトに firebase_app_check を追加
- [ ] 各環境で初期化コードを追加
- [ ] デバッグトークンを登録（開発環境用）

---

## 8. 電話番号認証について

### 8.1 設定しない理由

> **重要**: 要件定義書v3.3により、電話番号は「**収集しないデバイス情報**」として明記されています。そのため、電話番号認証は設定**しません**。

**要件定義書からの引用**:

```
収集しないデバイス情報:
- デバイスID(UDID/IMEI)
- 電話番号 ← これに該当
- 連絡先
- 位置情報(GPS)
```

### 8.2 プライバシー上の理由

1. **データ最小化原則**（GDPR第5条）: 必要最小限の個人データのみ収集
2. **電話番号は機微情報**: 個人を特定しやすく、漏洩時のリスクが高い
3. **認証方式の代替**: メール/パスワード、Google、Apple で十分なカバレッジ

### 8.3 もし将来追加が必要になった場合

要件定義書の改訂とプライバシーポリシーの更新が必要です。追加する場合は以下を実施:

1. 要件定義書の更新（電話番号を収集対象に変更）
2. プライバシーポリシーの更新（収集データに電話番号を追加）
3. ROPA（データ処理記録）の更新
4. ユーザーへの通知と同意取得

---

## 9. トラブルシューティング

### 9.1 よくあるエラーと解決方法

#### エラー1: 「認証に失敗しました」（メール/パスワード）

**原因**: パスワードが要件を満たしていない、またはアカウントが存在しない

**解決方法**:
1. パスワードが8文字以上、大文字・小文字・数字・記号を含むか確認
2. メールアドレスが正しいか確認
3. アカウントが存在するか Firebase Console で確認

#### エラー2: 「popup_closed_by_user」（Google認証）

**原因**: ユーザーが認証ポップアップを閉じた

**解決方法**:
1. ポップアップブロッカーが有効になっていないか確認
2. ブラウザの設定でポップアップを許可
3. 再度ログインを試行

#### エラー3: 「invalid_client」（Google認証）

**原因**: OAuth クライアントIDの設定ミス

**解決方法**:
1. Google Cloud Console でクライアントIDとシークレットを確認
2. Firebase Console の設定と一致しているか確認
3. 承認済みのリダイレクトURIが正しいか確認

#### エラー4: 「credential_already_in_use」

**原因**: 既に別のアカウントに紐付いている認証情報

**解決方法**:
1. 既存のアカウントにログインしてからリンク
2. または既存のリンクを解除してから再度リンク

#### エラー5: Apple Sign In で「invalid_request」

**原因**: サービスIDまたは秘密鍵の設定ミス

**解決方法**:
1. Apple Developer Console でサービスIDの設定を確認
2. Return URL が Firebase のURLと一致しているか確認
3. 秘密鍵（.p8）が正しくペーストされているか確認

#### エラー6: App Check で「app_not_verified」

**原因**: App Check トークンが無効または期限切れ

**解決方法**:
1. デバッグビルドの場合はデバッグトークンを登録
2. 本番ビルドの場合は正しいプロバイダ（Play Integrity / App Attest）を使用
3. Firebase Console でアプリの登録情報を確認

### 9.2 Firebase Authentication のレート制限

Firebase Authentication にはレート制限があります。開発中に制限に達した場合:

| 操作 | 制限 |
|-----|------|
| メール/パスワード認証 | 100回/時間/IPアドレス |
| パスワードリセット | 10回/時間/IPアドレス |
| メール確認 | 10回/時間/IPアドレス |

**制限に達した場合**:
1. しばらく待ってから再試行
2. 異なるIPアドレスからテスト
3. Firebase サポートに連絡（ビジネス用途の場合）

### 9.3 ログの確認方法

1. [Firebase Console](https://console.firebase.google.com/project/tokyo-list-478804-e5) にアクセス
2. 左側メニュー「Analytics」→「DebugView」（デバッグモード時）
3. または [Google Cloud Console](https://console.cloud.google.com/logs) の Cloud Logging で詳細ログを確認

### 9.4 ヘルプとサポート

**公式ドキュメント**:
- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Firebase App Check ドキュメント](https://firebase.google.com/docs/app-check)
- [Apple Sign In ドキュメント](https://developer.apple.com/sign-in-with-apple/)

**プロジェクト内部ドキュメント**:
- `docs/specs/00_要件定義書_v3_3.md` - 認証要件
- `docs/specs/07_セキュリティポリシー_v1_0.md` - セキュリティ要件

---

## 付録A: 設定完了チェックリスト

### 必須設定

- [x] メール/パスワード認証有効化
- [x] Google OAuth設定
- [ ] Apple Sign In設定
- [ ] パスワードポリシー設定
- [ ] メールテンプレート日本語化

### 推奨設定

- [ ] App Check有効化（Android）
- [ ] App Check有効化（iOS）
- [ ] App Check有効化（Web）

### 設定しない項目

- [x] 電話番号認証（要件定義書により収集禁止）

---

## 付録B: 用語集

| 用語 | 説明 |
|-----|------|
| **Firebase Authentication** | Firebase が提供するユーザー認証サービス |
| **OAuth 2.0** | 認可のための業界標準プロトコル |
| **JWT** | JSON Web Token。認証トークンの形式 |
| **App Check** | Firebase の不正アクセス防止機能 |
| **Play Integrity** | Android アプリの正当性を検証する Google のサービス |
| **App Attest** | iOS アプリの正当性を検証する Apple のサービス |
| **reCAPTCHA** | ボットからのアクセスを防止する Google のサービス |
| **サービスID** | Apple Sign In で使用する識別子 |
| **秘密鍵（.p8）** | Apple Sign In の認証に使用する鍵ファイル |

---

## 付録C: 関連ドキュメント

| ドキュメント | パス | 内容 |
|-------------|------|------|
| 要件定義書 | `docs/specs/00_要件定義書_v3_3.md` | 認証機能要件 |
| セキュリティポリシー | `docs/specs/07_セキュリティポリシー_v1_0.md` | パスワード要件 |
| Firestore設計書 | `docs/specs/02_Firestoreデータベース設計書_v3_3.md` | ユーザーデータ構造 |
| API設計書 | `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` | 認証API仕様 |

---

**ドキュメント作成完了**

質問や問題があれば、チームに相談してください。
