# Firebase Console 認証設定ガイド

**作成日**: 2025年12月1日
**対象**: AIフィットネスアプリ
**Firebase Project ID**: `tokyo-list-478804-e5`
**Firebase Console URL**: https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication

---

## 概要

このガイドは、Firebase Console で認証機能を設定する手順をステップバイステップで説明します。ユーザーがコピペして実行できるように、UI要素とクリック位置を詳細に記載しています。

**対応範囲**:
- メール/パスワード認証の有効化
- パスワードポリシー設定
- Authorized domains の設定
- メールテンプレートの日本語化

---

## ステップ 1: Firebase Console へのログイン

### 1.1 ブラウザで以下のURL を開く

```
https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication
```

### 1.2 Google アカウントでログイン

- Firebase プロジェクトへアクセス権限がある Google アカウントでログインしてください

### 1.3 プロジェクト画面の確認

正常にログインすると、以下の画面が表示されます:

```
左側メニュー:
  ├─ Build (ビルド)
  │   ├─ Authentication ← ここをクリック
  │   ├─ Firestore Database
  │   └─ ...
```

---

## ステップ 2: Authentication セクションへのアクセス

### 2.1 左側メニューから Authentication を選択

**クリック位置**:
```
左メニュー > Build > Authentication
```

### 2.2 Authentication ページが表示される

以下のタブが見えます:
```
[Users] [Sign-in method] [Templates] [Settings]
```

---

## ステップ 3: メール/パスワード認証の有効化

### 3.1 Sign-in method タブをクリック

**クリック位置**:
```
Authentication ページ上部 > [Sign-in method] タブ
```

### 3.2 認証方法の一覧が表示される

以下のリストが表示されます:

```
提供可能な認証方法:
┌─────────────────────────────────────┐
│ Email/Password                      │
│  ・Enable/Disable トグル            │
│  ・状態: 現在は「無効」             │
└─────────────────────────────────────┘
│ Google                              │
│ Facebook                            │
│ ...その他の方法                     │
```

### 3.3 Email/Password をクリック

**クリック位置**:
```
認証方法リスト > Email/Password 行をクリック
```

### 3.4 Email/Password 設定ダイアログが開く

以下のオプションが表示されます:

```
┌─────────────────────────────────────────────┐
│ Email/Password                              │
├─────────────────────────────────────────────┤
│                                             │
│ ○ Enable  ← このラジオボタンを選択          │
│ ○ Disable                                   │
│                                             │
│ [ ] Email link (passwordless sign-in)       │
│     チェックボックス (チェックなし推奨)    │
│                                             │
│        [Save] ボタン                        │
└─────────────────────────────────────────────┘
```

### 3.5 Enable を選択

- ラジオボタン「Enable」をクリック
- Email link オプションはチェックしない（パスワード認証を使用）

### 3.6 Save ボタンをクリック

**クリック位置**:
```
ダイアログ下部 > [Save] ボタン
```

### 3.7 確認メッセージ

以下の確認メッセージが表示されます:

```
"Email/Password authentication has been enabled."
(メール/パスワード認証が有効になりました)
```

**完了**: Email/Password 認証が有効化されました。

---

## ステップ 4: パスワードポリシー設定

### 4.1 Sign-in method タブで下にスクロール

Email/Password を有効化すると、同じタブに以下のセクションが表示されます:

```
Email/Password
├─ Enable/Disable トグル ✓(有効)
├─ ⚙️ Password Policy (パスワードポリシー)
└─ Email Link Settings (メールリンク設定)
```

### 4.2 Password Policy セクションを見つける

**セクション内容**:

```
┌──────────────────────────────────────────┐
│ Password Policy                          │
├──────────────────────────────────────────┤
│                                          │
│ Minimum password length (最小文字数):    │
│   [8] 文字 (デフォルト)                 │
│                                          │
│ ☑ Require uppercase and lowercase        │
│   (大文字と小文字を必須)                 │
│                                          │
│ ☑ Require numbers                        │
│   (数字を必須)                           │
│                                          │
│ ☑ Require special characters             │
│   (特殊文字を必須) ← これが表示されない │
│                                          │
└──────────────────────────────────────────┘
```

