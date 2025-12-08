# 001 Firebaseプロジェクトセットアップ

## 概要

Firebaseプロジェクトの初期設定を行います。開発環境と本番環境の2つのプロジェクトを作成し、Expo版AIフィットネスアプリのバックエンド基盤を構築します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- なし（最初に実施するチケット）

## 要件

### Firebaseプロジェクト作成

1. **開発環境プロジェクト**
   - プロジェクト名: `ai-fitness-app-dev`
   - リージョン: `asia-northeast1`（東京）
   - Firestore: 有効化
   - Authentication: 有効化
   - Storage: 有効化

2. **本番環境プロジェクト**
   - プロジェクト名: `ai-fitness-app-prod`
   - リージョン: `asia-northeast1`（東京）
   - Firestore: 有効化
   - Authentication: 有効化
   - Storage: 有効化

### 有効化するサービス

| サービス | 用途 |
|---------|------|
| Firebase Authentication | ユーザー認証（メール/パスワード、Google） |
| Cloud Firestore | メインデータベース |
| Firebase Storage | ファイル保存（将来用） |
| Cloud Functions | サーバーサイド処理（チケット015で設定） |
| Firebase Crashlytics | クラッシュ監視（チケット006で設定） |
| Firebase Performance | パフォーマンス監視（チケット006で設定） |

### 環境変数の設定

以下の環境変数をプロジェクトで使用できるように設定:

```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

## 受け入れ条件

- [ ] 開発環境用Firebaseプロジェクトが作成されている
- [ ] 本番環境用Firebaseプロジェクトが作成されている
- [ ] 両プロジェクトのリージョンが`asia-northeast1`に設定されている
- [ ] Firebase Authenticationが有効化されている
- [ ] Cloud Firestoreが有効化されている
- [ ] Firebase Storageが有効化されている
- [ ] 環境変数がドキュメント化されている
- [ ] プロジェクト設定情報が安全に管理されている

## 参照ドキュメント

- [要件定義書 Part 1](../specs/01_要件定義書_Expo版_v1_Part1.md)
- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)
- [画面遷移図・ワイヤーフレーム](../specs/07_画面遷移図_ワイヤーフレーム_v1_0.md)

## 技術詳細

### リージョン選定の理由

- `asia-northeast1`（東京）を選択
- 日本市場がメインターゲットのため、低レイテンシーを実現
- GDPR準拠のためデータは日本国内に保存

### 環境分離の方針

| 環境 | Firebase Project | 用途 |
|------|------------------|------|
| 開発環境 | `ai-fitness-app-dev` | 開発・テスト用 |
| 本番環境 | `ai-fitness-app-prod` | 本番サービス用 |

### Firebase CLIのインストール

```bash
npm install -g firebase-tools
firebase login
firebase projects:list
```

## 注意事項

- 本番環境の認証情報は絶対にGitリポジトリにコミットしないこと
- 環境変数は`.env.local`ファイルで管理し、`.gitignore`に追加すること
- プロジェクトIDは一度設定すると変更できないため、慎重に命名すること

## 見積もり

- 想定工数: 2-3時間
- 難易度: 低

## 進捗

- [ ] 未着手
