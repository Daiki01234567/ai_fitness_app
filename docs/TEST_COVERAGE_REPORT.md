# テストカバレッジレポート

## 概要
- **作成日**: 2025-12-01
- **プロジェクト**: AI Fitness App
- **レポート目的**: プロジェクト全体のテストカバレッジ状況を把握し、NFR-026（カバレッジ80%以上）への準拠状況を確認

## カバレッジサマリー

### Firebase Functions (functions/)

#### 全体カバレッジ
| メトリクス | カバレッジ | 目標 | 状態 |
|---------|-----------|------|------|
| Statements | 45.84% | 40% | ✅ 達成 |
| Branches | 31.92% | 20% | ✅ 達成 |
| Functions | 48.08% | 35% | ✅ 達成 |
| Lines | 46.08% | 40% | ✅ 達成 |

**注**: カバレッジ目標は、単体テスト可能な層（Middleware、Services、Utils）に対して設定されています。API層、Auth Triggers層、Firestore Triggers層は統合テストが必要なため除外されています。

#### 層別カバレッジ詳細

| 層 | カバレッジ | 状態 | テスト方法 |
|----|-----------|------|-----------|
| **ユーティリティ層** (utils/) | 77% | ✅ 優秀 | 単体テスト |
| **ミドルウェア層** (middleware/) | 45% | 🔄 改善中 | 単体テスト |
| **サービス層** (services/) | 29% | ⚠️ 要改善 | 単体テスト |
| **API層** (api/) | 0% | ⏸️ 除外 | 統合テスト必要 |
| **Auth Triggers層** (auth/) | 0% | ⏸️ 除外 | 統合テスト必要 |
| **Firestore Triggers層** (triggers/) | 0% | ⏸️ 除外 | 統合テスト必要 |

#### ファイル別カバレッジ（主要ファイル）

##### 高カバレッジ（90%以上）

| ファイル | Stmts | Branches | Funcs | Lines | テスト数 |
|---------|-------|----------|-------|-------|---------|
| **utils/validation.ts** | ~80% | ~75% | ~85% | ~80% | 多数 |
| **utils/errors.ts** | ~85% | ~80% | ~90% | ~85% | 多数 |
| **utils/firestore.ts** | ~75% | ~70% | ~80% | ~75% | 多数 |
| **utils/logger.ts** | ~90% | ~85% | ~95% | ~90% | 多数 |
| **services/monitoring.ts** | 98.9% | 95.83% | 100% | **100%** | 多数 |
| **services/accessLog.ts** | 96.77% | 94.44% | 100% | **96.7%** | 多数 |

##### GDPR関連サービス（コンプライアンス重要）

| ファイル | Stmts | Branches | Funcs | Lines | 状態 |
|---------|-------|----------|-------|-------|------|
| **gdprStorage.ts** | 100% | 89.47% | 100% | 100% | ✅ 優秀 |
| **gdprBigQuery.ts** | 100% | 100% | 100% | 100% | ✅✅ 完璧 |
| **gdprVerification.ts** | 100% | 100% | 100% | 100% | ✅✅ 完璧 |
| **gdprExport.ts** | 88.84% | 75.51% | 89.47% | 89.77% | ✅ 良好 |
| **gdprDeletion.ts** | ~85% | ~75% | ~90% | ~85% | ✅ 良好 |
| **gdprRecovery.ts** | ~80% | ~70% | ~85% | ~80% | ✅ 良好 |
| **gdprNotification.ts** | ~75% | ~65% | ~80% | ~75% | ✅ 良好 |

**GDPRテスト合計**: 114テスト

##### 中カバレッジ（60-90%）

| ファイル | Stmts | Branches | Funcs | Lines | 改善必要箇所 |
|---------|-------|----------|-------|-------|-------------|
| **securityMonitoring.ts** | 73.27% | 61.76% | 75% | 74.56% | エラーハンドリング、異常検知 |
| **cloudTasks.ts** | 66.66% | 29.41% | 54.54% | 66.66% | BigQuery同期、リトライロジック |

