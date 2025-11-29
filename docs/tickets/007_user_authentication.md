# Ticket #007: ユーザー認証機能実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 3-4
**優先度**: 最高
**ステータス**: 🚧 進行中 (Flutter UI 実装完了)
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-001～FR-005)
- `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md`
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md`
- - `docs/specs/06_データ処理記録_ROPA_v1_0.md` (316 - 605)

## 概要
ユーザー認証機能（ログイン、新規登録、ログアウト）を実装する。

## 実装済みファイル一覧

```
flutter_app/lib/
├── main.dart                                    # ✅ 更新済み (ProviderScope, emulator設定)
├── core/
│   ├── auth/
│   │   ├── auth_service.dart                   # ✅ 既存 (Google/Apple認証サービス)
│   │   ├── auth_state_notifier.dart            # ✅ 既存 (Riverpod状態管理)
│   │   └── auth_state_notifier.freezed.dart    # ✅ 既存 (Freezed生成ファイル)
│   ├── router/
│   │   └── app_router.dart                     # ✅ 新規作成 (GoRouter設定)
│   ├── theme/
│   │   └── app_theme.dart                      # ✅ 新規作成 (Material Design 3)
│   ├── utils/
│   │   └── validators.dart                     # ✅ 新規作成 (フォームバリデーション)
│   └── widgets/
│       └── auth_widgets.dart                   # ✅ 新規作成 (共通UIコンポーネント)
└── screens/
    ├── auth/
    │   ├── login_screen.dart                   # ✅ 新規作成
    │   ├── register_screen.dart                # ✅ 新規作成 (2ステップ登録)
    │   └── password_reset_screen.dart          # ✅ 新規作成
    ├── home/
    │   └── home_screen.dart                    # ✅ 新規作成 (プレースホルダー)
    └── splash/
        └── splash_screen.dart                  # ✅ 新規作成

flutter_app/test/screens/auth/
├── auth_test_guide.md                          # ✅ 新規作成 (テスト手順書)
└── login_screen_test.dart                      # ✅ 新規作成 (Widget テスト)

flutter_app/test/core/auth/
├── auth_state_notifier_test.dart               # ✅ 新規作成 (26単体テスト)
└── mocks/
    └── mock_firebase_auth.dart                 # ✅ 新規作成 (テスト用モック)

functions/src/middleware/
└── csrf.ts                                     # ✅ 新規作成 (CSRF保護ミドルウェア)

functions/src/services/
└── auditLog.ts                                 # ✅ 新規作成 (監査ログサービス)

