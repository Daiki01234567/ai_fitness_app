# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 重要な制約事項

### 必ず守るべき開発ルール

1. **ドキュメント優先の原則**
   - コード実装・設計・レビュー・タスク分解などを行う際は、**必ず `docs/specs` 配下のドキュメントを最優先で参照してください**
   - 推測ではなく、**要件定義書・各種設計書・ポリシー類を根拠に判断してください**

2. **推測を行う場合の明示**
   - ドキュメントに書かれていないことを実装する場合は、**「推測である」「暫定案である」ことを明示**してください
   - 必ず**選択肢とトレードオフを提示**してください

3. **仕様書の参照順序**
   1. まず要件定義書で機能要件を確認
   2. 該当する設計書で詳細設計を確認
   3. 実装に入る前に関連する全ドキュメントを確認

## 📁 仕様書ドキュメント一覧

| カテゴリ | ファイル | 内容 |
|---------|---------|------|
| 要件 | `docs/specs/00_要件定義書_v3_3.md` | 38機能要件 + 37非機能要件 |
| 要件 | `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md` | Phase 1-2タスクとスケジュール |
| アーキテクチャ | `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` | システム全体設計 |
| データ | `docs/specs/02_Firestoreデータベース設計書_v3_3.md` | データ構造とセキュリティルール |
| API | `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` | Cloud Functions API仕様 |
| 分析 | `docs/specs/04_BigQuery設計書_v3_3.md` | 分析基盤設計 |
| UI | `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md` | 15画面の遷移とUI設計 |
| ロジック | `docs/specs/08_README_form_validation_logic_v3_3.md` | 5種目のフォーム評価ロジック |
| 法令 | `docs/specs/06_データ処理記録_ROPA_v1_0.md` | GDPR準拠のデータ処理記録 |
| セキュリティ | `docs/specs/07_セキュリティポリシー_v1_0.md` | セキュリティ要件 |
| 法務 | `docs/specs/利用規約_v3_2.md`, `docs/specs/プライバシーポリシー_v3.1.md` | 利用規約・プライバシーポリシー |

## プロジェクト概要

AIを活用したフィットネスアプリ（MediaPipeによるオンデバイス姿勢検出）。日本市場向けでGDPR準拠、薬機法上の医療機器には該当しない。

- **Firebase Project ID**: `tokyo-list-478804-e5`
- **開発フェーズ**: MVP Phase 1-2 (0-7ヶ月)
- **技術スタック**: Flutter (Dart 3.10+) + Firebase Functions (TypeScript/Node 24) + Firestore + BigQuery

## 開発コマンド

### Flutter (flutter_app/)
```bash
flutter pub get                    # 依存関係インストール
flutter analyze                    # 静的解析
flutter run                        # デバイス実行
flutter test                       # 全テスト実行
flutter test test/screens/auth/    # 特定ディレクトリのテスト
dart run build_runner build        # Freezed/Riverpodコード生成
```

### Firebase Functions (functions/)
```bash
npm install                 # 依存関係インストール
npm run lint                # ESLint (Google style, double quotes)
npm run lint:fix            # ESLint自動修正
npm run format              # Prettier フォーマット
npm run build               # TypeScriptコンパイル
npm run build:watch         # ウォッチモード
npm test                    # Jestテスト実行
npm run test:watch          # テストウォッチモード
npm run test:coverage       # カバレッジレポート
npm run serve               # ローカルエミュレーション
```

### Firebase操作 (プロジェクトルート)
```bash
firebase emulators:start                   # エミュレータ起動 (UI: localhost:4000)
firebase deploy                            # 全体デプロイ
firebase deploy --only functions           # Functions のみ
firebase deploy --only firestore:rules     # セキュリティルールのみ
```

## アーキテクチャ

### コードベース構造