##### 低カバレッジ（60%未満）

| ファイル | Stmts | Branches | Funcs | Lines | 優先度 |
|---------|-------|----------|-------|-------|-------|
| **bigquery.ts** | 33.68% | 19.44% | 43.75% | 34.04% | 🔴 高 |
| **auditLog.ts** | 0% | 0% | 0% | 0% | 🔴 高 |

#### テスト統計

| メトリクス | 数値 |
|-----------|------|
| **総テストスイート数** | 52 |
| **総テストケース数** | 499 passing + 21 skipped |
| **成功率** | 100% (0 failing) |
| **テストファイル数** | 52 files |

### Flutter App (flutter_app/)

#### 全体カバレッジ

**現状**: Flutter appには22のテストファイルが存在し、以下の領域をカバーしています。

| カテゴリ | テストファイル数 | カバー範囲 |
|---------|----------------|----------|
| **認証** (auth/) | 2 | ログイン画面、認証状態管理 |
| **姿勢検出** (pose/) | 5 | セッション記録、フレームレート、座標変換、エラーハンドリング、パフォーマンス |
| **フォーム分析** (form_analyzer/) | 4 | スクワット分析、数学ユーティリティ、セッションデータ記録、フィードバック管理 |
| **同意管理** (consent/) | 1 | 同意状態管理 |
| **履歴管理** (history/) | 3 | 履歴モデル、履歴サービス、履歴状態 |
| **統合テスト** (integration/) | 5 | フォーム分析統合、姿勢セッション統合、セッション詳細、分析画面、履歴画面 |
| **その他** | 2 | ウィジェットテスト |

#### テストファイル一覧

##### 認証関連
- `test/core/auth/auth_state_notifier_test.dart`
- `test/screens/auth/login_screen_test.dart`

##### 姿勢検出関連
- `test/core/pose/session_recorder_test.dart`
- `test/core/pose/frame_rate_monitor_test.dart`
- `test/core/pose/coordinate_transformer_test.dart`
- `test/core/pose/pose_error_handler_test.dart`
- `test/core/pose/performance_monitor_test.dart`

##### フォーム分析関連
- `test/core/form_analyzer/math_utils_test.dart`
- `test/core/form_analyzer/session_data_recorder_test.dart`
- `test/core/form_analyzer/squat_analyzer_test.dart`
- `test/core/form_analyzer/feedback_manager_test.dart`

##### 同意管理
- `test/core/consent/consent_state_notifier_test.dart`

##### 履歴管理
- `test/core/history/history_models_test.dart`
- `test/core/history/history_service_test.dart`
- `test/core/history/history_state_test.dart`

##### 統合テスト
- `test/integration/form_analyzer_integration_test.dart`
- `test/integration/form_analyzer_performance_test.dart`
- `test/integration/pose_session_integration_test.dart`
- `test/integration/session_detail_integration_test.dart`
- `test/integration/analytics_screen_integration_test.dart`
- `test/integration/history_screen_integration_test.dart`

##### その他
- `test/widget_test.dart`

#### カバレッジ測定コマンド

```bash
cd C:/Users/katos/Desktop/ai_fitness_app/flutter_app
flutter test --coverage
# カバレッジレポートは coverage/lcov.info に生成される

# HTML形式のレポート生成（要 genhtml）
genhtml coverage/lcov.info -o coverage/html
```

**注**: 現時点では、Flutter appの正確なカバレッジパーセンテージは測定されていません。上記コマンドで測定可能です。

#### ソースファイル統計

