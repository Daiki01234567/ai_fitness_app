# Firebase セットアップ ドキュメント索引

**Firebase Project ID**: `tokyo-list-478804-e5`
**最終更新**: 2025-12-01

---

## ドキュメント一覧

### 1. Firebase 認証設定

Firebase Console での認証機能の設定に関するドキュメント一式です。

#### ドキュメント

| ファイル | 所要時間 | 対象 | 説明 |
|---------|--------|------|------|
| **FIREBASE_AUTH_QUICK_START.md** | 10分 | 全開発者 | コピペで実行できるチェックリスト形式 |
| **FIREBASE_AUTH_SETUP_GUIDE.md** | 30分 | 初心者向け | 詳細なステップバイステップガイド |
| **FIREBASE_AUTH_VERIFICATION.md** | 20分 | テスト担当 | セットアップ完了を検証するチェックシート |

#### クイック選択ガイド

**「今すぐ設定したい」場合**:
```
1. FIREBASE_AUTH_QUICK_START.md を開く
2. チェックリストを上から実行
3. 10分で完了
```

**「詳しく理解してから設定したい」場合**:
```
1. FIREBASE_AUTH_SETUP_GUIDE.md を開く
2. ステップ1から順に実行
3. スクリーンショット説明付きで安心
```

**「設定が正しくできたか確認したい」場合**:
```
1. FIREBASE_AUTH_VERIFICATION.md を開く
2. Phase 1-3 のチェックリストを実行
3. テスト結果を記録
```

---

## セットアップ全体フロー

```
開始
  │
  ├─→ 【10分】FIREBASE_AUTH_QUICK_START.md
  │      └─→ Firebase Console 設定完了
  │
  ├─→ 【20分】ローカル開発環境テスト
  │      └─→ firebase emulators:start
  │
  ├─→ 【20分】Flutter アプリテスト
  │      └─→ ユーザー登録・ログイン動作確認
  │
  └─→ 【20分】FIREBASE_AUTH_VERIFICATION.md で検証
         └─→ テスト完了レポート作成
```

**総所要時間**: 約 70分

---

## Firebase Project 設定の構成図

```
Firebase Console (GCP)
├─ Authentication
│  ├─ Sign-in method
│  │  ├─ Email/Password ← ここを有効化
│  │  └─ Password Policy ← ポリシー設定
│  ├─ Templates
│  │  └─ Password reset email ← 日本語化
│  └─ Settings
│     ├─ General ← セキュリティ設定
│     └─ Authorized domains ← localhost 追加
│
├─ Firestore Database
│  ├─ Data
│  └─ Security Rules ← Phase 1-2 で実装
│
└─ Realtime Database (非使用)
```

---

## 各ドキュメントの使い方

### FIREBASE_AUTH_QUICK_START.md

**用途**: Firebase Console での認証設定を素早く実行

**構成**:
- 実行チェックリスト（6項目）
- トラブルシューティング（3項目）
- 所要時間：10分

**こんな人に向いている**:
- Firebase 設定経験がある
- 早急に環境を構築したい
- ドキュメント参照は最小限にしたい

**使用場面**:
```
$ firebase emulators:start  # エミュレータ起動確認
$ flutter run               # アプリ起動後、認証機能をテスト
```

**実行例**:
```
□ Email/Password 認証を有効化
  └─ Firebase Console > Sign-in method > Email/Password > Enable > Save
```

---

### FIREBASE_AUTH_SETUP_GUIDE.md

**用途**: Firebase Console での認証設定を詳細に説明

**構成**:
- ステップ 1-8（各ステップに UI 説明付き）
- スクリーンショット代わりの「UI 要素の説明」
- トラブルシューティング（4項目）
- 参考資料・次のステップ

**こんな人に向いている**:
- Firebase 設定が初めて
- UI 画面で迷いやすい
- 安全に設定を進めたい

**ドキュメント内容**:
```
ステップ 1: Firebase Console へのログイン
ステップ 2: Authentication セクションへのアクセス
ステップ 3: メール/パスワード認証の有効化
ステップ 4: パスワードポリシー設定
ステップ 5: Authorized Domains の設定
ステップ 6: メールテンプレートの日本語化
ステップ 7: 設定の確認とテスト
ステップ 8: セキュリティ設定の追加
```

**各ステップの特徴**:
- UI 要素の位置を詳細に説明
- クリック位置を「パス表記」で明示
- スクリーンショット代わりの「枠線図」
- エラー時の対応方法を記載

**実行例**:
```
ステップ 3.4:

┌─────────────────────────────────────────┐
│ Email/Password                          │
├─────────────────────────────────────────┤
│ ○ Enable  ← このラジオボタンを選択      │
│ ○ Disable                               │
│        [Save] ボタン                    │
└─────────────────────────────────────────┘
```

---

### FIREBASE_AUTH_VERIFICATION.md

**用途**: セットアップが正しく完了したことを検証

**構成**:
- Phase 1: Firebase Console 設定確認（4項目）
- Phase 2: ローカル開発環境での検証（5項目）
- Phase 3: セキュリティ検証（2項目）
- 最終チェックリスト
- 問題発生時の対応ガイド

**こんな人に向いている**:
- QA / テスト担当者
- チーム全体でセットアップを確認したい
- テスト結果をレポート化したい

**実行項目例**:

```
Phase 1: Firebase Console 設定確認
□ Email/Password 認証が有効化されている
□ パスワードポリシーが正しく設定されている
□ localhost が Authorized domains に含まれている
□ メールテンプレートが日本語化されている

Phase 2: ローカル開発環境での検証
□ Firebase エミュレータが起動できる
□ Flutter アプリでユーザー登録ができる
□ ログイン機能が動作している
□ パスワードリセット機能が動作している
□ パスワード要件検証が機能している

Phase 3: セキュリティ検証
□ HTTPS通信が確立されている
□ GDPR準拠性が確認されている
```

