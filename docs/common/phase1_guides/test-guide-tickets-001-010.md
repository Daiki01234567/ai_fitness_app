# テストガイド - Phase 1 チケット001-010

**対象**: AI Fitness App Phase 1
**最終更新**: 2025年12月10日

---

## このドキュメントについて

Phase 1（チケット001-010）で実装した機能のテスト方法を包括的にまとめたガイドです。
各チケットの受け入れ条件を満たすためのテスト手順と、期待される結果を詳しく説明します。

---

## テストの種類

Phase 1では、以下の3種類のテストを実装しています:

| テスト種類 | 対象 | 実行場所 |
|-----------|------|---------|
| **ユニットテスト** | 関数・クラス単体 | `functions/tests/`, `firebase/__tests__/` |
| **統合テスト** | 複数機能の組み合わせ | `functions/tests/integration/` |
| **セキュリティテスト** | アクセス制御・脆弱性 | Firestore Rules, OWASP Top 10 |

---

## 全体テスト実行フロー

### 1. 環境準備

```bash
# プロジェクトルートに移動
cd C:\Users\236149\Desktop\ai_fitness_app

# Firebaseエミュレータ起動（別ターミナル）
firebase emulators:start
```

### 2. Cloud Functionsテスト

```bash
cd functions
npm install  # 初回のみ
npm test     # 全ユニットテスト実行
npm run test:coverage  # カバレッジ付き
```

### 3. Firestore Rulesテスト

```bash
cd ../firebase
npm install  # 初回のみ
npm test     # セキュリティルールテスト
```

### 4. 統合テスト

```bash
cd ../functions
npm run test:integration
```

---

## チケット別テスト詳細

### チケット001: Firebase環境確認

#### 目的
Firebase プロジェクトが正しくセットアップされ、エミュレータが動作することを確認する。

#### テスト項目

| No | テスト項目 | 実行コマンド | 期待結果 |
|----|-----------|------------|---------|
| 1 | Firebase CLI インストール確認 | `firebase --version` | `13.x.x` 以上 |
| 2 | Firebase ログイン確認 | `firebase login:list` | ログイン中のアカウント表示 |
| 3 | プロジェクト選択確認 | `firebase use` | `Active Project: tokyo-list-478804-e5` |
| 4 | Firestore エミュレータ起動 | `firebase emulators:start --only firestore` | `✔ All emulators ready!` |
| 5 | Functions エミュレータ起動 | `firebase emulators:start --only functions` | `✔ All emulators ready!` |
| 6 | Auth エミュレータ起動 | `firebase emulators:start --only auth` | `✔ All emulators ready!` |
| 7 | Storage エミュレータ起動 | `firebase emulators:start --only storage` | `✔ All emulators ready!` |
| 8 | Emulator UI 確認 | http://localhost:4000 | UIが表示される |

#### 合格基準
- 全8項目が期待結果通りに動作する
- エミュレータUIで全サービスが「Running」状態

---

### チケット002: Firestore Security Rules実装

#### 目的
Firestoreのアクセス制御が正しく実装され、セキュリティが保たれることを確認する。

#### テスト実行

```bash
cd firebase
npm test
```

#### テスト項目（40テストケース）

**Users Collection（18テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証要件 | 8 | 未認証拒否、認証済み許可、削除予定制限 |
| 所有権検証 | 6 | 自分のみ読み書き可、他人は不可 |
| フィールド保護 | 4 | tosAccepted, ppAccepted, deletionScheduled 保護 |

**Sessions Subcollection（6テスト）:**
- 認証済み + 所有者のみアクセス可
- 削除予定ユーザーは書き込み不可
- Immutableフィールド保護

**Consents Collection（4テスト）:**
- 認証済み + 所有者のみ読み取り可
- Cloud Functionsのみ書き込み可（監査ログ）
- データ削除・変更不可（Immutable）

**DataDeletionRequests（3テスト）:**
- 認証済み + 所有者のみ読み取り可
- Cloud Functionsのみ作成・更新可

**Admin-only Collections（3テスト）:**
- BigQuerySyncFailures: 全ユーザーアクセス不可
- AuditLogs: 読み取りのみ管理者（実装はPhase 2）