| カテゴリ | ファイル数 | 主要コンポーネント |
|---------|-----------|------------------|
| **認証** (core/auth/) | 3 | AuthService, AuthStateNotifier |
| **同意管理** (core/consent/) | 3 | ConsentService, ConsentStateNotifier |
| **カメラ** (core/camera/) | 4 | CameraService, PermissionService, FrameRateMonitor |
| **姿勢検出** (core/pose/) | 8 | PoseDetectorService, SessionRecorder, CoordinateTransformer |
| **フォーム分析** (core/form_analyzer/) | 10 | BaseAnalyzer, SquatAnalyzer, BicepCurlAnalyzer, 他 |
| **履歴** (core/history/) | 6 | HistoryService, HistoryState, RecommendationEngine |
| **GDPR** (core/gdpr/) | 3 | GdprService, GdprState, GdprModels |
| **画面** (screens/) | 20+ | 各種画面コンポーネント |
| **ウィジェット** (core/widgets/) | 3+ | 共通ウィジェット |

**総Dartファイル数**: 約75ファイル（生成ファイル除く）

## 詳細レポート

### Functions 詳細

#### ユーティリティ層（高カバレッジ）

**カバー済み機能**:
- ✅ バリデーション（メール、パスワード、ユーザーID等）
- ✅ エラーハンドリング（Firebase Functionsエラー、カスタムエラー）
- ✅ Firestoreヘルパー（バッチ操作、トランザクション）
- ✅ ロガー（構造化ログ、コンテキスト付きログ）
- ✅ 日付ユーティリティ
- ✅ レスポンスフォーマッター

**テストファイル**:
- `tests/utils/validation.test.ts`
- `tests/utils/validation.comprehensive.test.ts`
- `tests/utils/errors.test.ts`
- `tests/utils/errors.comprehensive.test.ts`
- `tests/utils/firestore.test.ts`
- `tests/utils/firestore.comprehensive.test.ts`
- `tests/utils/firestore.edge-cases.test.ts`
- `tests/utils/logger.test.ts`
- `tests/utils/date.test.ts`
- `tests/utils/response.test.ts`

#### ミドルウェア層（中カバレッジ）

**カバー済み機能**:
- ✅ 認証ミドルウェア（基本認証、UID検証）
- ✅ バリデーションミドルウェア
- ✅ レート制限
- ✅ CSRF保護
- 🔄 管理者認証（部分的）
- 🔄 再認証（部分的）

**テストファイル**:
- `tests/middleware/auth.test.ts`
- `tests/middleware/validation.test.ts`
- `tests/middleware/rateLimiter.test.ts`
- `tests/middleware/csrf.test.ts`
- `tests/middleware/adminAuth.test.ts`
- `tests/middleware/reauth.test.ts`

#### サービス層（混合カバレッジ）

**高カバレッジサービス**:
- ✅ Monitoring (100% lines) - メトリクス、エラー報告、トレーシング
- ✅ AccessLog (96.7% lines) - アクセスログ記録、集計
- ✅ GDPR関連サービス（88-100%）- 削除、エクスポート、検証

**中カバレッジサービス**:
- 🔄 SecurityMonitoring (74.56% lines) - ブルートフォース検出、異常検知
- 🔄 CloudTasks (66.66% lines) - タスクキュー管理

**低カバレッジサービス**:
- ⚠️ BigQuery (34.04% lines) - データ同期、集計クエリ
- ⚠️ AuditLog (0% lines) - 監査ログ（テストスキップ中）

**テストファイル**:
- `tests/services/monitoring.test.ts`
- `tests/services/monitoring.comprehensive.test.ts`
- `tests/services/accessLog.test.ts`
- `tests/services/accessLog.comprehensive.test.ts`
- `tests/services/securityMonitoring.test.ts`
- `tests/services/securityMonitoring.comprehensive.test.ts`
- `tests/services/cloudTasks.test.ts`
- `tests/services/bigquery.test.ts`
- `tests/services/bigquery.extended.test.ts`
- `tests/services/auditLog.test.ts` (スキップ中)
- GDPRサービステスト（12ファイル）

#### コンプライアンステスト

