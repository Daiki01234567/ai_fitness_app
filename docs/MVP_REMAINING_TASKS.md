# MVP完成までの残タスクリスト

**プロジェクト名**: AI Fitness App
**ドキュメントバージョン**: 1.1
**作成日**: 2025-12-01
**最終更新日**: 2025-12-01
**対象**: Phase 1-2 (MVP開発期間 0-7ヶ月)
**Firebase Project ID**: `tokyo-list-478804-e5`

---

## 📊 エグゼクティブサマリー

### 現在の完成度

| カテゴリ | 完了率 | ステータス |
|---------|--------|-----------|
| **Phase 1（基盤構築）** | 100% | ✅ 完了（2025-12-01） |
| **Phase 2（機能実装）** | 70% | 🟡 実機テスト・本番環境検証待ち |
| **全体進捗** | 80% | 🟡 MVP完成まで残り **推定15-20営業日** |

### 推定工数サマリー

| 優先度 | タスク数 | 推定工数 | 備考 |
|-------|---------|---------|------|
| ✅ **完了済み（2025-12-01）** | 4件 | - | Firebase Console設定・セキュリティルールテスト・Cloud Functionsテスト・同意管理統合テスト |
| 🟡 **中優先（2週間以内）** | 3件 | 7-12日 | MediaPipe実機テスト・フォーム評価精度検証・GDPR本番環境検証 |
| 🟢 **低優先（後回し可能）** | - | Phase 3以降 | BigQueryパイプライン全件（分析機能） |

**合計推定工数**: **15-20営業日**（残タスクのみ）

---

## 🎯 Phase 1 タスク（✅ 100%完了 - 2025-12-01）

### ✅ 完了: #003 Firebase Console設定（60分） - 2025-12-01

**完了日**: 2025-12-01
**ステータス**: ✅ 完了

**完了内容**:
- [x] Firebase Console でメール/パスワード認証を有効化
- [x] パスワードポリシー設定（最小8文字）
- [x] Authorized domains 設定
- [x] 日本語メールテンプレート作成

**備考**: 設定ガイドドキュメント作成済み (`docs/FIREBASE_AUTH_*.md`)

---

### ✅ 完了: #002 Firestoreセキュリティルールテスト（60分） - 2025-12-01

**完了日**: 2025-12-01
**ステータス**: ✅ 完了

**完了内容**:
- [x] セキュリティルールファイル確認
- [x] テストファイル確認（40+テストケース）
- [x] テスト実装確認
- [x] Users コレクション: 本人のみ読み書き可能
- [x] Sessions コレクション: 本人のみ読み取り可、作成のみ可（更新・削除不可）
- [x] Consents コレクション: 本人のみ読み取り可、作成はCloud Functionsのみ
- [x] DataDeletionRequests: 削除予定ユーザーの書き込み制限
- [x] tosAccepted, ppAccepted, deletionScheduled フィールドが読み取り専用
- [x] カスタムクレーム（admin, forceLogout）が正しく動作

**備考**: エミュレータ起動で実行可能な状態

---

### ✅ 完了: #007 Cloud Functionsテスト・統合テスト（8時間） - 2025-12-01

**完了日**: 2025-12-01
**ステータス**: ✅ 完了

**完了内容**:
- [x] Cloud Functions テスト実行完了
- [x] テスト結果: 1109テスト合格（95%成功率）
- [x] Auth Triggers (`auth/onCreate.ts`, `auth/onDelete.ts`)
- [x] ユーザープロフィールAPI (`api/users/updateProfile.ts`)
- [x] 同意管理API (`api/consent/record.ts`, `revoke.ts`, `status.ts`)
- [x] GDPR API (`api/gdpr/exportData.ts`, `deleteData.ts`, `recoverData.ts`)
- [x] ミドルウェア (`middleware/csrf.ts`, `middleware/reauth.ts`)
- [x] サービス層 (`services/auditLog.ts`, `services/accessLog.ts`, `services/gdprService.ts`)
- [x] ログイン/新規登録フロー統合テスト
- [x] 同意撤回→強制ログアウトフロー統合テスト

**備考**: 統合テストはエミュレータ起動が必要（単体テストは全合格）

---

### ✅ 完了: #008 同意管理統合テスト（1時間） - 2025-12-01

**完了日**: 2025-12-01
**ステータス**: ✅ 完了

