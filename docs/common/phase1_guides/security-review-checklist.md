# セキュリティレビューチェックリスト

**対象**: AI Fitness App Phase 1
**プロジェクトID**: tokyo-list-478804-e5
**最終更新**: 2025年12月10日

---

## このドキュメントについて

Phase 1で実装した機能のセキュリティを体系的にチェックするためのチェックリストです。
各項目を確認し、問題があれば対応してから次のフェーズに進みます。

---

## 1. Firestore Security Rules

### 1.1 認証テスト

| チェック項目 | 確認方法 | 期待結果 | テストファイル |
|-------------|----------|---------|---------------|
| 未認証ユーザーはデータを読めない | エミュレータでテスト実行 | FAIL (拒否) | `firebase/__tests__/firestore.rules.test.ts` |
| 未認証ユーザーはデータを書けない | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| 認証済みユーザーは自分のデータを読める | エミュレータでテスト実行 | PASS (許可) | 同上 |
| 認証済みユーザーは自分のデータを更新できる | エミュレータでテスト実行 | PASS (許可) | 同上 |

**実行コマンド**:
```bash
cd firebase
npm test
```

### 1.2 所有権検証

| チェック項目 | 確認方法 | 期待結果 | テストファイル |
|-------------|----------|---------|---------------|
| 他人のプロフィールは読めない | エミュレータでテスト実行 | FAIL (拒否) | `firebase/__tests__/firestore.rules.test.ts` |
| 他人のプロフィールは更新できない | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| 他人のセッションデータは読めない | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| 他人の同意履歴は読めない | エミュレータでテスト実行 | FAIL (拒否) | 同上 |

### 1.3 フィールドレベルアクセス制御

| チェック項目 | 確認方法 | 期待結果 | テストファイル |
|-------------|----------|---------|---------------|
| tosAccepted は読み取り専用 | エミュレータでテスト実行 | FAIL (拒否) | `firebase/__tests__/firestore.rules.test.ts` |
| ppAccepted は読み取り専用 | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| deletionScheduled はクライアントから変更不可 | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| email は変更不可 | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| createdAt は変更不可 | エミュレータでテスト実行 | FAIL (拒否) | 同上 |

### 1.4 削除予定ユーザーの制限

| チェック項目 | 確認方法 | 期待結果 | テストファイル |
|-------------|----------|---------|---------------|
| 削除予定ユーザーはプロフィール更新不可 | エミュレータでテスト実行 | FAIL (拒否) | `firebase/__tests__/firestore.rules.test.ts` |
| 削除予定ユーザーはセッション保存不可 | エミュレータでテスト実行 | FAIL (拒否) | 同上 |
| 削除予定ユーザーは自分のデータを読める | エミュレータでテスト実行 | PASS (許可) | 同上 |

### 1.5 バリデーション

| チェック項目 | 確認方法 | 期待結果 | テストファイル |
|-------------|----------|---------|---------------|
| 身長は100-250cmの範囲内 | エミュレータでテスト実行 | 範囲外はFAIL | `firebase/__tests__/firestore.rules.test.ts` |
| 体重は30-300kgの範囲内 | エミュレータでテスト実行 | 範囲外はFAIL | 同上 |
| repCountは0-1000の範囲内 | エミュレータでテスト実行 | 範囲外はFAIL | 同上 |
| exerciseTypeは有効な値のみ | エミュレータでテスト実行 | 無効な値はFAIL | 同上 |
| consentTypeは有効な値のみ | エミュレータでテスト実行 | 無効な値はFAIL | 同上 |

---

## 2. OWASP Top 10 (2021)

### A01: Broken Access Control（アクセス制御の不備）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| 全APIで認証必須 | コードレビュー | ✅ | `functions/src/middleware/auth.ts` |
| 本人確認の実装 | コードレビュー | ✅ | `context.auth.uid` で検証 |
| カスタムクレームの検証 | コードレビュー | ✅ | admin権限のチェック |
| 削除予定ユーザーの制限 | コードレビュー | ✅ | middleware + Firestoreルール |

**確認コマンド**:
```bash
cd functions/src
grep -r "context.auth" api/
grep -r "HttpsError.*unauthenticated" api/
```

### A02: Cryptographic Failures（暗号化の失敗）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| TLS 1.3 による通信暗号化 | Firebase Functionsデフォルト | ✅ | HTTPS強制 |
| Firestoreデータの保存時暗号化 | Google管理キー | ✅ | AES-256 |
| IPアドレスのハッシュ化 | コードレビュー | ✅ | SHA-256, `utils/crypto.ts` |
| パスワード管理 | Firebase Auth | ✅ | bcrypt相当 |