### 4.3 現在の設定を確認

デフォルト設定は以下の通りです:

| 設定項目 | デフォルト値 | 推奨設定 | 実施 |
|---------|----------|--------|------|
| 最小文字数 | 8文字 | 8文字 | ✓ OK |
| 大文字・小文字必須 | 有効 | 有効 | ✓ OK |
| 数字必須 | 有効 | 有効 | ✓ OK |
| 特殊文字必須 | (非表示) | 推奨 | - |

### 4.4 パスワードポリシー - 推奨設定

現在のデフォルト設定で十分です。特殊文字は Firebase の設定では提供されていないため、アプリ側でバリデーションを実装してください。

**推奨パスワード要件** (アプリ側で実装):
```
✓ 最小8文字
✓ 大文字を含む
✓ 小文字を含む
✓ 数字を含む
✓ 特殊文字を含む (推奨: !@#$%^&*)
```

**参考**: `docs/specs/00_要件定義書_v3_3.md` - 非機能要件 NFR-018 参照

---

## ステップ 5: Authorized Domains の設定

### 5.1 Authentication ページで Settings タブをクリック

**クリック位置**:
```
Authentication ページ上部 > [Settings] タブ
```

### 5.2 Settings ページが表示される

以下のセクションが見えます:

```
左側パネル:
├─ General
├─ Authorized domains
├─ Templates (メールテンプレート)
└─ ...
```

### 5.3 Authorized domains をクリック

**クリック位置**:
```
左側パネル > [Authorized domains] をクリック
```

### 5.4 Authorized domains ページが表示される

```
┌────────────────────────────────────────────────┐
│ Authorized domains                             │
├────────────────────────────────────────────────┤
│                                                │
│ このプロジェクト経由で、認証可能なドメイン:  │
│                                                │
│現在のリスト:                                   │
│ • localhost (既に追加済み)                     │
│ • tokyo-list-478804.firebaseapp.com (既存)    │
│                                                │
│ 新規ドメイン追加:                              │
│ [入力フィールド]  [Add domain] ボタン         │
│                                                │
└────────────────────────────────────────────────┘
```

### 5.5 localhost の確認

**確認事項**:

```
☑ localhost が既に追加されているか確認
```

- `localhost` は通常、Firebase プロジェクト作成時に自動追加されます
- 未追加の場合は、以下のステップで追加してください

### 5.6 localhost がない場合の追加手順

#### 5.6.1 入力フィールドに `localhost` を入力

**フィールド位置**:
```
Settings > Authorized domains > [入力フィールド]
```

入力内容:
```
localhost
```

#### 5.6.2 Add domain ボタンをクリック

**クリック位置**:
```
入力フィールド横 > [Add domain] ボタン
```

#### 5.6.3 確認メッセージ

```
"Domain added successfully"
(ドメインが正常に追加されました)
```

### 5.7 本番環境用ドメイン (将来)

**推奨事項**:

開発フェーズ (Phase 1-2) では `localhost` のみで十分です。本番リリース前に、以下のドメインを追加してください:

```
(例)
• myfitnessapp.com
• app.myfitnessapp.com
```

---

## ステップ 6: メールテンプレートの日本語化

### 6.1 左側パネルから Templates をクリック

**クリック位置**:
```
Settings > [Templates] (左側パネル)
```

### 6.2 メールテンプレートの一覧が表示される

```
メールテンプレート一覧:
┌──────────────────────────────────────────────┐
│ Email Templates                              │
├──────────────────────────────────────────────┤
│ • Email verification                         │
│ • Password reset email                       │
│ • Email change confirmation                  │
│ • SMS message (SMS認証の場合)                │
└──────────────────────────────────────────────┘
```