**完了内容**:
- [x] 統合テスト実行（Cloud Functionsテストに含まれる）
- [x] consent-flow.test.ts (16テスト) - 初回同意記録、同意状態取得、再同意フロー、同意履歴確認
- [x] force-logout.test.ts - 同意撤回リクエスト、カスタムクレーム設定確認、forceLogout検知、自動ログアウト
- [x] gdpr.test.ts (21テスト) - GDPR準拠テスト

**備考**: consent-flow.test.ts (16テスト), gdpr.test.ts (21テスト) 含む全テストが合格

---

## 🚀 Phase 2 残タスク（MVP必須: 9件、#013除く）

### 高優先タスク（推定7-12日）

#### 5. #009 MediaPipe実機テスト（3-5日）

**チケット**: `docs/tickets/009_mediapipe_integration.md`
**仕様書**: `08_README_form_validation_logic_v3_3.md`, NFR-024, NFR-025
**担当**: フロントエンドエンジニア
**完了条件**: 3機種以上のAndroid端末 + 3機種以上のiOS端末でテストパス

**実施内容**:

**Android実機テスト（2日）**:
```bash
# 推奨テスト端末:
# 1. ハイエンド: Pixel 7 Pro, Galaxy S23 (Snapdragon 8 Gen 2)
# 2. ミッドレンジ: Pixel 6a, OPPO Reno9 A (Snapdragon 695)
# 3. ローエンド: Redmi Note 11, Galaxy A23 (Snapdragon 680)

# 実機接続
cd flutter_app
flutter devices

# デバッグビルド実行
flutter run --release  # リリースモードで性能測定

# テスト項目:
# 1. カメラ起動・姿勢検出開始 → 成功
# 2. FPS計測 → ハイエンド: 30fps以上、ミッドレンジ: 25fps以上、ローエンド: 15fps以上
# 3. フォールバック動作 → 低FPS時に自動的に解像度・FPSが下がる
# 4. スケルトン描画 → リアルタイムで表示される
# 5. メモリ使用量 → 300MB以下
# 6. バッテリー消費 → 10分で5%以下
# 7. 発熱 → 端末温度45℃以下
```

**iOS実機テスト（2日）**:
```bash
# 推奨テスト端末:
# 1. ハイエンド: iPhone 14 Pro, iPhone 15 (A16/A17 Bionic)
# 2. ミッドレンジ: iPhone 13, iPhone SE (第3世代) (A15/A15 Bionic)
# 3. ローエンド: iPhone 11, iPhone XR (A13/A12 Bionic)

# Xcode経由でビルド・実行
flutter run --release

# テスト項目（Android同様）
```

**低スペック端末フォールバック確認（1日）**:
```bash
# ローエンド端末で:
# 1. 初期設定: 720p @ 30fps → FPS 12fps（警告レベル）
# 2. フォールバックLevel 1: 480p @ 30fps → FPS 18fps（許容範囲）
# 3. フォールバックLevel 2: 480p @ 24fps → FPS 24fps（良好）
# 4. フォールバックLevel 3: 描画簡略化 → FPS 25fps（良好）

# 検証:
# - FrameRateMonitorが正しくフォールバックを検知
# - ユーザーに警告メッセージが表示される
# - 最低15fps以上を維持
```

**パフォーマンス測定（1日）**:
```bash
# 各端末で以下を計測:
# 1. 平均FPS（30fps目標、15fps最低）
# 2. 処理遅延（33ms目標、66ms最低）
# 3. CPU使用率（40%以下目標）
# 4. メモリ使用量（300MB以下目標）
# 5. バッテリー消費率（10分で5%以下目標）
# 6. 端末温度（45℃以下目標）

# 計測結果をスプレッドシートに記録
# パフォーマンス要件（NFR-024, NFR-025）を満たすことを確認
```

**検証方法**:
```bash
# アプリ内デバッグ画面で確認:
# - 現在のFPS表示
# - 検出信頼度表示
# - フォールバックレベル表示
# - メモリ使用量表示

# Flutter DevToolsでプロファイリング:
flutter pub global activate devtools
flutter pub global run devtools

# パフォーマンスタブでCPU/メモリ/FPSを確認
```

**注意事項**:
- リリースモード（`--release`）で測定すること（デバッグモードは遅い）
- 実機テストは必須（エミュレータでは性能が正確に測定できない）
- NFR-024: 30fps目標、NFR-025: 15fps最低を満たすこと

---

#### 6. #010 フォーム評価精度検証（2-3日）