```
flutter_app/
├── lib/
│   ├── main.dart                 # アプリエントリーポイント、Firebase初期化
│   ├── firebase_options.dart     # Firebase設定（自動生成）
│   ├── core/
│   │   ├── auth/                 # 認証サービス、状態管理（Riverpod）
│   │   ├── router/               # GoRouterベースのナビゲーション
│   │   ├── theme/                # Material 3テーマ
│   │   ├── utils/                # バリデーション等ユーティリティ
│   │   └── widgets/              # 共通ウィジェット
│   └── screens/                  # 画面コンポーネント（auth/, home/, splash/）
└── test/                         # ウィジェットテスト

functions/
├── src/
│   ├── index.ts                  # 関数エントリーポイント、グローバル設定
│   ├── auth/                     # Auth triggers（onCreate, onDelete, customClaims）
│   ├── api/                      # HTTP callable関数（users/）
│   ├── middleware/               # 認証、バリデーション、レート制限
│   ├── services/                 # BigQuery、CloudTasksサービス
│   ├── types/                    # TypeScript型定義
│   └── utils/                    # ロガー、バリデーション、エラー処理
└── tests/                        # Jestテスト、モック

firebase/
├── firestore.rules               # Firestoreセキュリティルール
├── firestore.indexes.json        # インデックス定義
└── storage.rules                 # Storageセキュリティルール

docs/
├── specs/                        # 仕様書（参照必須）
└── tickets/                      # 開発チケット（001-020）
```

### 状態管理・ルーティング

- **Riverpod**: `authStateProvider` で認証状態管理、`ProviderScope` でDI
- **GoRouter**: `appRouterProvider` で認証状態に応じたリダイレクト制御
- **Freezed**: 不変状態クラス生成（`*.freezed.dart`）

### Firebase Functions グローバル設定

```typescript
setGlobalOptions({
  region: "asia-northeast1",  // 東京リージョン
  maxInstances: 10,           // コスト制御
  memory: "256MiB",
  timeoutSeconds: 60,
});
```

### 仕様書の参照順序

1. `00_要件定義書_v3_3.md` → 機能要件（FR-xxx）
2. `01_システムアーキテクチャ設計書_v3_2.md` → 実装方法
3. `02_Firestoreデータベース設計書_v3_3.md` → データ構造
4. `03_API設計書_Firebase_Functions_v3_3.md` → API仕様
5. `05_画面遷移図_ワイヤーフレーム_v3_3.md` → 15画面（4タブ）

### データフローアーキテクチャ

```
モバイルアプリ (Flutter)
    ↓ MediaPipe でローカル処理（プライバシー優先）
    ↓ スケルトンデータのみ送信（33関節×4値）
Cloud Function (HTTPS トリガー)
    ↓ バリデーション後 Firestore 保存
    ↓ Cloud Task で非同期処理
BigQuery（匿名化された分析データ）
    ↓ 2年保存（GDPR準拠）
```

### 重要なパターン

**プライバシー優先処理**:
- カメラ映像はデバイスから出ない
- MediaPipe はオンデバイス実行（目標30fps、最低15fps）
- 骨格関節データのみ送信

**GDPR準拠**:
- 削除30日間猶予期間（`deletionScheduled` フラグ）
- Firestore ルールでフィールドレベルアクセス制御
- 同意追跡は別の不変コレクション
- `tosAccepted`、`ppAccepted` フィールドはユーザー読み取り専用

**セキュリティ層**:
1. TLS 1.3 による通信暗号化
2. Firebase Auth とカスタムクレーム
3. Firestore フィールドレベルセキュリティルール
4. 保存時暗号化（Google管理）

**イベント駆動バックエンド**:
- Firestore トリガーによるビジネスロジック
- Cloud Tasks によるリトライ（指数バックオフ）
- Dead Letter Queue による失敗処理
- スケジュール関数によるメンテナンス

### Firestore主要コレクション

`02_Firestoreデータベース設計書_v3_3.md` より：

- **Users**: プロファイル、同意フラグ、`deletionScheduled` 状態
- **Sessions**: `poseData` と `sessionMetadata` を含むトレーニングデータ
- **Consents**: 同意変更の不変監査ログ
- **DataDeletionRequests**: 30日猶予期間管理
- **BigQuerySyncFailures**: 分析パイプラインのDLQ

### フォーム評価ロジック

`08_README_form_validation_logic_v3_3.md` による MediaPipe Pose 検出を使用した5種目：

1. **スクワット**: 膝角度 90-110°、膝がつま先を越えないかチェック
2. **アームカール**: 肘角度 30-160°、反動検出
3. **サイドレイズ**: 腕の挙上角度 70-90°、左右対称性チェック
4. **ショルダープレス**: 肘の軌道、腰の反りチェック
5. **プッシュアップ**: 体のライン維持、肘角度 90°

