# AI Fitness App

AIを活用したフィットネスアプリ - MediaPipeによるリアルタイム姿勢検出

## プロジェクト概要

本プロジェクトは、スマートフォンのカメラを使用してユーザーのトレーニングフォームをリアルタイムで分析し、改善提案を行うAIフィットネスアプリです。日本市場向けに開発され、GDPR準拠のプライバシー設計を採用しています。

### 主な機能

- **5種目のフォーム確認**: スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス
- **MediaPipeによるオンデバイス姿勢検出**: プライバシー優先設計（カメラ映像はデバイス外に送信されません）
- **リアルタイムフィードバック**: 音声ガイダンスによるフォーム改善提案
- **トレーニング履歴と分析**: セッション記録、カレンダー表示、グラフ表示
- **パーソナルベスト記録**: 種目別の最高記録管理
- **サブスクリプション課金**: Stripe決済（Phase 3で実装予定）

---

## 技術スタック

### フロントエンド (Expo/React Native)

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Expo SDK 52+, React Native |
| 言語 | TypeScript |
| 状態管理 | Zustand |
| サーバー状態 | TanStack Query (React Query) |
| ルーティング | Expo Router |
| UI | React Native Paper (Material Design 3) |
| カメラ | react-native-vision-camera |
| 姿勢検出 | MediaPipe Pose (ネイティブモジュール) |

### バックエンド (Firebase)

| カテゴリ | 技術 |
|---------|------|
| サーバーレス関数 | Firebase Cloud Functions (TypeScript/Node 24) |
| データベース | Firestore |
| 認証 | Firebase Authentication |
| 分析 | BigQuery |
| 非同期処理 | Cloud Tasks |
| 通知 | Firebase Cloud Messaging |

---

## 5種目

本アプリは以下の5種目のフォーム評価に対応しています:

| 種目 | 英語名 | 主な評価ポイント |
|------|--------|------------------|
| スクワット | Squat | 膝角度 90-110度、膝がつま先を越えないか |
| プッシュアップ | Push-up | 体のライン維持、肘角度 90度 |
| アームカール | Arm Curl | 肘角度 30-160度、反動検出 |
| サイドレイズ | Side Raise | 腕の挙上角度 70-90度、左右対称性 |
| ショルダープレス | Shoulder Press | 肘の軌道、腰の反り検出 |

---

## 進捗状況

### Phase構成

| Phase | 期間 | 目標 | Expo版 | Common版 |
|-------|------|------|--------|----------|
| Phase 1 | 0-2ヶ月 | 基盤構築 | **100%** (10/10) | **100%** (10/10) |
| Phase 2 | 2-7ヶ月 | MediaPipe統合・画面実装 | **35%** (7/20) + 7進行中 | **100%** (20/20) |
| Phase 3 | 8ヶ月目以降 | 課金機能 | 0% (0/10) | 0% (0/10) |
| Phase 4 | 将来 | 管理者機能 | 0% (0/10) | 0% (0/10) |

### 現在の状況（2025年12月11日時点）

```
Expo版（フロントエンド）:
Phase 1: ########## 100% (10/10) [完了]
Phase 2: #####-----  35% (7/20) + 7件進行中
Phase 3: ----------   0% (0/10)
Phase 4: ----------   0% (0/10)
全体:    ######----  34% (17/50)

Common版（バックエンド）:
Phase 1: ########## 100% (10/10) [完了]
Phase 2: ########## 100% (20/20) [完了]
Phase 3: ----------   0% (0/10)
Phase 4: ----------   0% (0/10)
全体:    ##########  60% (30/50)
```

### 次のマイルストーン

| マイルストーン | 状態 | 完了条件 |
|---------------|------|----------|
| M1: Phase 1完了 | **完了** | Expo/Common基盤構築完了 |
| M2: MediaPipe PoC完了 | **進行中** | 姿勢検出動作確認（実機テスト待ち） |
| M3: 5種目実装完了 | **進行中** | 全評価ロジック実装（014完了、015-019実機テスト待ち） |
| M4: MVP完成 | 未着手 | ストア申請準備完了 |
| M5: 課金機能リリース | 未着手 | Stripe課金稼働 |

---

## クイックスタート

### 必要条件

- Node.js 20 LTS以上
- npm または yarn
- Firebase CLI
- Git
- Expo Go アプリ（スマートフォン）または Android/iOS エミュレータ

### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/your-org/ai_fitness_app.git
   cd ai_fitness_app
   ```

2. **Firebase CLIのインストールと認証**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集して必要な値を設定
   ```

4. **Firebase Emulatorsの起動**

   Windows:
   ```bash
   scripts\start-emulators.bat
   ```

   Mac/Linux:
   ```bash
   chmod +x scripts/start-emulators.sh
   ./scripts/start-emulators.sh
   ```

   エミュレータが起動すると以下のポートで利用可能になります:
   - Firestore: http://localhost:8080
   - Auth: http://localhost:9099
   - Functions: http://localhost:5001
   - Storage: http://localhost:9199
   - Emulator UI: http://localhost:4000

---

## 開発コマンド

### Expoアプリ (expo_app/)

```bash
cd expo_app

# 依存関係インストール
npm install

# 開発サーバー起動
npx expo start

# Android/iOSで実行
npx expo start --android
npx expo start --ios

# テスト実行
npm test

# リント・型チェック
npm run lint
npm run type-check

# ネイティブプロジェクト生成（MediaPipe用）
npx expo prebuild
```

### Firebase Functions (functions/)

```bash
cd functions

# 依存関係インストール
npm install

# リント
npm run lint
npm run lint:fix

# フォーマット
npm run format

# ビルド
npm run build
npm run build:watch

# テスト実行
npm test
npm run test:watch
npm run test:coverage

# ローカルエミュレーション
npm run serve
```

### Firebase操作 (プロジェクトルート)

```bash
# エミュレータ起動 (UI: localhost:4000)
firebase emulators:start

# デプロイ
firebase deploy                            # 全体デプロイ
firebase deploy --only functions           # Functionsのみ
firebase deploy --only firestore:rules     # セキュリティルールのみ
```

---

## プロジェクト構造

```
ai_fitness_app/
├── expo_app/                     # Expo/React Nativeアプリ
│   ├── app/                      # Expo Router画面
│   │   ├── (auth)/               # 認証関連画面グループ
│   │   ├── (tabs)/               # タブナビゲーション画面グループ
│   │   ├── training/             # トレーニング関連画面
│   │   ├── _layout.tsx           # ルートレイアウト
│   │   └── index.tsx             # エントリーポイント
│   ├── components/               # 再利用可能コンポーネント
│   │   ├── training/             # トレーニング関連コンポーネント
│   │   └── common/               # 共通コンポーネント
│   ├── lib/                      # ライブラリ・ユーティリティ
│   │   └── pose/                 # 姿勢検出関連
│   ├── services/                 # ビジネスロジック層
│   ├── store/                    # Zustand状態管理ストア
│   ├── types/                    # TypeScript型定義
│   └── __tests__/                # Jestテスト
│
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── api/                  # HTTP callable関数
│   │   │   ├── training/         # トレーニングAPI
│   │   │   ├── consent/          # GDPR同意管理API
│   │   │   ├── feedback/         # フィードバックAPI
│   │   │   ├── notification/     # 通知API
│   │   │   ├── settings/         # 設定API
│   │   │   └── backup/           # バックアップAPI
│   │   ├── middleware/           # 認証・レート制限
│   │   ├── services/             # ビジネスロジック
│   │   ├── triggers/             # Firestoreトリガー
│   │   ├── types/                # TypeScript型定義
│   │   └── utils/                # ユーティリティ
│   └── tests/                    # Jestテスト
│
├── docs/
│   ├── common/
│   │   ├── specs/                # 共通仕様書（11ファイル）
│   │   ├── tickets/              # Commonチケット（50件）
│   │   ├── user/                 # ユーザーガイド
│   │   └── phase2_guides/        # Phase 2開発ガイド
│   └── expo/
│       ├── specs/                # Expo固有仕様書（3ファイル）
│       ├── tickets/              # Expoチケット（50件）
│       ├── user/                 # Expoユーザーガイド
│       └── reports/              # 開発レポート
│
├── firebase/                     # Firebase設定
├── firebase.json                 # Firebase設定
├── firestore.rules               # Firestoreセキュリティルール
├── firestore.indexes.json        # Firestoreインデックス
├── eas.json                      # EAS Build設定
└── CLAUDE.md                     # 開発ガイドライン
```