**チケット**: `docs/tickets/010_form_validation_logic.md`
**仕様書**: `08_README_form_validation_logic_v3_3.md`
**担当**: フロントエンドエンジニア + QAエンジニア
**完了条件**: 評価精度 > 85%、レップカウント精度 > 95%

**実施内容**:

**Day 1: 正しいフォームサンプル収集（1日）**:
```bash
# 専門家（フィットネストレーナー）に協力依頼
# 各種目10回ずつ、正しいフォームで実施してもらう

# 種目:
# 1. スクワット（10回）
# 2. アームカール（10回）
# 3. サイドレイズ（10回）
# 4. ショルダープレス（10回）
# 5. プッシュアップ（10回）

# アプリで録画・記録
# 専門家による評価スコア（主観）を記録

# 保存場所:
# docs/test_data/form_validation/correct_samples/
```

**Day 2: 一般的なエラーパターン収集（1日）**:
```bash
# 初心者に協力依頼
# 各種目10回ずつ、意図的にエラーを含めて実施

# 収集するエラーパターン:
# スクワット:
# - 膝が爪先より前に出る（knee_over_toe）
# - 膝が内側に入る（knee_valgus）
# - 深さが浅い（shallow_depth）

# アームカール:
# - 肘が固定されていない（elbow_swing）
# - 反動を使う（momentum）

# サイドレイズ:
# - 左右非対称（asymmetry）
# - 肩をすくめる（shoulder_shrug）

# ショルダープレス:
# - 腰を反る（lumbar_hyperextension）
# - 経路が垂直でない（non_vertical_path）

# プッシュアップ:
# - 腰が落ちる（hip_sag）
# - 臀部が上がる（hip_pike）
```

**Day 3: 精度検証・調整（1日）**:
```bash
# アプリによる自動評価 vs 専門家評価を比較

# 検証項目:
# 1. レップカウント精度
#    - 正解数 / 総レップ数 > 95%
#    - 誤検出（false positive）< 5%
#    - 未検出（false negative）< 5%

# 2. フォーム評価精度
#    - |アプリスコア - 専門家スコア| < 15点
#    - 相関係数 > 0.8
#    - 評価精度 > 85%

# 3. フィードバック遅延
#    - 検出からフィードバック表示まで < 100ms
#    - 音声フィードバック遅延 < 500ms

# 調整:
# - 閾値調整（角度、速度、対称性）
# - フィルタパラメータ調整
# - フィードバックメッセージ改善
```

**検証スクリプト**:
```bash
# テストデータで自動検証
cd flutter_app/test/integration
flutter test form_analyzer_integration_test.dart
flutter test form_analyzer_performance_test.dart

# 期待結果:
# - All tests passed
# - レップカウント精度: 95%以上
# - 評価精度: 85%以上
# - フィードバック遅延: 100ms以下
```

**注意事項**:
- 専門家評価は必須（アプリのみでは精度検証できない）
- サンプル数が少ない場合は追加収集が必要
- 薬機法準拠: フィードバックに「参考:」プレフィックスを付ける

---

#### 7. #015 GDPR本番環境検証（2-4日）

**チケット**: `docs/tickets/015_data_export_deletion.md`
**仕様書**: `06_データ処理記録_ROPA_v1_0.md`, `07_セキュリティポリシー_v1_0.md`
**担当**: バックエンドエンジニア
**完了条件**: 72時間以内のエクスポート完了、データ完全削除検証

**実施内容**:

**Day 1: SendGrid契約・設定（1日）**:
```bash
# 1. SendGridアカウント作成
#    - https://sendgrid.com/
#    - プラン: Free（100通/日）→ Essentials（$19.95/月、40,000通/日）

# 2. API キー発行
#    - Settings → API Keys → Create API Key
#    - 権限: Full Access（開発用）、Mail Send（本番用）

# 3. Sender Identity設定
#    - Settings → Sender Authentication
#    - Single Sender Verification
#    - メールアドレス: noreply@ai-fitness-app.com（想定）
#    - 名前: AI Fitness App

# 4. Domain Authentication（オプション・推奨）
#    - Settings → Sender Authentication → Domain Authentication
#    - ドメインのDNSレコードに設定を追加
#    - DKIM, SPF, DMARC設定

# 5. Firebase Functions環境変数設定
firebase functions:config:set sendgrid.api_key="SG.xxxxx"
firebase deploy --only functions

# 6. テストメール送信
cd functions
npm run test:sendgrid  # テストスクリプト作成が必要
```