**確認コマンド**:
```bash
cd functions/src
grep -r "hashIpAddress" utils/
```

### A03: Injection（インジェクション）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| 入力値のバリデーション | コードレビュー | ✅ | `middleware/validation.ts` |
| Firestore クエリのパラメータ化 | コードレビュー | ✅ | Admin SDK使用 |
| BigQuery クエリのパラメータ化 | コードレビュー | ✅ | プレースホルダー使用 |
| XSS対策（サニタイゼーション） | コードレビュー | ✅ | クライアント側でエスケープ |

**確認コマンド**:
```bash
cd functions/src
grep -r "validateRequest" middleware/
grep -r "z.object" api/
```

### A04: Insecure Design（安全でない設計）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| デフォルト拒否原則 | Firestoreルール確認 | ✅ | 明示的に許可したもののみ |
| セキュアデフォルト設定 | 設定ファイル確認 | ✅ | `firebase.json` |
| 脅威モデリング | ドキュメント確認 | ✅ | `docs/specs/08_セキュリティポリシー_v1_0.md` |
| GDPR準拠設計 | ドキュメント確認 | ✅ | `docs/specs/07_データ処理記録_ROPA_v1_0.md` |

### A05: Security Misconfiguration（セキュリティ設定の誤り）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| デフォルトアカウント無効化 | Firebase設定確認 | ✅ | Firebase Authのみ使用 |
| 不要なサービス無効化 | `firebase.json` 確認 | ✅ | 必要最小限 |
| CORSヘッダーの適切な設定 | コードレビュー | ✅ | Firebase Functions自動設定 |
| エラーメッセージの制御 | コードレビュー | ✅ | 詳細は非表示 |

**確認コマンド**:
```bash
cat firebase.json
```

### A06: Vulnerable and Outdated Components（脆弱なコンポーネント）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| npm audit の実行 | CI/CDパイプライン | ✅ | `.github/workflows/functions-ci.yml` |
| 依存関係の定期更新 | package.json確認 | ✅ | Dependabot有効化推奨 |
| セキュリティアドバイザリの監視 | GitHub設定 | 🔄 | 要設定 |

**確認コマンド**:
```bash
cd functions
npm audit --audit-level=high
npm outdated
```

### A07: Identification and Authentication Failures（認証の不備）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| 強力な認証機構 | Firebase Auth | ✅ | MFA対応可能 |
| セッション管理 | Firebase Auth | ✅ | トークンベース |
| パスワードポリシー | Firebase Auth設定 | ✅ | 8文字以上 |
| レート制限 | コードレビュー | ✅ | `middleware/rateLimit.ts` |

**確認コマンド**:
```bash
cd functions/src
grep -r "rateLimit" middleware/
```

### A08: Software and Data Integrity Failures（整合性の不備）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| CI/CDパイプラインのセキュリティ | GitHub Actions確認 | ✅ | `.github/workflows/` |
| 署名検証 | Firebase Functions | ✅ | Google署名検証 |
| 依存関係の検証 | package-lock.json | ✅ | ハッシュ検証 |

### A09: Security Logging and Monitoring Failures（ログとモニタリングの不足）

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| 認証イベントのログ | コードレビュー | ✅ | `utils/logger.ts` |
| 失敗したアクセスのログ | コードレビュー | ✅ | エラーハンドラー |
| GDPR監査ログ | コードレビュー | ✅ | `consents`コレクション |
| Cloud Logging統合 | Firebase設定 | ✅ | 自動統合 |

**確認コマンド**:
```bash
cd functions/src
grep -r "logger.warn" api/
grep -r "logger.error" api/
```

### A10: Server-Side Request Forgery (SSRF)

| チェック項目 | 確認方法 | 状態 | 備考 |
|-------------|----------|------|------|
| 外部URLのホワイトリスト | コードレビュー | ✅ | BigQuery APIのみ |
| URLバリデーション | コードレビュー | N/A | 外部URL入力なし |
| ネットワーク分離 | VPC設定 | 🔄 | Phase 2で検討 |

---

## 3. Cloud Functions セキュリティ

### 3.1 認証・認可

| チェック項目 | テスト方法 | 状態 |
|-------------|----------|------|
| 未認証リクエストの拒否 | ユニットテスト | ✅ |
| トークンの検証 | ユニットテスト | ✅ |
| カスタムクレームの確認 | ユニットテスト | ✅ |
| CSRF保護（二重送信Cookie） | ユニットテスト | ✅ |

**テストコマンド**:
```bash
cd functions
npm test -- tests/api/
```