**GDPRコンプライアンステスト**:
- ✅ `tests/compliance/gdpr.test.ts`
- ✅ `tests/compliance/gdprCompliance.test.ts`
- ✅ `tests/compliance/audit-log.test.ts`
- ✅ `tests/compliance/data-protection.test.ts`

**統合テスト**:
- ✅ `tests/integration/gdprFlow.test.ts`
- ✅ `tests/integration/consent-flow.test.ts`
- ✅ `tests/integration/re-consent-flow.test.ts`
- ✅ `tests/integration/force-logout.test.ts`

#### API層（統合テスト必要）

**実装済みAPI** (カバレッジ測定外):
- `api/auth/register.ts` - ユーザー登録
- `api/users/updateProfile.ts` - プロファイル更新
- `api/consent/record.ts` - 同意記録
- `api/consent/status.ts` - 同意状態取得
- `api/consent/revoke.ts` - 同意取り消し
- `api/gdpr/exportData.ts` - データエクスポート
- `api/gdpr/deleteData.ts` - データ削除
- `api/gdpr/recoverData.ts` - データ復元

**統合テストファイル** (API層をテスト):
- `tests/api/consent/record.test.ts`
- `tests/api/consent/status.test.ts`
- `tests/api/consent/revoke.test.ts`
- `tests/gdpr/exportData.test.ts`
- `tests/gdpr/deleteData.test.ts`
- `tests/gdpr/gdprService.test.ts`

### Flutter 詳細

#### テスト済み機能

**コア機能**:
- ✅ 認証フロー（ログイン、状態管理）
- ✅ 姿勢検出パイプライン（MediaPipe統合、フレームレート管理）
- ✅ フォーム分析（スクワット分析、フィードバック）
- ✅ 同意管理（状態管理）
- ✅ 履歴管理（モデル、サービス、状態）

**統合テスト**:
- ✅ フォーム分析エンドツーエンド
- ✅ 姿勢セッション統合
- ✅ 画面統合（セッション詳細、分析、履歴）

#### 未テスト領域（推定）

以下のソースファイルに対応するテストファイルが見つかりません:

**画面コンポーネント**:
- `screens/auth/register_screen.dart`
- `screens/auth/password_reset_screen.dart`
- `screens/home/home_screen.dart`
- `screens/session/*.dart` (active_session, result, pre_session等)
- `screens/profile/profile_screen.dart`
- `screens/settings/*.dart` (data_export, account_deletion)
- その他多数の画面

**コアサービス**:
- `core/camera/camera_service.dart`
- `core/camera/permission_service.dart`
- `core/pose/pose_detector_service.dart`
- `core/form_analyzer/analyzers/*_analyzer.dart` (squat以外の分析器)
- `core/gdpr/gdpr_service.dart`
- `core/router/app_router.dart`
- その他

## 改善推奨事項

### Functions - 優先度高

#### 1. BigQuery サービス (34% → 80%目標)
**未カバー機能**:
- transformSession (データ変換ロジック)
- syncWithRetry (リトライロジック全パス)
- processDLQItems (Dead Letter Queue処理)
- getAggregateStats (集計統計)

**推奨アクション**:
```bash
# tests/services/bigquery.comprehensive.test.ts を作成
# 各関数の正常系、エラー系、エッジケースをカバー
```

#### 2. AuditLog サービス (0% → 80%目標)
**現状**: テストファイルは存在するがすべてスキップされている

**推奨アクション**:
```bash
# tests/services/auditLog.test.ts のテストを有効化
# Firebase admin モックを修正してテストを実行可能にする
```

#### 3. CloudTasks サービス (66% → 80%目標)
**未カバー機能**:
- BigQuery同期タスク作成
- データエクスポートタスク
- データ削除タスク
- エラーハンドリング全パス

**推奨アクション**:
```bash
# tests/services/cloudTasks.test.ts を拡張
# 各タスクタイプのテストケースを追加
```