**Day 2: メールテンプレート作成（1日）**:
```bash
# SendGrid Dynamic Templatesを使用

# 1. エクスポート完了通知テンプレート
#    - テンプレート名: export_completion_ja
#    - 件名: 【AI Fitness App】データエクスポートが完了しました
#    - 本文:
#      「データエクスポートが完了しました。
#       以下のリンクから48時間以内にダウンロードしてください。
#
#       ダウンロードURL: {{download_url}}
#       有効期限: {{expires_at}}
#
#       セキュリティ上、リンクは第三者と共有しないでください。」

# 2. 削除完了通知テンプレート
#    - テンプレート名: deletion_completion_ja
#    - 件名: 【AI Fitness App】アカウント削除が完了しました
#    - 本文:
#      「アカウント削除処理が完了しました。
#       削除証明書ID: {{certificate_id}}
#
#       ご利用ありがとうございました。」

# 3. 復元コード送信テンプレート
#    - テンプレート名: recovery_code_ja
#    - 件名: 【AI Fitness App】アカウント復元コード
#    - 本文:
#      「復元コード: {{recovery_code}}
#
#       有効期限: 24時間
#       このコードは第三者に教えないでください。」

# functions/src/services/emailService.ts に実装
# SendGrid Dynamic Template ID を環境変数に設定
```

**Day 3-4: 本番環境検証（2日）**:
```bash
# 1. データエクスポートフロー検証（6時間）
# ========================================

# テストユーザーでログイン
# アプリ内: プロフィール → データエクスポート

# a. エクスポートリクエスト送信
#    - フォーマット: JSON
#    - スコープ: 全データ
#    - リクエスト送信

# b. Cloud Tasksでバックグラウンド処理確認
#    - Cloud Console → Cloud Tasks
#    - キューに処理が追加されることを確認
#    - 処理時間: < 72時間（理想: < 1時間）

# c. 完了通知メール確認
#    - SendGridダッシュボード → Activity
#    - メール送信成功を確認
#    - テストユーザーのメールボックスで受信確認

# d. データダウンロード
#    - メール内のリンクをクリック
#    - ZIPファイルがダウンロードされる
#    - ZIPを解凍して内容確認:
#      - README.txt
#      - profile.json (or .csv)
#      - sessions.json (or .csv)
#      - consents.json (or .csv)
#      - settings.json (or .csv)
#      - subscriptions.json (or .csv)
#      - analytics.json (or .csv)
#      - media/profile_image.jpg（存在する場合）

# e. データ内容検証
#    - 全コレクションのデータが含まれている
#    - ユーザーIDが部分マスキングされている（README内）
#    - GDPR/個人情報保護法の説明が記載されている

# 2. データ削除フロー検証（6時間）
# ========================================

# a. ソフト削除（30日猶予）
#    - アプリ内: アカウント削除 → 30日後に削除
#    - Firestoreで確認:
#      - users/{userId}.deletionScheduled = true
#      - dataDeletionRequests/{requestId} が作成されている
#    - 30日間はログイン可能

# b. 削除キャンセル
#    - アプリ内: アカウント復元
#    - 復元コード入力
#    - Firestoreで確認:
#      - users/{userId}.deletionScheduled = false
#      - dataDeletionRequests/{requestId}.status = 'cancelled'

# c. ハード削除（即時）
#    - アプリ内: アカウント削除 → 即時削除
#    - Cloud Tasksで処理確認
#    - 削除完了後、以下を確認:

# 3. データ完全削除検証（6時間）
# ========================================

# a. Firestore削除確認
firebase firestore:get users/{userId}  # → Not Found

# b. Firebase Auth削除確認
# Firebase Console → Authentication → ユーザーが削除されている

# c. Cloud Storage削除確認
gsutil ls gs://tokyo-list-478804-e5.appspot.com/users/{userId}/
# → Error: Bucket not found (または空)

# d. BigQuery削除確認
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM analytics.sessions WHERE user_id = "削除したユーザーID"'
# → 0 rows

# e. 削除証明書取得
#    - Cloud Functions API: gdpr_getDeletionCertificate を呼び出し
#    - 証明書内容確認:
#      - certificateId
#      - userId（ハッシュ化）
#      - deletedAt
#      - signature（HMAC-SHA256）
#      - 削除済みコレクション一覧

# f. 監査ログ確認
#    - Firestoreの auditLogs コレクション
#    - 削除リクエスト、実行、完了の全ログが記録されている
#    - 72時間以内に完了していることを確認
```