**Catch-all Deny（2テスト）:**
- 未定義コレクションへのアクセス拒否

#### 期待結果

```
Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total
Snapshots:   0 total
Time:        X.XXs
```

#### 合格基準
- 全40テストがパス
- FAIL が1つもない

---

### チケット003: Cloud Functions基盤

#### 目的
Cloud Functions の基本インフラ（middleware, utils, services）が正しく動作することを確認する。

#### テスト実行

```bash
cd functions
npm test -- tests/middleware/
npm test -- tests/utils/
npm test -- tests/services/
```

#### テスト項目

**Middleware（認証・バリデーション・レート制限）:**

| ファイル | テスト数 | 詳細 |
|---------|---------|------|
| `middleware/auth.ts` | 予定 | 認証チェック、トークン検証 |
| `middleware/validation.ts` | 予定 | Zodバリデーション |
| `middleware/rateLimit.ts` | 予定 | レート制限（1分間10回など） |

**Utils（ユーティリティ）:**

| ファイル | テスト数 | 詳細 |
|---------|---------|------|
| `utils/logger.ts` | 予定 | ログ出力、構造化ログ |
| `utils/errors.ts` | 予定 | HttpsError生成 |
| `utils/crypto.ts` | 予定 | IPハッシュ化（SHA-256） |

**Services（外部サービス連携）:**

| ファイル | テスト数 | 詳細 |
|---------|---------|------|
| `services/bigquery.ts` | 予定 | BigQueryへのデータ送信 |
| `services/cloudTasks.ts` | 予定 | Cloud Tasksキュー作成 |

#### 合格基準
- 全テストがパス
- TypeScriptビルドエラーなし（`npm run build`）
- Lintエラーなし（`npm run lint`）

---

### チケット004: 認証トリガー実装

#### 目的
Firebase Authの onCreate, onDelete イベントが正しく処理されることを確認する。

#### テスト実行

```bash
cd functions
npm test -- tests/auth/
```

#### テスト項目

**onCreate トリガー:**

| No | テスト項目 | 期待結果 |
|----|-----------|---------|
| 1 | ユーザー作成時にFirestoreドキュメント作成 | users/{userId} に初期データ作成 |
| 2 | カスタムクレーム設定 | `admin: false` が設定される |
| 3 | メールアドレス保存 | `email` フィールドに保存 |
| 4 | タイムスタンプ設定 | `createdAt` が現在時刻 |
| 5 | 同意フラグ初期化 | `tosAccepted: false, ppAccepted: false` |

**onDelete トリガー:**

| No | テスト項目 | 期待結果 |
|----|-----------|---------|
| 1 | Firestoreドキュメント削除 | users/{userId} 削除 |
| 2 | サブコレクション削除 | sessions, consents 削除 |
| 3 | BigQuery同期削除 | 削除イベントをBigQueryに記録 |
| 4 | Cloud Tasks削除 | 未完了タスクをキャンセル |

#### 合格基準
- onCreate: 5テスト全てパス
- onDelete: 4テスト全てパス

---

### チケット005: ログ・モニタリング設定

#### 目的
ログが適切に出力され、Cloud Loggingに送信されることを確認する。

#### テスト項目

| No | テスト項目 | 確認方法 | 期待結果 |
|----|-----------|---------|---------|
| 1 | 構造化ログ出力 | コードレビュー | `logger.info("message", { context })` 形式 |
| 2 | ログレベル設定 | コードレビュー | info, warn, error を適切に使用 |
| 3 | センシティブ情報除外 | コードレビュー | パスワード、メールアドレスをログに出さない |
| 4 | Cloud Logging統合 | Firebase Console → Logging | ログが表示される |
| 5 | エラーログ記録 | 意図的にエラーを発生 | error レベルでログ記録 |

#### 実行方法

```bash
# エミュレータでログを確認
firebase emulators:start

# Functions を呼び出し
# → ターミナルにログが表示される

# 本番環境のログ確認
firebase functions:log
```

#### 合格基準
- 全てのAPI関数でログ出力が実装されている
- センシティブ情報がログに含まれていない