各種目は状態マシンによるレップカウントと0-100点のスコアリングを実装。

## 現在の実装状況

**完了済み**:
- 包括的な仕様書（v3.3）
- Firebase プロジェクトセットアップ、エミュレータ設定
- Cloud Functions 基盤（auth triggers, API scaffolding, middleware, services）
- Flutter 認証画面（ログイン、登録、パスワードリセット）、ホーム画面
- Riverpod 状態管理、GoRouter ルーティング
- テスト基盤（Jest for Functions, Flutter test）

**進行中**:
- Firestore セキュリティルール（現在は開発用の全許可ルール）
- 追加 API エンドポイント実装

**未着手**:
- MediaPipe 統合、フォーム評価アルゴリズム
- BigQuery パイプライン
- 決済機能（RevenueCat）

## タスク管理とチケット運用

開発タスクは `/docs/tickets/` ディレクトリに番号付きマークダウンファイル（001-020）として管理。

**進捗管理**: Todoアイテムは `[ ]` → `[x]` で完了マーク。作業完了後は即座に更新。

## 開発上の制約

### 法的要件

**薬機法**:
- 医療機器ではない
- 「治療」「診断」「治す」といった用語は使用禁止
- 使用可能：「フィットネス」「運動」「トレーニング」「健康維持」

**GDPR**:
- 72時間以内の違反通知
- データ最小化原則
- ユーザー権利（アクセス、削除、ポータビリティ）
- 詳細は `docs/specs/06_データ処理記録_ROPA_v1_0.md` 参照

**利用規約・プライバシーポリシー**:
- `docs/specs/利用規約_v3_2.md` で全文確認
- `docs/specs/プライバシーポリシー_v3.1.md` で全文確認

### パフォーマンス要件

**MediaPipe**:
- 対象デバイスで最低30fps（NFR-024、NFR-025）
- 低スペックデバイスでのフォールバック実装

**Cloud Functions**:
- 最大インスタンス数：10（コスト制御）
- コールドスタート対策（NFR-037）

**BigQuery**:
- ストリーミングインサート使用（バッチ処理ではない）
- データ保存期間：2年（GDPR準拠）

### コードスタイル

**TypeScript**:
- ESLint Google スタイル
- ダブルクォート使用
- strict モード有効

**Flutter**:
- flutter_lints パッケージのルール適用

**言語**:
- コード内コメント：英語（保守性のため）
- UI テキスト：日本語（ターゲット市場）
- **日本語で記述するもの（原則）**:
  - ドキュメント作成（README、設計書、チケット等）
  - Docstring / JSDoc / DartDoc
  - ユーザー向けコンソール出力・ログメッセージ
  - エラーメッセージ（ユーザー向け）
  - チュートリアル・ガイド
  - コミットメッセージ
  - PRの説明文
- **英語で記述するもの**:
  - コード内コメント（インラインコメント）
  - 変数名・関数名・クラス名
  - 内部システムログ（デバッグ用）

## コーディングベストプラクティス

### TypeScript (Firebase Functions)

- **型安全性**: `any` を避け `unknown` + 型ガードを使用、引数と戻り値に型を明示
- **非同期処理**: `async/await` + `try/catch`、並列処理は `Promise.all()`
- **関数設計**: 単一責任、純粋関数優先、冪等性を保つ
- **エラーハンドリング**: `functions.https.HttpsError` でクライアントに返す、ログにコンテキストを含める（センシティブ情報は除外）
- **パフォーマンス**: Firestore読み取り最小化、バッチは500件以下、不要なインポート削減（コールドスタート対策）

### Dart/Flutter

- **Null Safety**: `?.`, `??` を活用、`late` は初期化保証時のみ
- **Widget設計**: StatelessWidget優先、`const` コンストラクタ使用、小さく分割
- **状態管理 (Riverpod)**: Provider機能分割、Notifier内で状態変更完結、UI/ロジック分離
- **パフォーマンス**: `ListView.builder`で遅延読み込み、MediaPipeは30fps維持（フレームスキップ考慮）

### Firebase Functions セキュリティパターン