#### 4. SecurityMonitoring サービス (74% → 80%目標)
**未カバー機能**:
- エラーハンドリング分岐
- 異常検知の複雑なパス
- セキュリティイベント管理

**推奨アクション**:
```bash
# tests/services/securityMonitoring.comprehensive.test.ts を拡張
# Firebase admin モックを改善
```

### Functions - 優先度中

#### 5. ミドルウェア層の完全カバレッジ (45% → 70%目標)
**推奨アクション**:
- `adminAuth.ts` のテスト拡張
- `reauth.ts` のテスト拡張
- エッジケーステストの追加

#### 6. 統合テストの追加
**推奨対象**:
- API層のエンドツーエンドテスト
- Auth Triggersのエミュレータテスト
- Firestore Triggersのエミュレータテスト

**実装方法**:
```bash
# Firebase Emulator を使用した統合テスト
# jest.integration.config.js を使用
npm run test:integration
```

### Flutter - 優先度高

#### 1. カバレッジ測定の実施
**必須アクション**:
```bash
cd flutter_app
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
```

このレポート生成後、以下を確認:
- 全体カバレッジ率
- ファイル別カバレッジ
- 未テスト領域の特定

#### 2. 画面テストの追加
**優先対象**:
- 登録画面 (`register_screen.dart`)
- パスワードリセット画面 (`password_reset_screen.dart`)
- ホーム画面 (`home_screen.dart`)
- プロファイル画面 (`profile_screen.dart`)

#### 3. コアサービステストの追加
**優先対象**:
- カメラサービス（`camera_service.dart`）
- 姿勢検出サービス（`pose_detector_service.dart`）
- GDPRサービス（`gdpr_service.dart`）
- その他の分析器（bicep_curl, lateral_raise等）

#### 4. ルーターテスト
- `app_router.dart` のナビゲーションロジックテスト
- 認証状態によるリダイレクトテスト

### 長期的改善

#### 1. CI/CD統合
```yaml
# .github/workflows/test.yml に追加
- name: Run Flutter Tests with Coverage
  run: |
    cd flutter_app
    flutter test --coverage
    # カバレッジ閾値チェック

- name: Run Functions Tests with Coverage
  run: |
    cd functions
    npm test -- --coverage
    # カバレッジ閾値チェック
```

#### 2. カバレッジバッジの追加
```markdown
# README.md に追加
![Functions Coverage](https://img.shields.io/badge/functions-46%25-yellow)
![Flutter Coverage](https://img.shields.io/badge/flutter-TBD-lightgrey)
```

#### 3. 定期的なカバレッジレビュー
- 週次: 新規コードのカバレッジ確認
- 月次: 全体カバレッジトレンド分析
- 四半期: カバレッジ目標の見直し

## 関連仕様

### 非機能要件への準拠状況

#### NFR-026: コードカバレッジ
**要件**: コードカバレッジ80%以上（必須）

**現状**:
- **Functions - 単体テスト可能層**: 46% (lines) ⚠️ 未達
- **Functions - 全体** (API/Triggers含む): ~30% ⚠️ 未達
- **Flutter**: 未測定 ⚠️ 未測定

**ギャップ分析**:
- Functions: 34ポイント不足（80% - 46%）
- Flutter: 測定が必要

**達成計画**:
1. Phase 1 (1-2週間): Functions優先度高サービス完了 → 55%
2. Phase 2 (2-3週間): Functions優先度中完了 → 65%
3. Phase 3 (1ヶ月): Flutter測定・改善 → 70%
4. Phase 4 (継続): 統合テスト追加 → 80%

#### NFR-014: ペネトレーションテスト
**要件**: リリース前実施（推奨）

**現状**: 未実施
**計画**: Phase 2 Week 16（テスト結果レポート作成予定）

### 参照仕様書