---

### チケット006: GDPR Consent API

#### 目的
GDPR準拠の同意管理APIが正しく動作することを確認する。

#### テスト実行

```bash
cd functions
npm test -- tests/api/consent/
```

#### テスト項目（91テスト）

**recordConsent（25テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証・CSRF | 4 | 未認証拒否、CSRFトークン検証 |
| 入力バリデーション | 6 | consentType, accepted, version |
| ユーザー確認 | 3 | 存在確認、削除予定拒否 |
| 同意レコード作成 | 8 | TOS/PP記録、タイムスタンプ |
| IPアドレス | 2 | ハッシュ化（SHA-256） |
| デバイス情報 | 2 | デバイス/プラットフォーム検出 |

**revokeConsent（30テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証・CSRF | 4 | 厳格なCSRF保護 |
| 入力バリデーション | 8 | consentType, reason |
| 同意撤回処理 | 6 | TOS/PP/all 撤回 |
| 強制ログアウト | 6 | フラグ設定、トークン無効化 |
| データ削除リクエスト | 4 | 30日猶予期間設定 |
| 監査ログ | 2 | セキュリティイベント記録 |

**getConsentStatus（36テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証・CSRF | 4 | 認証必須 |
| 入力バリデーション | 4 | includeHistory, historyLimit |
| 同意状態構築 | 12 | 未同意/部分同意/完全同意 |
| バージョン更新 | 4 | tosNeedsUpdate, ppNeedsUpdate |
| 履歴取得 | 8 | ページネーション、ソート |
| エラーハンドリング | 4 | エッジケース対応 |

#### 期待結果

```
Test Suites: 3 passed, 3 total
Tests:       91 passed, 91 total
```

#### 合格基準
- 全91テストがパス
- GDPR Article 7（同意）に準拠
- 監査ログが不変（削除・変更不可）

---

### チケット007: User API

#### 目的
ユーザープロフィール管理APIが正しく動作することを確認する。

#### テスト実行

```bash
cd functions
npm test -- tests/api/users/
```

#### テスト項目（42テスト）

**updateProfile（21テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証 | 4 | 未認証拒否、本人確認 |
| 入力バリデーション | 8 | displayName, height, weight, gender, goalWeight |
| フィールド保護 | 4 | tosAccepted, ppAccepted 変更禁止 |
| 削除予定ユーザー | 2 | 更新拒否 |
| タイムスタンプ | 3 | updatedAt 自動更新 |

**getProfile（9テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 認証 | 3 | 未認証拒否、本人確認 |
| データ取得 | 4 | プロフィール全フィールド |
| エラーハンドリング | 2 | ユーザー不在、削除予定 |

**deleteAccount（13テスト）:**

| カテゴリ | テスト数 | 詳細 |
|---------|---------|------|
| 削除リクエスト | 6 | 30日猶予期間、理由記録 |
| 削除キャンセル | 4 | 猶予期間内キャンセル可 |
| GDPR準拠 | 3 | Article 17（削除権） |

#### 期待結果

```
Test Suites: 3 passed, 3 total
Tests:       42 passed, 42 total
```

#### 合格基準
- 全42テストがパス
- プロフィール更新が正しく動作
- GDPR削除権（30日猶予）が実装されている

---

### チケット008: CI/CDパイプライン

#### 目的
GitHub Actionsによる自動テスト・デプロイが正しく動作することを確認する。

#### テスト項目

**Functions CI（`.github/workflows/functions-ci.yml`）:**

| No | テスト項目 | トリガー | 期待結果 |
|----|-----------|---------|---------|
| 1 | ESLint実行 | PR作成/更新 | エラーなし |
| 2 | Prettier実行 | PR作成/更新 | フォーマット正常 |
| 3 | TypeScriptビルド | PR作成/更新 | ビルド成功 |
| 4 | Jest実行 | PR作成/更新 | 全テストパス |
| 5 | カバレッジチェック | PR作成/更新 | 80%以上 |
| 6 | npm audit | PR作成/更新 | Critical脆弱性なし |

**Firestore Rules CI（`.github/workflows/firestore-rules-ci.yml`）:**