```typescript
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
  if (context.auth.uid !== data.userId) throw new functions.https.HttpsError("permission-denied", "権限がありません");
  // ... validation and processing
});
```

### ログ出力

```typescript
logger.info("Session created", { userId, sessionId, exerciseType, duration: performance.now() - startTime });
```

### Firebase Security Rules

参考: https://firebase.google.com/docs/rules

**基本原則**:
- デフォルトは全拒否（明示的に許可したもののみアクセス可能）
- 認証済みユーザーのみアクセス許可
- フィールドレベルでのアクセス制御（`tosAccepted`, `ppAccepted`, `deletionScheduled` は読み取り専用）
- `request.auth.uid` で本人確認を徹底

**重要なパターン**:

```javascript
// ヘルパー関数
function isOwner(userId) { return request.auth != null && request.auth.uid == userId; }

// フィールド変更の検証
allow update: if isOwner(userId)
  && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['tosAccepted', 'ppAccepted', 'deletionScheduled']);

// 削除予定ユーザーの書き込み禁止
allow write: if isOwner(userId) && !resource.data.deletionScheduled;

// カスタムクレーム
function isAdmin() { return request.auth.token.admin == true; }
```

**テスト**: `firebase emulators:start --only firestore` + `@firebase/rules-unit-testing`

### Cloud IAM (Identity and Access Management)

参考: https://docs.cloud.google.com/iam/docs/overview

**基本原則**: 最小権限、サービスアカウントごとに役割分離、定期的な権限監査

**サービスアカウント構成**:
| サービスアカウント | 権限 |
|-------------------|------|
| Cloud Functions SA | Firestore読み書き, BigQuery編集, Cloud Tasks, Logging |
| BigQuery処理 SA | BigQueryジョブ, データ閲覧（特定データセット） |
| デプロイ SA (CI/CD) | Functions/Firestoreルールデプロイヤー |

**環境分離**: `firebase use dev` / `firebase use production` で切り替え

## フェーズ計画

`09_開発タスク詳細_スケジュール_v3_3.md` より：

### Phase 1 (0-2ヶ月): インフラ構築
- Firebase セットアップ、認証
- 基本的な Firestore コレクション
- セキュリティルール実装

### Phase 2 (2-7ヶ月): 機能実装
- 5種目のフォーム評価
- MediaPipe 統合
- 決済機能（RevenueCat）
- BigQuery 分析パイプライン

### Phase 3+ (将来): MVP外
- カスタムMLモデル（MediaPipe置き換え）
- ソーシャル機能
- 多言語対応

**実装前に必ず機能のフェーズを確認してください。**

## 重要な注意事項

- **推測禁止**: ドキュメントにない実装は必ず「推測」と明記
- **仕様書優先**: コード実装より仕様書の内容を優先（上記「仕様書の参照順序」参照）
- **フェーズ厳守**: Phase 3の機能をPhase 1-2で実装しない
- **法令遵守**: 薬機法（医療用語禁止）・GDPR・個人情報保護法を必ず確認

---

## サブエージェントプロトコル

### 利用可能なサブエージェント

| エージェント | 役割 | 使用場面 |
|-------------|------|----------|
| `flutter-expert` | Flutter開発専門家 | Flutter/Dart実装、ウィジェット設計、状態管理 |
| `typescript-pro` | TypeScript/JavaScript開発専門家 | Cloud Functions、API実装、型定義 |
| `qa-expert` | テスト自動化スペシャリスト | 単体テスト、統合テスト、品質保証 |
| `cloud-architect` | クラウドアーキテクト | Firebase/GCP設計、インフラ構築、監視設定 |
| `git-workflow-manager` | Gitワークフロー専門家 | ブランチ戦略、コミット管理、PR作成 |
| `devops-engineer` | CI/CD自動化エンジニア | デプロイパイプライン、自動化設定 |
| `mcp-developer` | MCPスペシャリスト | MCP サーバー開発、ツール統合 |
| `error-detective` | エラー分析・解決エキスパート | デバッグ、エラー調査、根本原因分析 |
| `business-analyst` | ビジネスアナリスト | 要件定義、プロセス改善、ROI分析、ステークホルダー管理 |
| `search-specialist` | 高度な情報検索専門家 | 複雑なコード検索、ドキュメント調査、パターン発見 |
| `security-auditor` | セキュリティ監査専門家 | 脆弱性スキャン、セキュリティレビュー、OWASP対応 |
| `competitive-analyst` | 競合分析専門家 | 市場調査、競合比較、戦略分析 |
| `documentation-engineer` | 技術ドキュメント専門家 | API文書、README作成、仕様書整備 |
| `refactoring-specialist` | リファクタリング専門家 | コード品質改善、設計パターン適用、技術的負債解消 |
| `compliance-auditor` | コンプライアンス監査専門家 | GDPR準拠、法令遵守、規制対応、監査証跡 |

