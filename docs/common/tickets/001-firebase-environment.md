# 001 Firebase環境確認

## 概要

Firebaseの開発環境が正しくセットアップされているかを確認し、開発に必要な設定を整えるチケットです。すでにFirebaseプロジェクト（tokyo-list-478804-e5）が存在するので、そのプロジェクトが使える状態になっているか、開発用と本番用の環境が分かれているかをチェックします。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

なし（最初に着手するチケット）

## 要件

### 機能要件

- なし（環境構築チケットのため）

### 非機能要件

- NFR-005: アップタイム - 99.5%以上の可用性を目指す
- NFR-009: 通信暗号化 - TLS 1.3による通信の暗号化

## 受け入れ条件（Todo）

- [x] Firebaseプロジェクト（tokyo-list-478804-e5）にアクセスできることを確認
- [x] Firebase CLIがインストールされ、ログインできることを確認
- [x] `firebase use` コマンドでプロジェクトを切り替えられることを確認
- [x] Firebaseエミュレータ（Auth, Firestore, Functions）が起動することを確認
- [x] firebase.jsonの設定が正しいことを確認
- [x] .firebasercファイルに開発・本番環境の設定があることを確認
- [ ] 環境変数（GOOGLE_CLOUD_PROJECT等）の設定方法をドキュメント化
- [x] 開発メンバー全員がFirebaseコンソールにアクセスできることを確認

## 参照ドキュメント

- `docs/common/specs/01_プロジェクト概要_v1_0.md` - プロジェクト全体像
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 可用性・セキュリティ要件

## 技術詳細

### 既存プロジェクト情報

```
Firebase Project ID: tokyo-list-478804-e5
リージョン: asia-northeast1（東京）
```

### Firebase CLI確認コマンド

```bash
# CLIのインストール確認
firebase --version

# ログイン状態確認
firebase login:list

# プロジェクト一覧
firebase projects:list

# プロジェクト切り替え
firebase use tokyo-list-478804-e5
```

### エミュレータ起動確認

```bash
# エミュレータ起動（プロジェクトルートで実行）
firebase emulators:start

# エミュレータUI
# http://localhost:4000
```

### 環境変数設定例

開発環境と本番環境で異なる値を使う場合：

```bash
# 開発環境（.env.local）
GOOGLE_CLOUD_PROJECT=tokyo-list-478804-e5
FIREBASE_PROJECT_ID=tokyo-list-478804-e5
ENVIRONMENT=development

# 本番環境（.env.production）
GOOGLE_CLOUD_PROJECT=tokyo-list-478804-e5-prod
FIREBASE_PROJECT_ID=tokyo-list-478804-e5-prod
ENVIRONMENT=production
```

### firebase.json の確認項目

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月10日

## 備考

- Flutter版で既にセットアップ済みのFirebaseプロジェクトを使用
- Expo版でも同じFirebaseプロジェクトを使用する
- 本番環境のセットアップは、Phase 2の終盤で別途検討

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 既存セットアップを反映、ステータスを完了に更新 |