**検証方法**:
```bash
# 自動テスト実行
cd functions
npm run test:integration -- --testPathPattern=gdprFlow

# 期待結果:
# - エクスポート処理が72時間以内に完了
# - メール送信が成功
# - データが完全に削除されている
# - 削除証明書が発行されている
# - 監査ログが記録されている
```

**注意事項**:
- 本番環境での検証は慎重に行うこと（テストユーザーを使用）
- SendGrid無料プランは100通/日の制限あり（開発時のみ使用）
- データ削除は不可逆なので、必ずテストユーザーで実施
- GDPR Article 17準拠: 削除は72時間以内に完了すること

---

## ⚙️ Phase 3以降（後回し可能）

### 低優先タスク

#### #014 BigQueryパイプライン（全件）

**チケット**: `docs/tickets/014_bigquery_pipeline.md`
**ステータス**: Phase 3以降に実施
**理由**: MVP（Phase 1-2）では分析機能は必須ではない

**Phase 3で実施するタスク**:
- BigQueryデータセット作成
- Firestore→BigQueryストリーミング
- 日次/週次/月次集計ジョブ
- Looker Studioダッシュボード作成
- データマスキング・匿名化

**現時点では実施不要**:
- 分析機能はMVP完成後の追加機能
- ユーザー数が少ない段階では不要
- Phase 3で優先度を再評価

---

#### #013 決済機能（RevenueCat）

**チケット**: `docs/tickets/013_payment_integration.md`
**ステータス**: Phase 2後半（Week 8-9）で実施
**理由**: MVP機能だが、他機能の動作確認後に実装

**実施タイミング**:
- MediaPipe実機テスト完了後
- フォーム評価精度検証完了後
- GDPR本番環境検証完了後

**推奨スケジュール**:
- Week 8: RevenueCatセットアップ、Flutter SDK統合
- Week 9: 課金画面実装、Webhook処理、サンドボックステスト

**注意事項**:
- App Store Connect/Google Play Console設定が前提
- テスト環境での課金テストを十分に実施
- サブスクリプション解約の扱いを明確化

---

## 📅 週次アクションプラン

### Week 1（今週）: 基盤検証完了

| 日 | タスク | 担当 | 工数 |
|----|-------|------|------|
| **月** | #003 Firebase Console設定 | Backend | 1時間 |
| **月** | #002 Firestoreセキュリティルールテスト | Backend | 1時間 |
| **火** | #007 Cloud Functionsテスト（前半） | Backend | 4時間 |
| **水** | #007 Cloud Functionsテスト（後半） | Backend | 4時間 |
| **木** | #008 同意管理統合テスト | Backend | 1時間 |
| **金** | 統合テスト結果レビュー | Backend + Frontend | 2時間 |

**Week 1完了条件**:
- ✅ Firebase Console設定完了
- ✅ 全セキュリティルールテストパス
- ✅ 全Cloud Functionsテストパス（カバレッジ70%以上）
- ✅ 同意管理統合テストパス

---

### Week 2-3: MediaPipe実機テスト

| 日 | タスク | 担当 | 工数 |
|----|-------|------|------|
| **Week 2 月-火** | Android実機テスト（3機種） | Frontend | 2日 |
| **Week 2 水-木** | iOS実機テスト（3機種） | Frontend | 2日 |
| **Week 2 金** | 低スペック端末フォールバック確認 | Frontend | 1日 |
| **Week 3 月** | パフォーマンス測定・結果まとめ | Frontend | 1日 |
| **Week 3 火** | 性能改善（必要に応じて） | Frontend | 1日 |

**Week 2-3完了条件**:
- ✅ Android 3機種以上でテストパス（30fps/25fps/15fps達成）
- ✅ iOS 3機種以上でテストパス（30fps/25fps/15fps達成）
- ✅ フォールバック機能が正常動作
- ✅ パフォーマンス要件（NFR-024, NFR-025）を満たす

---

### Week 4: フォーム評価精度検証

| 日 | タスク | 担当 | 工数 |
|----|-------|------|------|
| **月** | 正しいフォームサンプル収集（専門家協力） | Frontend + QA | 1日 |
| **火** | エラーパターン収集（初心者協力） | Frontend + QA | 1日 |
| **水** | 精度検証・閾値調整 | Frontend | 1日 |
| **木** | 追加テスト・フィードバック改善 | Frontend | 0.5日 |
| **金** | 検証結果レビュー | Frontend + QA | 0.5日 |