| No | テスト項目 | トリガー | 期待結果 |
|----|-----------|---------|---------|
| 1 | ルール構文検証 | ルールファイル変更 | エラーなし |
| 2 | ルールテスト | ルールファイル変更 | 全テストパス |
| 3 | 危険パターン検出 | ルールファイル変更 | `allow read, write: if true` なし |

**Deploy（`.github/workflows/deploy.yml`）:**

| No | テスト項目 | トリガー | 期待結果 |
|----|-----------|---------|---------|
| 1 | 開発環境デプロイ | mainブランチpush | 自動デプロイ |
| 2 | 本番環境デプロイ | タグ作成 | 承認後デプロイ |
| 3 | Slack通知 | デプロイ完了/失敗 | 通知送信 |

#### 実行方法

**ローカルでCI相当のチェック:**

```bash
cd functions

# ESLint + Prettier
npm run lint

# TypeScriptビルド
npm run build

# テスト + カバレッジ
npm run test:coverage

# npm audit
npm audit --audit-level=high
```

#### 合格基準
- 全チェックが成功
- カバレッジ80%以上
- Critical/High脆弱性なし

---

### チケット009: セキュリティレビュー

#### 目的
OWASP Top 10に基づくセキュリティチェックを実施し、脆弱性がないことを確認する。

#### テスト項目

**OWASP Top 10チェック:**

| No | リスク | チェック項目 | 確認方法 |
|----|-------|------------|---------|
| A01 | アクセス制御 | 認証・認可実装 | コードレビュー + Rulesテスト |
| A02 | 暗号化 | TLS 1.3, AES-256 | Firebase設定確認 |
| A03 | インジェクション | バリデーション実装 | テストケース確認 |
| A04 | 安全でない設計 | デフォルト拒否原則 | Firestoreルール確認 |
| A05 | 設定の誤り | 不要サービス無効化 | firebase.json確認 |
| A06 | 脆弱なコンポーネント | npm audit | `npm audit --audit-level=high` |
| A07 | 認証の不備 | Firebase Auth使用 | コードレビュー |
| A08 | 整合性の不備 | CI/CD署名検証 | ワークフロー確認 |
| A09 | ログ不足 | Cloud Logging統合 | ログ出力確認 |
| A10 | SSRF | URLホワイトリスト | コードレビュー |

#### 実行方法

```bash
# セキュリティチェックリスト実行
# docs/common/security-review-checklist.md を参照

# 1. Firestore Rulesテスト
cd firebase
npm test

# 2. npm audit
cd ../functions
npm audit --audit-level=high

# 3. コードレビュー
grep -r "context.auth" src/api/
grep -r "z.object" src/api/
```

#### 合格基準
- OWASP Top 10全項目で対策実施
- Firestore Rulesテスト全てパス
- npm audit で Critical/High 脆弱性なし

---

### チケット010: Phase 1完了検証

#### 目的
Phase 1の全チケット（001-009）が完了し、Phase 2に進む準備ができていることを確認する。

#### テスト項目

**チケット完了確認:**

| チケット | 内容 | 確認方法 | 状態 |
|---------|------|---------|------|
| 001 | Firebase環境確認 | エミュレータ起動 | ✅ |
| 002 | Firestore Security Rules | 40テストパス | ✅ |
| 003 | Cloud Functions基盤 | ビルド成功 | ✅ |
| 004 | 認証トリガー | テストパス | ✅ |
| 005 | ログ・モニタリング | ログ出力確認 | ✅ |
| 006 | GDPR Consent API | 91テストパス | ✅ |
| 007 | User API | 42テストパス | ✅ |
| 008 | CI/CDパイプライン | ワークフロー動作 | ✅ |
| 009 | セキュリティレビュー | OWASP確認 | ✅ |

**統合テスト:**

```bash
cd functions
npm run test:integration
```

| No | テスト項目 | 期待結果 |
|----|-----------|---------|
| 1 | ユーザー登録 → プロフィール更新 → 取得 | 一連の流れが成功 |
| 2 | 同意記録 → 同意状態取得 → 同意撤回 | 全ステップ成功 |
| 3 | アカウント削除リクエスト → キャンセル | 30日猶予が機能 |