### 6.3 パスワードリセット メールテンプレートを編集

**クリック位置**:
```
メールテンプレート一覧 > [Password reset email] 行をクリック
```

### 6.4 テンプレート編集ページが開く

```
┌────────────────────────────────────────────────┐
│ Password reset email                           │
├────────────────────────────────────────────────┤
│                                                │
│ Sender email address:                          │
│  [noreply@tokyo-list-478804.firebaseapp.com]   │
│                                                │
│ Email subject:                                 │
│  [Reset your password]                         │
│  ← ここを編集                                 │
│                                                │
│ Email body:                                    │
│  [長いHTML/テンプレート]                      │
│  ← ここを編集                                 │
│                                                │
│  [Preview] [Save] [Reset to default] ボタン  │
│                                                │
└────────────────────────────────────────────────┘
```

### 6.5 Subject を日本語に変更

**フィールド名**: `Email subject`

**現在の値**:
```
Reset your password
```

**変更後の値**:
```
パスワードリセット
```

**編集手順**:
1. Subject フィールドをクリック
2. 全テキストを削除 (Ctrl+A → Delete)
3. 以下を入力:
   ```
   パスワードリセット
   ```

### 6.6 Email body (本文) を日本語に変更

**フィールド名**: `Email body`

メールテンプレートに含まれるテンプレート変数 (変更しないこと):
```
%%EMAIL%%        - ユーザーのメールアドレス
%%FNAME%%        - ユーザーの名
%%LNAME%%        - ユーザーの姓
%%LINK%%         - パスワードリセットリンク
%%RESET_CODE%%   - リセットコード
```

**編集例** (推奨):

現在のテンプレート（英語）:
```html
<p>%%EMAIL%%さん</p>
<p>パスワードリセットのリクエストを受け取りました。</p>
<p><a href="%%LINK%%">パスワードをリセット</a></p>
<p>このリンクは24時間有効です。</p>
<p>AIフィットネスアプリ運営チーム</p>
```

**変更手順**:

1. Email body フィールドをクリック
2. HTMLエディタ内のテキストを編集
3. 上記の日本語テンプレートを参考に編集

### 6.7 Preview で確認

**クリック位置**:
```
テンプレート下部 > [Preview] ボタン
```

```
プレビュー表示:
┌────────────────────────────────────────┐
│ Email Preview                          │
├────────────────────────────────────────┤
│ Subject: パスワードリセット             │
│                                        │
│ Body:                                  │
│ [日本語メール本文が表示される]          │
│                                        │
│ [Close] ボタン                         │
└────────────────────────────────────────┘
```

### 6.8 Save ボタンで保存

**クリック位置**:
```
テンプレート下部 > [Save] ボタン
```

**確認メッセージ**:
```
"Template saved successfully"
(テンプレートが正常に保存されました)
```

### 6.9 その他のメールテンプレート (オプション)

同様に以下のテンプレートも日本語化することを推奨します:

| テンプレート | 推奨 Subject | 優先度 |
|-----------|-----------|------|
| Email verification | メールアドレスの確認 | 高 |
| Password reset email | パスワードリセット | 高 |
| Email change confirmation | メールアドレス変更確認 | 中 |

---

## ステップ 7: 設定の確認とテスト

### 7.1 Authentication ページに戻る

**クリック位置**:
```
左側メニュー > Build > Authentication
```

### 7.2 設定内容の確認

```
Sign-in method タブで以下を確認:

✓ Email/Password: 有効
✓ パスワードポリシー:
   - 最小8文字
   - 大文字・小文字必須
   - 数字必須
✓ Authorized domains: localhost が含まれている
✓ メールテンプレート: 日本語化済み
```

### 7.3 エミュレータでのテスト

開発環境で Firebase エミュレータを使用して動作確認します:

```bash
# プロジェクトルートで実行
firebase emulators:start

# ブラウザで以下を開く
http://localhost:4000
```