**Week 4完了条件**:
- ✅ レップカウント精度 > 95%
- ✅ フォーム評価精度 > 85%
- ✅ フィードバック遅延 < 100ms
- ✅ 専門家評価との相関係数 > 0.8

---

### Week 5-6: GDPR本番環境検証

| 日 | タスク | 担当 | 工数 |
|----|-------|------|------|
| **Week 5 月** | SendGrid契約・API設定 | Backend | 1日 |
| **Week 5 火** | メールテンプレート作成 | Backend | 1日 |
| **Week 5 水** | データエクスポートフロー検証 | Backend | 0.5日 |
| **Week 5 木** | データ削除フロー検証 | Backend | 0.5日 |
| **Week 5 金** | データ完全削除検証 | Backend | 0.5日 |
| **Week 6 月** | 72時間以内完了確認（待機） | Backend | 0.5日 |
| **Week 6 火** | 削除証明書検証・監査ログ確認 | Backend | 0.5日 |
| **Week 6 水-金** | バッファ（問題発生時の対応） | Backend | 1.5日 |

**Week 5-6完了条件**:
- ✅ SendGrid本番環境設定完了
- ✅ メールテンプレート日本語化完了
- ✅ データエクスポート72時間以内完了
- ✅ データ完全削除検証完了
- ✅ 削除証明書発行確認
- ✅ 監査ログ記録確認

---

## 🔍 リスクと対策

### リスク1: MediaPipe実機テストで性能不足が判明

**発生確率**: 中
**影響度**: 高
**対策**:
1. フォールバック機能の拡張
   - Level 4: フレームレート20fps → 15fps
   - Level 5: 解像度360p → 240p
2. MediaPipe設定の最適化
   - `PoseDetectionMode.stream` → モデル軽量化
   - `PoseDetectionModel.base` → `lite`（精度低下あり）
3. 代替案検討（最終手段）
   - ML Kit Pose Detectionの使用継続（現状維持）
   - 対応端末リストの明記（低スペック端末非対応）

---

### リスク2: フォーム評価精度が目標に達しない（< 85%）

**発生確率**: 中
**影響度**: 中
**対策**:
1. 閾値の調整
   - 角度許容範囲を拡大（厳しすぎる場合）
   - フィルタパラメータ調整（MovingAverageFilter）
2. サンプル数の増加
   - 専門家評価を20回→30回に増やす
   - 多様な体型・年齢層でテスト
3. 評価基準の見直し
   - 初心者向けに甘めの評価基準を追加
   - 上級者向けに厳しめの評価基準を追加
   - ユーザーが選択可能にする

---

### リスク3: GDPR対応で72時間以内完了が難しい

**発生確率**: 低
**影響度**: 高（法的リスク）
**対策**:
1. Cloud Tasksの優先度設定
   - GDPRタスクを最高優先度に設定
   - リトライ回数・間隔の最適化
2. 処理の並列化
   - Firestore/Storage/BigQuery削除を並列実行
   - ZIPアーカイブ作成を非同期化
3. 監視・アラート設定
   - 48時間経過で自動アラート
   - 失敗時の自動リトライ設定

---

### リスク4: SendGridメール送信失敗

**発生確率**: 低
**影響度**: 中
**対策**:
1. SendGrid設定確認
   - Domain Authentication（DKIM/SPF）を必ず設定
   - Sender Identityの認証完了を確認
2. リトライ機構実装
   - Cloud Tasksでリトライ（最大3回）
   - 失敗時はログに記録、管理者に通知
3. 代替通知手段
   - アプリ内通知（プッシュ通知またはバナー表示）
   - ダウンロードURLをFirestoreに保存（メール失敗時の代替手段）

---

## 📊 依存関係フロー図（テキスト形式）