#### 実行方法

**全テスト実行スクリプト:**

```bash
#!/bin/bash
# test-all.sh

echo "=== Phase 1 全テスト実行 ==="

# 1. Firestore Rules
echo "1. Firestore Security Rules テスト..."
cd firebase
npm test
if [ $? -ne 0 ]; then
  echo "❌ Firestore Rules テスト失敗"
  exit 1
fi

# 2. Cloud Functions
echo "2. Cloud Functions ユニットテスト..."
cd ../functions
npm test
if [ $? -ne 0 ]; then
  echo "❌ Cloud Functions テスト失敗"
  exit 1
fi

# 3. 統合テスト
echo "3. 統合テスト..."
npm run test:integration
if [ $? -ne 0 ]; then
  echo "❌ 統合テスト失敗"
  exit 1
fi

# 4. npm audit
echo "4. セキュリティチェック..."
npm audit --audit-level=high
if [ $? -ne 0 ]; then
  echo "❌ 脆弱性検出"
  exit 1
fi

echo "✅ 全テスト成功！"
```

#### 合格基準
- 全チケットの受け入れ条件を満たしている
- 全ユニットテストがパス（Firestore Rules 40 + Functions XXX）
- 統合テストがパス
- npm audit で脆弱性なし
- CI/CDパイプラインが動作

---

## テストカバレッジ目標

Phase 1のテストカバレッジ目標:

| カテゴリ | 目標カバレッジ | 確認方法 |
|---------|--------------|---------|
| Cloud Functions | 80%以上 | `npm run test:coverage` |
| Firestore Rules | 100% | 全ルールパスにテストあり |
| 統合テスト | 主要フロー全て | 手動確認 |

**カバレッジ確認:**

```bash
cd functions
npm run test:coverage

# レポートをブラウザで開く
start coverage/lcov-report/index.html  # Windows
open coverage/lcov-report/index.html   # Mac
```

---

## 継続的テスト

Phase 2以降も継続してテストを実施します:

### 毎回のデプロイ前

```bash
# 1. Lint
npm run lint

# 2. テスト
npm test

# 3. ビルド
npm run build
```

### 毎週

```bash
# 依存パッケージの更新確認
npm outdated

# セキュリティ監査
npm audit
```

### 毎月

- セキュリティレビュー（OWASP Top 10）
- パフォーマンステスト
- エンドツーエンドテスト（実機）

---

## トラブルシューティング

テストが失敗する場合:

1. **エラーメッセージを読む**
   - Expected（期待値）と Received（実際の値）を確認

2. **ログを確認**
   ```bash
   # Functionsのログ
   firebase functions:log

   # エミュレータのログ
   cat firebase-debug.log
   ```

3. **エミュレータを再起動**
   ```bash
   # Ctrl+C でエミュレータ停止
   firebase emulators:start
   ```

4. **node_modulesを再インストール**
   ```bash
   cd functions
   rm -rf node_modules package-lock.json
   npm install
   ```

詳しくは `docs/common/user/05_トラブルシューティング.md` を参照。

---

## まとめ

Phase 1のテスト体制:

✅ **173個以上のテストケース**
- Firestore Rules: 40テスト
- GDPR Consent API: 91テスト
- User API: 42テスト
- その他（認証トリガーなど）

✅ **セキュリティテスト**
- OWASP Top 10全項目対応
- Firestore Rules 100%カバレッジ

✅ **CI/CDパイプライン**
- GitHub Actions自動テスト
- npm audit自動実行
- カバレッジチェック

Phase 2では、MediaPipe統合、BigQueryパイプライン、決済機能のテストを追加します。

---

## 参考資料

- `docs/common/user/02_テストの実行方法.md` - テスト実行ガイド
- `docs/common/security-review-checklist.md` - セキュリティチェックリスト
- `docs/common/cicd-guide.md` - CI/CD詳細ガイド
- [Firebase Testing ドキュメント](https://firebase.google.com/docs/rules/unit-tests)
- [Jest ドキュメント](https://jestjs.io/ja/)