### 3.2 入力バリデーション

| チェック項目 | テスト方法 | 状態 |
|-------------|----------|------|
| 必須フィールドの検証 | ユニットテスト | ✅ |
| データ型の検証 | ユニットテスト | ✅ |
| 範囲値の検証 | ユニットテスト | ✅ |
| 列挙型の検証 | ユニットテスト | ✅ |

### 3.3 エラーハンドリング

| チェック項目 | テスト方法 | 状態 |
|-------------|----------|------|
| エラーメッセージの適切性 | コードレビュー | ✅ |
| スタックトレースの非表示 | コードレビュー | ✅ |
| ログへのセンシティブ情報の除外 | コードレビュー | ✅ |

---

## 4. Firebase Auth セキュリティ

### 4.1 認証トリガー

| チェック項目 | テスト方法 | 状態 |
|-------------|----------|------|
| onCreate: ユーザードキュメント作成 | ユニットテスト | ✅ |
| onCreate: カスタムクレーム設定 | ユニットテスト | ✅ |
| onDelete: データ削除 | ユニットテスト | ✅ |
| onDelete: BigQuery同期削除 | ユニットテスト | ✅ |

**テストコマンド**:
```bash
cd functions
npm test -- tests/auth/
```

---

## 5. 依存パッケージのセキュリティ

### 5.1 npm audit

```bash
cd functions
npm audit --audit-level=high
```

| 重要度 | 許容基準 |
|-------|---------|
| Critical | 0件（即座に対応） |
| High | 0件（即座に対応） |
| Moderate | レビュー後判断 |
| Low | 次回更新時対応 |

### 5.2 依存関係の更新

```bash
cd functions
npm outdated
npm update
```

---

## 6. CI/CDパイプラインのセキュリティ

### 6.1 GitHub Actions

| チェック項目 | 確認方法 | 状態 |
|-------------|----------|------|
| シークレット管理 | GitHub Secrets | 🔄 |
| npm audit 自動実行 | ワークフロー確認 | ✅ |
| Firestore Rules テスト | ワークフロー確認 | ✅ |
| Functions テスト | ワークフロー確認 | ✅ |

**確認ファイル**:
- `.github/workflows/functions-ci.yml`
- `.github/workflows/firestore-rules-ci.yml`
- `.github/workflows/deploy.yml`

---

## 7. セキュリティレビュー実施手順

### ステップ1: テスト実行

```bash
# Firestore Security Rules テスト
cd firebase
npm install
npm test

# Cloud Functions ユニットテスト
cd ../functions
npm install
npm test

# npm audit
npm audit --audit-level=high
```

### ステップ2: 手動確認

1. **Firestore Rules確認**
   ```bash
   cat firebase/firestore.rules
   ```
   - デフォルト拒否ルールの確認
   - 認証チェックの確認
   - フィールドレベル制御の確認

2. **Cloud Functions認証確認**
   ```bash
   grep -r "context.auth" functions/src/api/
   ```

3. **ログ出力確認**
   ```bash
   grep -r "logger" functions/src/api/
   ```

### ステップ3: 報告書作成

`docs/common/security-review-report.md` を作成

---

## 8. チェックリスト実行記録

| 実施日 | 実施者 | Phase | 結果 | 報告書 |
|-------|-------|-------|------|-------|
| YYYY-MM-DD | - | Phase 1 | - | - |

---

## 9. 発見された問題の管理

問題が見つかった場合は、以下のテンプレートで記録:

```markdown
### 問題 #001

- **重要度**: Critical / High / Medium / Low
- **カテゴリ**: OWASP A01-A10 / その他
- **発見日**: YYYY-MM-DD
- **発見者**: [名前]
- **説明**: [問題の詳細]
- **影響**: [セキュリティへの影響]
- **対策**: [実施すべき対策]
- **状態**: Open / In Progress / Resolved
- **解決日**: YYYY-MM-DD
```

---

## 10. 次のステップ

Phase 1完了後:

1. ✅ このチェックリストの全項目を確認
2. ✅ セキュリティレビュー報告書を作成
3. ✅ 発見された問題を全て解決
4. ✅ Phase 2に進む前に再度確認

Phase 2以降:

- ペネトレーションテスト（外部委託検討）
- セキュリティ監査（四半期ごと）
- 脆弱性報奨金プログラム検討

---

## 参考資料

- [OWASP Top 10 - 2021](https://owasp.org/Top10/)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions Security](https://firebase.google.com/docs/functions/security)
- `docs/common/specs/08_セキュリティポリシー_v1_0.md`
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md`