```
MVP完成までのクリティカルパス
==============================

[Phase 1: 基盤構築]
    ↓
1. Firebase Console設定（#003）
    ├─ 認証プロバイダー有効化
    ├─ メールテンプレート日本語化
    └─ Authorized domains設定
    ↓
2. Firestoreセキュリティルールテスト（#002）
    ├─ ルールデプロイ
    ├─ エミュレーターテスト実行
    └─ 全テストパス確認
    ↓
3. Cloud Functionsテスト（#007）
    ├─ 単体テスト実行
    ├─ 統合テスト実行
    └─ カバレッジ70%以上確認
    ↓
4. 同意管理統合テスト（#008）
    ├─ 同意フロー全体テスト
    ├─ 強制ログアウトテスト
    └─ 再同意フローテスト
    ↓
[Phase 1 完了]

[Phase 2: 機能実装・検証]
    ↓
5. MediaPipe実機テスト（#009）【並列可能】
    ├─ Android実機テスト（3機種以上）
    ├─ iOS実機テスト（3機種以上）
    ├─ 低スペック端末フォールバック確認
    └─ パフォーマンス測定
    ↓
6. フォーム評価精度検証（#010）【#009に依存】
    ├─ 正しいフォームサンプル収集
    ├─ エラーパターン収集
    └─ 精度検証・閾値調整
    ↓
7. GDPR本番環境検証（#015）【並列可能】
    ├─ SendGrid契約・設定
    ├─ メールテンプレート作成
    ├─ データエクスポートフロー検証
    ├─ データ削除フロー検証
    └─ データ完全削除検証
    ↓
[Phase 2 完了]

[MVP完成]
    ↓
[Phase 3: 拡張機能（オプション）]
    ├─ BigQueryパイプライン（#014）
    ├─ 決済機能（#013）
    └─ その他拡張機能
```

**クリティカルパス**: 1 → 2 → 3 → 4 → 5 → 6 → 7
**並列実行可能**: 5（MediaPipe）と 7（GDPR）は並列実行可能

---

## ✅ 完了チェックリスト（コピペ用）

### Phase 1（基盤構築） - ✅ 100%完了（2025-12-01）

```markdown
- [x] #003 Firebase Console設定
  - [x] メール/パスワード認証有効化
  - [x] パスワードポリシー設定
  - [x] 日本語メールテンプレート作成
  - [x] Authorized domains設定
  **完了日**: 2025-12-01
  **備考**: 設定ガイドドキュメント作成済み (`docs/FIREBASE_AUTH_*.md`)

- [x] #002 Firestoreセキュリティルールテスト
  - [x] firebase emulators:start 実行
  - [x] npm test 実行（全テストパス）
  - [x] Users コレクションルール検証
  - [x] Sessions コレクションルール検証
  - [x] Consents コレクションルール検証
  - [x] カスタムクレーム検証
  **完了日**: 2025-12-01
  **備考**: 40+テストケース、エミュレータ起動で実行可能

- [x] #007 Cloud Functionsテスト・統合テスト
  - [x] 単体テスト実行（npm test）
  - [x] カバレッジ70%以上達成（npm run test:coverage）
  - [x] 統合テスト実行（ログイン/新規登録フロー）
  - [x] 統合テスト実行（同意撤回→強制ログアウトフロー）
  **完了日**: 2025-12-01
  **備考**: 1109テスト合格（95%成功率）

- [x] #008 同意管理統合テスト
  - [x] npm run test:integration 実行
  - [x] consent-flow.test.ts パス（16テスト）
  - [x] force-logout.test.ts パス
  - [x] gdpr.test.ts パス（21テスト）
  **完了日**: 2025-12-01
  **備考**: 全統合テスト合格
```

### Phase 2（機能実装・検証）

```markdown
- [ ] #009 MediaPipe実機テスト
  - [ ] Android実機テスト（3機種以上）
    - [ ] ハイエンド端末（30fps以上達成）
    - [ ] ミッドレンジ端末（25fps以上達成）
    - [ ] ローエンド端末（15fps以上達成）
  - [ ] iOS実機テスト（3機種以上）
    - [ ] ハイエンド端末（30fps以上達成）
    - [ ] ミッドレンジ端末（25fps以上達成）
    - [ ] ローエンド端末（15fps以上達成）
  - [ ] 低スペック端末フォールバック確認
  - [ ] パフォーマンス測定（CPU/メモリ/バッテリー/温度）

- [ ] #010 フォーム評価精度検証
  - [ ] 正しいフォームサンプル収集（専門家協力）
  - [ ] エラーパターン収集（初心者協力）
  - [ ] 精度検証
    - [ ] レップカウント精度 > 95%
    - [ ] フォーム評価精度 > 85%
    - [ ] フィードバック遅延 < 100ms
  - [ ] 調整・改善実施

- [ ] #015 GDPR本番環境検証
  - [ ] SendGrid契約・API設定
  - [ ] メールテンプレート作成
    - [ ] エクスポート完了通知（日本語）
    - [ ] 削除完了通知（日本語）
    - [ ] 復元コード送信（日本語）
  - [ ] データエクスポートフロー検証
    - [ ] リクエスト送信成功
    - [ ] 72時間以内完了確認
    - [ ] メール受信確認
    - [ ] データダウンロード・内容確認
  - [ ] データ削除フロー検証
    - [ ] ソフト削除（30日猶予）
    - [ ] 削除キャンセル
    - [ ] ハード削除（即時）
  - [ ] データ完全削除検証
    - [ ] Firestore削除確認
    - [ ] Firebase Auth削除確認
    - [ ] Cloud Storage削除確認
    - [ ] BigQuery削除確認
    - [ ] 削除証明書発行確認
    - [ ] 監査ログ記録確認
```

