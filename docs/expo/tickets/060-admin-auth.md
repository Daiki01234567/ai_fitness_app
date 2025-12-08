# 060 管理者認証基盤

## 概要
管理者向けの認証システムを構築します。Firebase Custom Claimsを使用した権限管理を実装します。

## Phase
Phase 4（管理者・運用者・多言語）

## 依存チケット
- 004: Firebase Authentication設定

## 要件
- 管理者用Firebase認証
- Custom Claimsによるロール管理
- 管理者ログイン画面
- セッション管理
- 2要素認証（オプション）

## 受け入れ条件
- [ ] 管理者アカウントが作成できる
- [ ] Custom Claimsでロール（admin, operator, viewer）が設定できる
- [ ] 管理者用ログイン画面が動作する
- [ ] セッションタイムアウトが機能する
- [ ] 不正アクセス時にログアウトされる

## 参照ドキュメント
- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - セキュリティ要件
- `docs/expo/specs/03_要件定義書_Expo版_v1_Part3.md` - システムアーキテクチャ

## 技術詳細
- Firebase Admin SDK
- Custom Claims: `{ admin: true, role: 'admin' | 'operator' | 'viewer' }`
- セッション期限: 8時間
- IPホワイトリスト（オプション）

## ロール権限
| ロール | 権限 |
|--------|------|
| admin | 全機能アクセス可 |
| operator | ユーザー管理、コンテンツ管理 |
| viewer | 閲覧のみ |

## 見積もり
3日

## 進捗
- [ ] 未着手