**チェックシート記入例**:

```
テスト手順:
1. アプリの「新規登録」画面を開く
2. テストメール: test@example.com
3. テストパスワード: TestPass123!
4. 「登録」ボタンをクリック

期待結果:
□ ユーザー登録が成功する
□ エラーログが表示されない

テスト日時: 2025-12-01 14:00
テスト実施者: 山田太郎
テスト結果: ☐ 成功 ☐ 失敗
```

---

## よくある質問（FAQ）

### Q1: どのドキュメントから始めたらいい？

**A**: 以下の基準で選んでください:

- **設定経験がある** → FIREBASE_AUTH_QUICK_START.md
- **初めてで安全に進めたい** → FIREBASE_AUTH_SETUP_GUIDE.md
- **テスト・検証をしたい** → FIREBASE_AUTH_VERIFICATION.md

---

### Q2: Firebase Console と Flutter アプリの設定は別？

**A**: はい、別です:

```
1. Firebase Console での設定 (このドキュメント対象)
   └─ 認証方法の有効化、パスワードポリシーなど

2. Flutter アプリ側の実装 (別ドキュメント)
   └─ firebase_auth パッケージの使用、UI の実装など
```

このドキュメントでは **1. Firebase Console 設定** のみを対象としています。

---

### Q3: パスワードに特殊文字の要件は？

**A**: Firebase Console では以下の設定が可能です:

```
✓ 最小文字数 (デフォルト: 8)
✓ 大文字・小文字必須
✓ 数字必須
✗ 特殊文字必須 (Firebase では未サポート)
```

特殊文字要件については、アプリ側でバリデーションを実装してください。

参考: `docs/specs/00_要件定義書_v3_3.md` - NFR-018

---

### Q4: localhost 以外のドメインも追加する必要がある？

**A**: Phase 1-2 開発フェーズでは不要です:

```
開発フェーズ (現在):
✓ localhost のみで十分

本番リリース前:
必ず本番ドメインを追加してください
例: app.example.com, myapp.jp など
```

---

### Q5: メールテンプレートを英語のままにしたい

**A**: 可能です。Firebase の個別設定で:

```
Settings > Templates > Password reset email
  └─ Subject と Body をそのまま保持
```

ただし、日本市場向けアプリなので日本語化を推奨します。

参考: `docs/specs/00_要件定義書_v3_3.md` - 非機能要件

---

### Q6: エミュレータと本番 Firebase を切り替える方法は？

**A**: Firebase CLI で管理:

```bash
# ローカルエミュレータを使用
firebase emulators:start

# 本番 Firebase に切り替え (開発後)
firebase deploy
```

詳細は Firebase CLI ドキュメントを参照してください。

---

## 参考資料へのリンク

### プロジェクト仕様書

| 仕様書 | セクション | 関連内容 |
|-------|---------|--------|
| 00_要件定義書_v3_3.md | NFR-018 | パスワード要件 |
| 00_要件定義書_v3_3.md | FR-002 | ユーザー登録 |
| 07_セキュリティポリシー_v1_0.md | 4. 認証・認可 | 認証セキュリティ要件 |
| 01_システムアーキテクチャ設計書_v3_2.md | 3. セキュリティ | セキュリティアーキテクチャ |

### Firebase 公式ドキュメント

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Email/Password Authentication](https://firebase.google.com/docs/auth/web/password-auth)
- [Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

### プロジェクト内ドキュメント

```
docs/
├─ FIREBASE_SETUP_INDEX.md (このファイル)
├─ FIREBASE_AUTH_QUICK_START.md
├─ FIREBASE_AUTH_SETUP_GUIDE.md
├─ FIREBASE_AUTH_VERIFICATION.md
└─ specs/
   ├─ 00_要件定義書_v3_3.md
   ├─ 07_セキュリティポリシー_v1_0.md
   └─ 01_システムアーキテクチャ設計書_v3_2.md
```

---

## セットアップ進捗の記録

チーム全体でセットアップ進捗を管理する場合は、以下の情報を記録してください:

```
実施日: 2025-12-01
実施者: _______________
確認者: _______________

実施内容:
□ Firebase Console ログイン確認
□ Email/Password 認証有効化
□ パスワードポリシー設定
□ localhost 追加
□ メールテンプレート日本語化

テスト実施:
□ エミュレータ起動確認
□ ユーザー登録テスト
□ ログイン機能テスト
□ パスワードリセットテスト

結果: ☐ 完了 ☐ 一部未実施 ☐ エラーあり

備考: _______________________________________________________________
```

---

## サポート

セットアップ中に問題が発生した場合:

1. **FIREBASE_AUTH_SETUP_GUIDE.md** の「トラブルシューティング」を参照
2. **FIREBASE_AUTH_VERIFICATION.md** の「問題発生時の対応」を参照
3. Firebase 公式ドキュメント: https://firebase.google.com/docs
4. チーム内の Firebase 担当者に相談

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|---------|------|--------|
| v1.0 | 2025-12-01 | 初版作成 - 認証設定ガイド 3 点 |

---

## 関連チケット

```
開発チケット参照:
□ #001: Firebase 基盤構築
□ #002: 認証機能実装 (Flutter)
□ #003: Firestore セキュリティルール設定
```

参考: `docs/tickets/`

---

**作成者**: Cloud Architect
**最終確認日**: 2025-12-01
**ステータス**: 本運用開始