### 全サブエージェント共通ルール

1. **タスク開始時**: 必ず関連する仕様書とCLAUDE.mdを確認すること
2. **仕様との整合性**: 実装中は常に仕様との整合性を検証すること
3. **完了報告**: サマリーのみ報告（詳細な仕様内容は含めない）
4. **不明点対応**: 仕様書を再確認してからメインに質問すること

### 実装系エージェントプロトコル

#### タスク実行フロー
1. **仕様確認**: `docs/specs` 配下の関連仕様書を確認
2. **関連セクション読込**: 該当する仕様セクションのみ読む
3. **実装**: 仕様要件を厳密に守って実装
4. **自己検証**: 実装が仕様と一致しているか確認
5. **サマリー報告**: 以下の形式でメインに報告

#### 報告フォーマット
```
✅ 実装完了: [機能名]
📋 参照仕様: [ファイル名:セクション]
🔧 実装内容:
  - [主要な実装ポイント1]
  - [主要な実装ポイント2]
📁 変更ファイル: [ファイルリスト]
⚠️ 注意点: [あれば]
```

#### 実装原則
- 仕様書の要件を厳密に守る
- エラーハンドリングを適切に実装
- 仕様に明記されていない拡張は提案のみ（勝手に実装しない）

### テスト系エージェントプロトコル

#### タスク実行フロー
1. **要件仕様確認**: 実装すべき機能の要件を読む
2. **テストケース抽出**: 仕様からテストケースを導出
3. **テスト実装**: 仕様の各要件をカバーするテストを作成
4. **カバレッジ報告**: どの仕様要件をテストしたか明記

#### 報告フォーマット
```
✅ テスト作成完了
📋 参照仕様: [ファイル名:セクション]
🧪 テストケース:
  - [仕様要件1] → [テスト名]
  - [仕様要件2] → [テスト名]
📊 カバレッジ: [X/Y 要件をカバー]
```

#### テスト原則
- 仕様の全要件をテストでカバー
- エッジケースも仕様から導出
- 仕様にない動作はテストしない（実装に引きずられない）

### セキュリティ系エージェントプロトコル

#### タスク実行フロー
1. **セキュリティ要件確認**: `docs/specs/07_セキュリティポリシー_v1_0.md` を確認
2. **実装検証**: セキュリティ要件との整合性をチェック
3. **脆弱性スキャン**: 仕様で禁止されている実装パターンを検出
4. **報告**: 仕様違反と推奨対策を報告

#### 報告フォーマット
```
🔒 セキュリティレビュー完了
📋 参照仕様: [セキュリティ要件セクション]
⚠️ 検出事項:
  - [仕様要件違反] → [推奨対策]
✅ 準拠確認: [満たしている要件リスト]
```

### ドキュメント系エージェントプロトコル

#### タスク実行フロー
1. **仕様確認**: 実装の元となった仕様を確認
2. **整合性検証**: 実装とドキュメントが仕様と一致しているか確認
3. **ドキュメント作成**: 仕様を基にしたドキュメントを生成
4. **クロスリファレンス**: 仕様書へのリンクを含める

#### 報告フォーマット
```
📝 ドキュメント作成完了
📋 参照仕様: [ファイル名:セクション]
📄 作成内容: [ドキュメント概要]
🔗 仕様リンク: [含めた参照リンク]
```

### タスク委譲ルール

1. **サブエージェントが存在する場合**: 該当するサブエージェントにタスクを委譲
2. **サブエージェントが存在しない場合**: 実行前にユーザーに確認を取る
3. **複数エージェントが必要な場合**: 適切な順序で委譲（例: 実装 → テスト → レビュー）