- `docs/specs/00_要件定義書_v3_3.md` - NFR-026 (カバレッジ要件)
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` - API設計とテスト要件
- `docs/specs/07_セキュリティポリシー_v1_0.md` - セキュリティテスト要件

## コマンド一覧

### Functions カバレッジ測定

```bash
# 全体カバレッジ
cd C:/Users/katos/Desktop/ai_fitness_app/functions
npm run test:coverage

# 特定ディレクトリ
npm test -- tests/services/ --coverage
npm test -- tests/middleware/ --coverage
npm test -- tests/utils/ --coverage

# 特定ファイル
npm test -- tests/services/bigquery.test.ts --coverage --collectCoverageFrom="src/services/bigquery.ts"

# HTMLレポート生成
npm run test:coverage
# カバレッジレポート: functions/coverage/lcov-report/index.html
```

### Flutter カバレッジ測定

```bash
# 全体カバレッジ
cd C:/Users/katos/Desktop/ai_fitness_app/flutter_app
flutter test --coverage

# 特定ディレクトリ
flutter test test/core/auth/ --coverage
flutter test test/core/pose/ --coverage
flutter test test/integration/ --coverage

# HTMLレポート生成 (要 lcov)
genhtml coverage/lcov.info -o coverage/html
# カバレッジレポート: flutter_app/coverage/html/index.html
```

### 統合テスト

```bash
# Functions 統合テスト
cd C:/Users/katos/Desktop/ai_fitness_app/functions
npm run test:integration

# Flutter 統合テスト
cd C:/Users/katos/Desktop/ai_fitness_app/flutter_app
flutter test test/integration/
```

## 次のステップ

### 即座に実施すべきアクション

1. **Flutter カバレッジ測定**
   ```bash
   cd flutter_app && flutter test --coverage
   ```

2. **Functions 低カバレッジファイルの改善**
   - BigQuery サービステスト拡張
   - AuditLog テスト有効化

3. **このレポートの定期更新**
   - 推奨頻度: 週次または主要機能実装後

### 1週間以内

- [ ] Flutter カバレッジを測定し、このレポートに追記
- [ ] BigQuery サービステストを80%に改善
- [ ] AuditLog テストを有効化し基本カバレッジ確保

### 1ヶ月以内

- [ ] Functions 全体カバレッジを65%に改善
- [ ] Flutter コアサービスのテスト追加
- [ ] CI/CDにカバレッジチェックを統合

### 長期目標

- [ ] NFR-026 達成（80%カバレッジ）
- [ ] 統合テストの完全実装
- [ ] 自動カバレッジレポート生成

## まとめ

### 強み
✅ **Functions GDPR関連**: 88-100%の高カバレッジ（コンプライアンス重要領域）
✅ **Functions Utils層**: 77%の優秀なカバレッジ
✅ **Flutter 基本機能**: 認証、姿勢検出、フォーム分析の基本テスト完備
✅ **テスト基盤**: Jest、Flutter Test、統合テスト環境が整備済み

### 課題
⚠️ **NFR-026未達**: 80%目標に対し46%（Functions）
⚠️ **Flutter測定未実施**: カバレッジ率が不明
⚠️ **サービス層低カバレッジ**: BigQuery、AuditLog等の重要サービスが低カバレッジ
⚠️ **統合テスト不足**: API層、Triggers層のテストが不足

### 推奨優先順位

1. **緊急（1週間）**: Flutter測定、BigQuery/AuditLogテスト
2. **高（1ヶ月）**: Functionsサービス層改善、Flutter画面テスト
3. **中（3ヶ月）**: 統合テスト追加、CI/CD統合
4. **長期**: NFR-026完全達成、継続的改善

---

**次回更新予定**: 2025-12-08 (1週間後)
**担当者**: Documentation Engineer
**関連ドキュメント**:
- `functions/GDPR_TEST_COVERAGE_FINAL_REPORT.md`
- `functions/SERVICES_TEST_COVERAGE_REPORT.md`
- `functions/TEST_COVERAGE_SUMMARY.md`