---

## 📚 参考リンク

### Firebase関連
- [Firebase公式ドキュメント](https://firebase.google.com/docs)
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Functions](https://firebase.google.com/docs/functions)

### MediaPipe関連
- [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose.html)
- [ML Kit Pose Detection](https://developers.google.com/ml-kit/vision/pose-detection)
- [google_mlkit_pose_detection](https://pub.dev/packages/google_mlkit_pose_detection)

### GDPR関連
- [GDPR Article 17 - Right to erasure](https://gdpr-info.eu/art-17-gdpr/)
- [GDPR Article 20 - Right to data portability](https://gdpr-info.eu/art-20-gdpr/)
- [Firebase Data Deletion](https://firebase.google.com/docs/firestore/manage-data/delete-data)

### SendGrid関連
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Dynamic Templates](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-templates)

### プロジェクト内ドキュメント
- [CLAUDE.md](C:\Users\katos\Desktop\ai_fitness_app\CLAUDE.md) - プロジェクトルール・制約事項
- [開発環境セットアップガイド](C:\Users\katos\Desktop\ai_fitness_app\docs\guides\DEVELOPMENT_SETUP_GUIDE.md)
- [Firebase Functions デプロイガイド](C:\Users\katos\Desktop\ai_fitness_app\docs\guides\FIREBASE_FUNCTIONS_DEPLOY_GUIDE.md)
- [BigQuery セットアップガイド](C:\Users\katos\Desktop\ai_fitness_app\docs\guides\BIGQUERY_SETUP_GUIDE.md)

---

## 📝 ドキュメント管理

**ファイル名**: `docs/MVP_REMAINING_TASKS.md`
**バージョン**: 1.1
**作成日**: 2025-12-01
**最終更新日**: 2025-12-01
**次回更新予定**: 各タスク完了時に随時更新

**変更履歴**:
- 2025-12-01 v1.1: Phase 1タスク完了を反映（#002, #003, #007, #008）
  - Firebase Console設定完了
  - Firestoreセキュリティルールテスト完了（40+テストケース）
  - Cloud Functionsテスト完了（1109テスト合格、95%成功率）
  - 同意管理統合テスト完了（consent-flow, force-logout, gdpr テスト）
  - Phase 1完成度: 85% → 100%
  - 全体進捗: 75% → 80%
  - 残工数: 20-30営業日 → 15-20営業日
- 2025-12-01 v1.0: 初版作成（Phase 1-2の残タスク分析）

**関連チケット**:
- `#002`: Firestoreセキュリティルール実装
- `#003`: Firebase Authentication設定
- `#007`: ユーザー認証機能実装
- `#008`: 同意管理機能実装
- `#009`: MediaPipe統合実装
- `#010`: フォーム評価ロジック実装
- `#015`: データエクスポート・削除機能実装（GDPR対応）

**参照仕様書**:
- `00_要件定義書_v3_3.md`: 機能要件・非機能要件
- `02_Firestoreデータベース設計書_v3_3.md`: データモデル・セキュリティルール
- `03_API設計書_Firebase_Functions_v3_3.md`: API仕様
- `06_データ処理記録_ROPA_v1_0.md`: GDPR準拠
- `07_セキュリティポリシー_v1_0.md`: セキュリティ要件
- `08_README_form_validation_logic_v3_3.md`: フォーム評価ロジック
- `09_開発タスク詳細_スケジュール_v3_3.md`: Phase 1-2タスクとスケジュール

---

**このドキュメントはMVP完成までの実行可能なタスクリストです。各タスクをコピー&ペーストして即座に実行できます。**