firebase/
├── firestore.rules                             # ✅ 更新済み (本番用セキュリティルール)
└── firestore.indexes.json                      # ✅ 更新済み (10インデックス)
```

## Todo リスト

### Flutter側実装

#### 認証状態管理 (Riverpod)
- [x] AuthNotifier クラス作成
- [x] 認証状態の Provider 作成
- [x] ユーザー情報の Provider 作成
- [x] 自動ログイン機能
- [x] トークンリフレッシュ処理

#### ログイン画面 (`screens/auth/login_screen.dart`)
- [x] UI実装
  - [x] メールアドレス入力フィールド
  - [x] パスワード入力フィールド
  - [x] ログインボタン
  - [x] 新規登録へのリンク
  - [x] パスワードリセットリンク
- [x] バリデーション
  - [x] メールフォーマットチェック
  - [x] パスワード最小文字数チェック
- [x] エラーハンドリング
  - [x] 認証失敗メッセージ
  - [x] ネットワークエラー
  - [x] ローディング状態

#### 新規登録画面 (`screens/auth/register_screen.dart`)
- [x] Step 1: 認証情報入力
  - [x] メールアドレス
  - [x] パスワード
  - [x] パスワード確認
  - [x] 名前（ニックネーム）
- [x] Step 2: プロフィール情報入力
  - [x] 生年月日 (必須)
  - [x] 性別 (任意: male/female/other/prefer_not_to_say)
  - [x] 身長・体重 (任意)
  - [x] フィットネスレベル (任意: beginner/intermediate/advanced)
  - [x] フィットネス目標 (任意)
- [x] 利用規約同意チェックボックス
- [x] プライバシーポリシー同意チェックボックス

#### パスワードリセット画面
- [x] メールアドレス入力
- [x] リセットメール送信
- [x] 完了メッセージ表示

#### ソーシャルログイン
- [x] Google Sign In 実装
  - [x] ボタンUI
  - [x] 認証フロー
  - [x] エラーハンドリング
- [x] Apple Sign In 実装（iOS）
  - [x] ボタンUI
  - [x] 認証フロー
  - [x] エラーハンドリング

#### 共通コンポーネント
- [x] AuthTextField (カスタムテキストフィールド)
- [x] PasswordTextField (パスワード表示切替付き)
- [x] LoadingButton (ローディング表示付きボタン)
- [x] SocialSignInButton (ソーシャルログインボタン)
- [x] ErrorMessageCard (エラー表示)
- [x] SuccessMessageCard (成功表示)
- [x] DividerWithText (区切り線)

#### バリデーションユーティリティ
- [x] EmailValidator
- [x] PasswordValidator (強度チェック含む)
- [x] NameValidator
- [x] HeightValidator
- [x] WeightValidator
- [x] AgeValidator (13歳以上)

#### ルーティング
- [x] GoRouter 設定
- [x] 認証状態による自動リダイレクト
- [x] ルートガード (forceLogout対応)

### Cloud Functions 実装

#### 新規登録API (`api/auth/register.ts`)
- [x] エンドポイント実装
- [x] 入力バリデーション
- [x] Firebase Auth ユーザー作成
- [x] Users コレクションドキュメント作成
- [x] 初期同意状態の記録
- [ ] ウェルカムメール送信（オプション）

#### プロフィール更新API (`api/users/updateProfile.ts`)
- [x] エンドポイント実装
- [x] 認証チェック
- [x] 入力バリデーション
  - [x] ニックネーム (1-50文字)
  - [x] 生年月日 (YYYY-MM-DD形式, 13歳以上)
  - [x] 性別 (male/female/other/prefer_not_to_say)
  - [x] 身長 (100-250cm)
  - [x] 体重 (30-200kg)
  - [x] フィットネスレベル (beginner/intermediate/advanced)
  - [x] 目標 (最大100文字)
- [x] Firestore更新
- [x] 監査ログ記録 (auditLogsコレクション)

#### カスタムクレーム設定
- [x] 新規ユーザーのデフォルトクレーム
- [x] 管理者クレーム設定機能
- [x] forceLogout クレーム管理

### Firestore 実装

#### Users コレクション
- [x] ドキュメント作成時の初期値設定
- [x] フィールドバリデーション
- [x] タイムスタンプ自動設定
- [x] インデックス作成

#### Consents コレクション
- [x] 初回同意記録
- [x] 同意履歴の保存
- [x] 不変性の保証

### テスト実装

#### 単体テスト
- [x] AuthNotifier のテスト
- [x] バリデーションロジックのテスト（Widget テストで確認）
- [ ] Cloud Functions のテスト

#### 統合テスト
- [ ] ログインフロー
- [ ] 新規登録フロー
- [ ] パスワードリセットフロー
- [ ] ソーシャルログインフロー

#### E2Eテスト
- [ ] 完全な認証フロー
- [ ] エラーケース
- [ ] セッション管理

#### テストドキュメント
- [x] 手動テスト手順書 (`auth_test_guide.md`)
- [x] Widget テスト (`login_screen_test.dart`)

### セキュリティ対策
- [x] パスワード強度チェック
- [x] ブルートフォース対策（Firebase Auth標準）
- [x] セッションハイジャック対策（トークンリフレッシュ）
- [x] XSS対策（Flutter標準）
- [x] CSRF対策 (Origin/Referer検証ミドルウェア実装)

## 受け入れ条件
- [x] ユーザーが新規登録できる（UI実装済み）
- [x] ユーザーがログインできる（UI実装済み）
- [x] ユーザーがログアウトできる
- [x] パスワードリセットが機能する（UI実装済み）
- [x] ソーシャルログインが機能する
- [x] エラーが適切にハンドリングされる
- [x] セキュリティ対策が実装されている

## 注意事項
- GDPR準拠（同意取得必須）
- 日本語のエラーメッセージ
- アクセシビリティ考慮（最小タップ領域48dp）
- レスポンシブデザイン

## 次のステップ
1. ~~プロフィール保存のCloud Function実装~~ ✅ 完了
2. ~~Google/Apple Sign Inのサービス連携~~ ✅ 完了
3. ~~Consents コレクションへの同意記録~~ ✅ 完了
4. 統合テストの実装
5. ~~新規登録API (`api/auth/register.ts`) の実装~~ ✅ 完了

## 完了した追加実装
- [x] 性別フィールド (gender) の追加
- [x] フィットネスレベルフィールド (fitnessLevel) の追加
- [x] 仕様書の更新
  - [x] 00_要件定義書_v3_3.md
  - [x] 02_Firestoreデータベース設計書_v3_3.md
  - [x] 03_API設計書_Firebase_Functions_v3_3.md
  - [x] 05_画面遷移図_ワイヤーフレーム_v3_3.md
  - [x] 06_データ処理記録_ROPA_v1_0.md

## 参考リンク
- [Firebase Auth Flutter](https://firebase.flutter.dev/docs/auth/usage)
- [Riverpod](https://riverpod.dev/)
- [Google Sign In Flutter](https://pub.dev/packages/google_sign_in)
