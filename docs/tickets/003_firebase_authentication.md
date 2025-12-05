# Ticket #003: Firebase Authentication 設定

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 1-2
**優先度**: 最高
**ステータス**: コード実装完了（70%）- Console設定待ち
**最終更新**: 2025-12-05
**関連仕様書**:
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`
- `docs/specs/00_要件定義書_v3_3.md` (FR-001～FR-005)

## 概要
Firebase Authenticationの設定と認証フローの実装基盤を構築する。

## 進捗サマリー

| カテゴリ | 進捗 | 備考 |
|---------|------|------|
| コード実装 | 95% | Cloud Functions・Flutter共に完了 |
| Console設定 | 0% | 全プロバイダー設定待ち |
| 総合進捗 | 70% | Console設定完了で100% |

## 実装済み詳細

### Cloud Functions ファイル一覧
| ファイル | 内容 |
|---------|------|
| `functions/src/auth/onCreate.ts` | ユーザー作成トリガー（Usersコレクション自動作成） |
| `functions/src/auth/onDelete.ts` | ユーザー削除トリガー（関連データクリーンアップ） |
| `functions/src/auth/customClaims.ts` | カスタムクレーム管理（admin, forceLogout, deletionScheduled） |
| `functions/src/api/auth/register.ts` | ユーザー登録API |
| `functions/src/api/auth/checkEmailExists.ts` | メール重複チェックAPI |
| `functions/src/middleware/auth.ts` | 認証ミドルウェア |

### Flutter ファイル一覧
| ファイル | 内容 |
|---------|------|
| `flutter_app/lib/core/auth/auth_service.dart` | 認証サービス（全プロバイダー対応） |
| `flutter_app/lib/core/auth/auth_state_notifier.dart` | Riverpod状態管理 |
| `flutter_app/lib/screens/auth/login_screen.dart` | ログイン画面 |
| `flutter_app/lib/screens/auth/register_screen.dart` | 登録画面 |
| `flutter_app/lib/screens/auth/password_reset_screen.dart` | パスワードリセット画面 |
| `flutter_app/lib/screens/auth/recovery_screen.dart` | アカウントリカバリー画面 |

### テスト状況
| テストファイル | テスト件数 | 状態 |
|---------------|-----------|------|
| `functions/tests/middleware/auth.test.ts` | 32件以上 | 完了 |
| `flutter_app/test/core/auth/auth_state_notifier_test.dart` | 20件以上 | 完了 |

## Todo リスト

### 認証プロバイダー設定
- [ ] メール/パスワード認証有効化
- [ ] 電話番号認証有効化（日本）
- [ ] Google OAuth 設定
  - [ ] OAuth同意画面設定
  - [ ] クライアントID/シークレット設定
- [ ] Apple Sign In 設定（iOS）
  - [ ] App ID 設定
  - [ ] サービスID設定

### カスタムクレーム設計
- [x] クレーム仕様定義
  - [x] `admin`: 管理者権限
  - [x] `forceLogout`: 強制ログアウト
  - [x] `deletionScheduled`: 削除予定フラグ
- [x] Cloud Functions でクレーム設定機能実装
- [x] クレーム検証ロジック実装

### アカウント設定
- [ ] パスワードポリシー設定
  - [ ] 最小8文字
  - [ ] 大文字・小文字・数字・記号を含む
- [ ] アカウントリカバリー設定
  - [ ] パスワードリセットメール
  - [ ] メールテンプレート（日本語）
- [ ] メール確認設定

### セッション管理
- [ ] リフレッシュトークン有効期限設定
- [ ] IDトークン有効期限設定
- [ ] マルチデバイス対応設定
- [ ] 強制ログアウト機能の実装準備

### Cloud Functions 統合
- [x] 新規ユーザー作成トリガー
  - [x] Users コレクションドキュメント作成
  - [x] デフォルト設定値の付与
- [x] アカウント削除トリガー
  - [x] 関連データのクリーンアップ
- [x] カスタムクレーム更新関数

### Flutter SDK 統合
- [x] FirebaseAuth インスタンス初期化
- [x] 認証状態リスナー実装
- [x] ログイン/ログアウトメソッド実装
- [x] トークン更新処理実装
- [x] 認証画面実装（ログイン、登録、パスワードリセット、リカバリー）

### セキュリティ設定
- [ ] Authorized domains 設定
- [ ] reCAPTCHA 設定（Web）
- [ ] App Check 有効化
- [ ] 異常ログイン検知設定

### テスト
- [x] エミュレータでの認証テスト（ドキュメント作成済み）
- [ ] 各認証プロバイダーのテスト（Console設定後に実行）
- [x] カスタムクレームのテスト（実装済み）
- [x] 認証状態管理のテスト（auth_state_notifier_test完了）
- [ ] セッション管理のテスト（実行待ち）

## ユーザー操作が必要な項目

### Firebase Console操作

**Console URL**: https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication/providers

| 項目 | 内容 | 所要時間 |
|------|------|---------|
| メール/パスワード認証有効化 | Authentication > Sign-in method で有効化 | 2分 |
| Google OAuth設定 | OAuth同意画面設定、クライアントID作成 | 15分 |
| Apple Sign In設定 | App ID、サービスID設定 | 20分 |
| 電話番号認証有効化 | 日本（+81）を許可リストに追加 | 5分 |
| パスワードポリシー設定 | 最小8文字に設定 | 2分 |
| メールテンプレート日本語化 | パスワードリセット、メール確認 | 10分 |
| Authorized domains設定 | 許可ドメインの追加 | 5分 |
| App Check有効化 | セキュリティ強化 | 10分 |

### 外部サービス設定

| サービス | 操作 | 所要時間 |
|---------|------|---------|
| Google Cloud Console | OAuthクライアントID作成、同意画面設定 | 15分 |
| Apple Developer Console | App ID、サービスID、Sign In with Apple設定 | 30分 |

### 認証プロバイダー対応状況

| プロバイダー | コード実装 | Console設定 |
|-------------|-----------|-------------|
| メール/パスワード | 完了 | 要設定 |
| Google OAuth | 完了 | 要設定 |
| Apple Sign In | 完了 | 要設定 |
| 電話番号 | 完了 | 要設定 |

## 受け入れ条件
- [ ] 全ての認証プロバイダーが動作
- [x] カスタムクレームが正しく設定・取得できる
- [ ] セキュリティ設定が完了
- [x] エミュレータでのテストがパス

## 注意事項
- GDPR準拠（同意管理との連携）
- 日本市場向け（電話番号は+81対応）
- 将来の多要素認証対応を考慮

## 参考リンク
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [カスタムクレーム](https://firebase.google.com/docs/auth/admin/custom-claims)
- [FlutterFire Auth](https://firebase.flutter.dev/docs/auth/overview)
