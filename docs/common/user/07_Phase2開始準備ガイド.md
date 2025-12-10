# Phase 2 開始準備ガイド

このドキュメントは、Phase 1（基盤構築）が完了した後、Phase 2（API・データパイプライン実装）を開始するために必要な準備と手順を説明します。

## 目次

1. [Phase 1 完了確認](#1-phase-1-完了確認)
2. [Phase 2 概要](#2-phase-2-概要)
3. [開発環境の確認](#3-開発環境の確認)
4. [優先チケットの確認](#4-優先チケットの確認)
5. [技術準備事項](#5-技術準備事項)
6. [開発開始手順](#6-開発開始手順)

---

## 1. Phase 1 完了確認

Phase 2を開始する前に、Phase 1が完了していることを確認してください。

### 完了チェックリスト

以下の全てにチェックが入っていることを確認してください：

- [x] チケット001: Firebase環境確認 - 完了
- [x] チケット002: Firestore Security Rules実装 - 完了
- [x] チケット003: Cloud Functions基盤 - 完了
- [x] チケット004: 認証トリガー実装 - 完了
- [x] チケット005: 監視・ログ基盤 - 完了
- [x] チケット006: GDPR同意管理API - 完了
- [x] チケット007: ユーザーAPI - 完了
- [x] チケット008: CI/CDパイプライン - 完了
- [x] チケット009: セキュリティレビュー - 完了
- [x] チケット010: Phase 1完了確認 - 完了

### テスト結果の確認

Phase 1のテストが全て通過していることを確認します：

```bash
# Cloud Functions テスト
cd functions
npm test

# Firestore Rules テスト（オプション）
cd firebase
npm test
```

**期待される結果**:
- Cloud Functions: 1394件のテストが全て成功
- Firestore Rules: 45件のテストが全て成功

---

## 2. Phase 2 概要

### 期間
- 2ヶ月目〜7ヶ月目

### 目標
- トレーニング記録機能（コア機能）の実装
- BigQuery分析パイプラインの構築
- GDPR関連機能の拡張
- プッシュ通知基盤の構築

### チケット範囲
- チケット011〜030（20チケット）

### 主要な成果物
1. トレーニングセッションAPI（011-014）
2. BigQueryストリーミングパイプライン（015-017）
3. GDPRデータ削除機構（018-021）
4. プッシュ通知システム（022-023）
5. その他のユーティリティAPI（024-030）

---

## 3. 開発環境の確認

### 必要なツール

以下のツールがインストールされていることを確認してください：

```bash
# Node.js バージョン確認（v24推奨）
node --version

# npm バージョン確認
npm --version

# Firebase CLI バージョン確認
firebase --version

# TypeScript バージョン確認
npx tsc --version
```

### プロジェクトの最新化

```bash
# リポジトリの最新を取得
git pull origin main

# 依存関係のインストール
cd functions
npm install

# ビルドテスト
npm run build
```

### エミュレータの起動確認

```bash
# プロジェクトルートで実行
firebase emulators:start

# エミュレータUIにアクセス
# http://localhost:4000
```

---

## 4. 優先チケットの確認

Phase 2のチケットは以下の優先順位で実装します。

### 最優先（コア機能）

| チケット | タイトル | 説明 |
|---------|---------|------|
| 011 | トレーニングセッション保存API | セッション作成・更新 |
| 012 | セッション取得API | 単一セッション取得 |
| 013 | トレーニング履歴一覧API | セッション一覧取得 |
| 014 | セッション削除API | セッション削除 |

### 高優先（法的要件・分析基盤）

| チケット | タイトル | 説明 |
|---------|---------|------|
| 015 | BigQueryストリーミングパイプライン | リアルタイムデータ同期 |
| 018 | GDPRデータ削除リクエストAPI | 削除リクエスト受付 |
| 019 | データ削除スケジューラ | 30日後の自動削除 |

### 中優先（UX向上）

| チケット | タイトル | 説明 |
|---------|---------|------|
| 022 | プッシュ通知トリガー | 通知送信基盤 |
| 023 | プッシュ通知スケジューラ | 定期通知 |

---

## 5. 技術準備事項

### 5.1 トレーニングAPI（011-014）

**既に準備済みの項目**:
- 型定義: `functions/src/types/training.ts`
- API基盤: `functions/src/api/training/`（一部実装済み）
- セキュリティルール: `sessions`サブコレクション用ルール

**実装するファイル**:
```
functions/src/api/training/
├── createSession.ts    # 011で実装
├── getSession.ts       # 012で実装
├── listSessions.ts     # 013で実装
├── deleteSession.ts    # 014で実装
└── completeSession.ts  # セッション完了処理
```

### 5.2 BigQueryパイプライン（015-017）

**既に準備済みの項目**:
- BigQueryサービス: `functions/src/services/bigquery.ts`
- DLQスケジューラ: `functions/src/scheduled/bigqueryDlq.ts`

**追加で必要な作業**:
- BigQueryテーブルの作成（Google Cloud Console）
- ストリーミングインサートの実装
- データ匿名化処理の適用

### 5.3 GDPR機能（018-021）

**既に準備済みの項目**:
- GDPR基本API: `functions/src/api/gdpr/`
- 削除サービス: `functions/src/services/gdprDeletion.ts`
- 復旧サービス: `functions/src/services/gdprRecovery.ts`

**追加で必要な作業**:
- 削除リクエストのスケジューリング
- 削除前通知機能
- 削除予定管理ダッシュボード用API

### 5.4 プッシュ通知（022-023）

**既に準備済みの項目**:
- Firebase Admin SDK（firebase-admin）
- Cloud Tasks基盤: `functions/src/services/cloudTasks.ts`

**追加で必要な作業**:
- FCMトークン管理
- 通知テンプレート作成
- 送信スケジューラ実装

---

## 6. 開発開始手順

### ステップ1: ブランチの作成

```bash
# 最新のmainから作業ブランチを作成
git checkout main
git pull origin main
git checkout -b feature/011-training-session-api
```

### ステップ2: チケットの確認

作業開始前に、チケットの詳細を確認してください：

```
docs/common/tickets/011-training-session-save.md
```

### ステップ3: 実装

チケットの受け入れ条件（Todo）に従って実装を進めます。

### ステップ4: テスト

```bash
# ユニットテスト実行
cd functions
npm test

# 特定のテストファイルのみ実行
npm test -- tests/api/training/createSession.test.ts
```

### ステップ5: PRの作成

```bash
# 変更をコミット
git add .
git commit -m "feat: トレーニングセッション保存API実装 (#011)"

# リモートにプッシュ
git push origin feature/011-training-session-api
```

GitHubでPRを作成し、レビューを依頼してください。

---

## 注意事項

### 仕様書の確認

実装前に必ず以下の仕様書を確認してください：

1. `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データ構造
2. `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - API仕様
3. `docs/expo/specs/02_開発計画_v1_0.md` - 開発計画

### フロントエンドとの連携

Phase 2のバックエンドAPIが完了すると、以下のExpo版チケットが実装可能になります：

- チケット024: 履歴画面（011-014完了後）
- チケット028: 通知設定機能（022-023完了後）

フロントエンドチームと連携して、API仕様の確認を行ってください。

---

## 参照ドキュメント

- `docs/common/tickets/000-ticket-overview.md` - チケット全体管理
- `docs/common/tickets/010-phase1-completion.md` - Phase 1完了報告
- `docs/common/specs/02-1_機能要件_v1_0.md` - 機能要件
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 非機能要件

---

**作成日**: 2025年12月10日
**対象**: AIフィットネスアプリ開発チーム