**テスト項目**:
1. メール/パスワードでユーザー登録
2. ログイン
3. パスワードリセット要求
4. メールテンプレートの表示確認

---

## ステップ 8: セキュリティ設定の追加 (推奨)

### 8.1 ユーザー制限設定

**クリック位置**:
```
Authentication > Settings > General タブ
```

### 8.2 以下の設定を確認

```
セキュリティ関連設定:
□ Block all sign-ups except the ones allowlisted below
  (許可リストのユーザーのみ登録可能)
  → 開発フェーズではチェック不要

☑ Enable anonymous sign-in (オプション)
  → 推奨: チェックなし (非使用)
```

### 8.3 多要素認証 (MFA) 設定 (将来)

```
本番リリース時に有効化を検討:
□ Enable Multi-factor Authentication
  → 追加セキュリティレイヤー
```

---

## トラブルシューティング

### Q: Email/Password トグルが見つからない

**A**: 以下を確認してください:
1. Authentication > Sign-in method タブで Email/Password を検索
2. ページを再読み込み (F5 キー)
3. 別のブラウザで試す

### Q: Authorized domains に localhost がない

**A**: 以下の手順で追加してください:
1. Settings > Authorized domains
2. 入力フィールドに `localhost` を入力
3. [Add domain] ボタンをクリック

### Q: パスワードリセットメールが日本語で送信されない

**A**: 以下を確認してください:
1. メールテンプレートが正しく保存されたか確認
2. Firebase エミュレータで送信テスト
3. メールサーバーの設定を確認

### Q: アプリからの接続でエラーが出る

**A**: 以下を確認してください:
1. Firebase Project ID が正しい (`tokyo-list-478804-e5`)
2. アプリの Firebase 初期化設定が正しい
3. Firestore のセキュリティルール設定を確認

---

## 参考資料

### 仕様書リンク

| ドキュメント | セクション | 内容 |
|-----------|---------|------|
| 00_要件定義書_v3_3.md | NFR-018 | パスワード要件 |
| 07_セキュリティポリシー_v1_0.md | 4. 認証・認可 | 認証要件 |
| 01_システムアーキテクチャ設計書_v3_2.md | 3. セキュリティ | セキュリティアーキテクチャ |

### Firebase 公式ドキュメント

- [Firebase Authentication - Email/Password](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase Authentication - Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Console](https://console.firebase.google.com)

### アプリケーション側の実装

Flutter アプリ側でのメール/パスワード認証の実装:

```
flutter_app/lib/core/auth/
├── auth_service.dart          # 認証ロジック
├── auth_state_notifier.dart   # 状態管理
└── validators.dart             # バリデーション
```

詳細は以下を参照:
- `00_要件定義書_v3_3.md` - FR-002 ユーザー登録
- `03_API設計書_Firebase_Functions_v3_3.md` - 認証API

---

## 次のステップ

### Phase 1 完了後

1. Firestore セキュリティルール設定
2. Cloud Functions デプロイ
3. Flutter アプリとの統合テスト

### 本番リリース前

1. パスワードポリシー強化 (特殊文字必須)
2. 多要素認証 (MFA) 有効化
3. 本番ドメイン登録
4. セキュリティ監査実施

---

## チェックリスト

完了確認用:

```
□ Email/Password 認証が有効化された
□ パスワードポリシーが設定されている
  □ 最小8文字
  □ 大文字・小文字必須
  □ 数字必須
□ localhost が Authorized domains に含まれている
□ パスワードリセット メールテンプレートが日本語化されている
□ メールテンプレートが保存されている
□ エミュレータで動作確認が完了している
□ このガイドを docs/ に保存した
```

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|---------|------|--------|
| v1.0 | 2025-12-01 | 初版作成 |

---

**最終確認**: すべての設定が完了しました。Firebase Console での認証設定は完了です。

次は、Flutter アプリ側の認証機能の実装テストに進めます。
