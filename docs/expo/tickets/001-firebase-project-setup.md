# 001 Firebaseプロジェクトセットアップ

## 概要

既存のFirebaseプロジェクト（`tokyo-list-478804-e5`）にExpo版アプリを登録し、開発環境を整備します。
仕様書の方針に従い、バックエンド（Firebase、Firestore、Cloud Functions）はFlutter版と共有します。

## Phase

Phase 1（基盤構築）

## 依存チケット

- なし（最初に実施するチケット）

## 要件

### 既存Firebaseプロジェクトの確認

1. **プロジェクト情報**
   - プロジェクトID: `tokyo-list-478804-e5`
   - リージョン: `asia-northeast1`（東京）
   - 状態: ACTIVE（確認済み）

2. **有効化済みサービス**
   - Firebase Authentication
   - Cloud Firestore
   - Firebase Storage
   - Cloud Functions

### Expo版アプリの登録

1. **iOS用アプリ追加**
   - Bundle ID: `com.aifitness.expo`
   - App nickname: AI Fitness Expo iOS
   - App ID: `1:895851221884:ios:929b5330a5feeb16cb8af9`

2. **Android用アプリ追加**
   - Package name: `com.aifitness.expo`
   - App nickname: AI Fitness Expo Android
   - App ID: `1:895851221884:android:113ff39312585df0cb8af9`

3. **設定ファイルの取得**
   - `google-services.json`（Android）- SDK設定取得済み
   - `GoogleService-Info.plist`（iOS）- SDK設定取得済み

### 環境変数の設定

以下の環境変数を`.env.development`および`.env.production`で管理:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
```

## 受け入れ条件

- [x] 既存Firebaseプロジェクトの状態を確認済み
- [x] Expo版iOS用アプリがFirebaseコンソールに登録されている
- [x] Expo版Android用アプリがFirebaseコンソールに登録されている
- [x] 設定ファイル（google-services.json, GoogleService-Info.plist）のSDK設定を取得済み
- [x] 環境変数ファイル（.env.example, .env.development）が作成されている
- [x] .gitignoreに機密ファイルが追加されている
- [ ] Firebase接続テストが成功している → チケット002で実施

## 参照ドキュメント

- [要件定義書 Part 3（システムアーキテクチャ）](../specs/03_要件定義書_Expo版_v1_Part3.md)
  - 「バックエンドは Flutter 版から変更なし」の記載に準拠
- [ユーザー向けセットアップガイド](../user/001-firebase-setup-guide.md)

## 技術詳細

### リージョン

- 既存プロジェクトの`asia-northeast1`（東京）をそのまま使用
- Cloud Functionsのリージョンも変更なし

### Flutter版との共存

- 同一Firestoreを共有（データ整合性を維持）
- Cloud Functionsを共有（API互換性を維持）
- 認証基盤を共有（ユーザーアカウント統合）

### 本番環境分離（将来計画）

MVP完成後、以下の条件で本番環境分離を検討:
1. ユーザー数が1,000人を超えた場合
2. 課金機能（Phase 3）実装時
3. セキュリティ監査で環境分離が必要と判断された場合

### 作成されたファイル

| ファイル | 場所 | 説明 |
|---------|------|------|
| `.env.example` | `expo_app/` | 環境変数テンプレート |
| `.env.development` | `expo_app/` | 開発環境設定（Git除外） |
| `.gitignore` | `expo_app/` | Git除外設定 |
| セットアップガイド | `docs/expo/user/` | ユーザー向け手順書 |

## 注意事項

- 環境変数ファイル（.env.*）は絶対にGitリポジトリにコミットしないこと
- 設定ファイル（google-services.json等）もGit管理対象外とすること
- Flutter版の既存ユーザーデータへの影響を考慮すること

## 見積もり

- 想定工数: 1-2時間（既存プロジェクト流用のため短縮）
- 難易度: 低

## 進捗

- [x] 完了（2025-12-09）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-09 | 仕様書（Part3）との整合性確保のため、新規プロジェクト作成方針から既存プロジェクト流用方針に変更 |
| 2025-12-09 | Expo版アプリ（iOS/Android）をFirebaseに登録完了 |
| 2025-12-09 | 環境変数ファイルとユーザー向けガイドを作成 |