---

## ドキュメント

### 開発ガイドライン

| ドキュメント | パス | 説明 |
|-------------|------|------|
| CLAUDE.md | `/CLAUDE.md` | 開発時の制約事項とベストプラクティス |

### 共通仕様書 (docs/common/specs/)

| ドキュメント | 説明 |
|-------------|------|
| 01_プロジェクト概要_v1_0.md | プロジェクト全体像、市場分析、5種目定義 |
| 02-1_機能要件_v1_0.md | 38機能要件（FR-001〜FR-038） |
| 02-2_非機能要件_v1_0.md | 43非機能要件（NFR-001〜NFR-043） |
| 03_Firestoreデータベース設計書_v1_0.md | データ構造とセキュリティルール |
| 04_API設計書_Firebase_Functions_v1_0.md | Cloud Functions API仕様 |
| 05_BigQuery設計書_v1_0.md | 分析基盤設計 |
| 06_フォーム評価ロジック_v1_0.md | 5種目のフォーム評価ロジック |
| 07_データ処理記録_ROPA_v1_0.md | GDPR準拠のデータ処理記録 |
| 08_セキュリティポリシー_v1_0.md | セキュリティ要件 |
| 09_利用規約_v1_0.md | 利用規約 |
| 10_プライバシーポリシー_v1_0.md | プライバシーポリシー |
| 11_画面遷移図_ワイヤーフレーム_v1_0.md | 15画面の遷移とUI設計 |

### Expo固有仕様書 (docs/expo/specs/)

| ドキュメント | 説明 |
|-------------|------|
| 01_技術スタック_v1_0.md | Zustand, Expo Router, React Native Paper, MediaPipe統合 |
| 02_開発計画_v1_0.md | Phase 1-5詳細タスク、週次スケジュール |

### 開発チケット

| プラットフォーム | パス | 件数 |
|----------------|------|------|
| Common（共通バックエンド） | `docs/common/tickets/` | 50件 |
| Expo版（フロントエンド） | `docs/expo/tickets/` | 50件 |

### ユーザーガイド (docs/common/user/)

| ドキュメント | 説明 |
|-------------|------|
| Firebaseエミュレータセットアップガイド | ローカル開発環境構築 |
| BigQueryセットアップガイド | 分析基盤構築 |
| GDPR機能ユーザーガイド | GDPR対応機能の使い方 |
| GDPR_API開発者ガイド | GDPR API実装ガイド |
| 通知・フィードバック・設定機能ガイド | 通知・設定機能の使い方 |

---

## アーキテクチャ

### データフロー

```
モバイルアプリ (Expo/React Native)
    | MediaPipeでローカル処理（プライバシー優先、30fps目標）
    | スケルトンデータのみ送信（33関節 x 4値）
    v
Cloud Function (HTTPS トリガー)
    | バリデーション後 Firestore 保存
    | Cloud Task で非同期処理
    v
BigQuery（匿名化された分析データ）
    | 2年保存（GDPR準拠）
```

### 状態管理

- **Zustand**: シンプルで柔軟な状態管理（authStore, trainingStore）
- **TanStack Query**: サーバー状態管理（キャッシュ、再取得、楽観的更新）
- **Expo Router**: ファイルベースルーティング、認証状態に応じた自動リダイレクト

---

## 法的要件

### 薬機法対応

- 本アプリは医療機器ではありません
- 「治療」「診断」「治す」といった用語は使用禁止
- 使用可能な用語：「フィットネス」「運動」「トレーニング」「健康維持」

### GDPR対応

- 72時間以内の違反通知
- データ最小化原則
- ユーザー権利（アクセス、削除、ポータビリティ）
- 削除30日間猶予期間（deletionScheduledフラグ）
- 同意追跡は別の不変コレクション

---

## プロジェクト情報

| 項目 | 値 |
|------|-----|
| **Project ID** | tokyo-list-478804-e5 |
| **Version** | 0.2.0 (MVP Phase 2) |
| **最終更新** | 2025-12-11 |
| **ターゲット市場** | 日本 |
| **対象種目** | 5種目 |

---

## ライセンス

このプロジェクトはプライベートリポジトリです。

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 0.2.0 | 2025-12-11 | README更新（Expo版対応、進捗状況更新） |
| 0.1.0 | - | 初版作成（Flutter版想定） |
