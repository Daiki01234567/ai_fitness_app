# 050 セキュリティ設定API

## 概要

システムのセキュリティ設定を管理するAPIを実装するチケットです。IPアドレス制限、レート制限、認証設定などを管理します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤
- 002: Firestore Security Rules実装

## 要件

### 機能要件

なし（非機能要件から派生）

### 非機能要件

- NFR-032: セキュリティ設定管理
- NFR-038: 管理者認証

## 受け入れ条件（Todo）

### IPアドレス制限API

- [x] 許可IPアドレス一覧取得APIを実装
- [x] 許可IPアドレス追加APIを実装
- [x] 許可IPアドレス削除APIを実装
- [x] ブロックIPアドレス管理APIを実装

### レート制限設定API

- [x] レート制限設定取得APIを実装
- [x] レート制限設定更新APIを実装
- [x] エンドポイント別レート制限設定を実装

### 認証設定API

- [x] 認証ポリシー取得APIを実装
- [x] パスワードポリシー更新APIを実装
- [x] MFA設定更新APIを実装
- [x] セッション有効期限設定APIを実装

### セキュリティ監査API

- [x] セキュリティ設定変更履歴取得APIを実装
- [x] 現在のセキュリティ設定スナップショット取得APIを実装

### テスト

- [x] IPアドレス制限APIのユニットテストを作成
- [x] レート制限設定APIのユニットテストを作成
- [x] 認証設定APIのユニットテストを作成
- [x] 権限チェックのテストを作成

## 参照ドキュメント

- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-032
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| 許可IP一覧取得 | GET | /admin/security/ip-allowlist | superAdmin |
| 許可IP追加 | POST | /admin/security/ip-allowlist | superAdmin |
| 許可IP削除 | DELETE | /admin/security/ip-allowlist/:ip | superAdmin |
| ブロックIP一覧取得 | GET | /admin/security/ip-blocklist | superAdmin |
| ブロックIP追加 | POST | /admin/security/ip-blocklist | superAdmin |
| ブロックIP削除 | DELETE | /admin/security/ip-blocklist/:ip | superAdmin |
| レート制限設定取得 | GET | /admin/security/rate-limits | superAdmin |
| レート制限設定更新 | PUT | /admin/security/rate-limits | superAdmin |
| 認証設定取得 | GET | /admin/security/auth-policy | superAdmin |
| 認証設定更新 | PUT | /admin/security/auth-policy | superAdmin |
| セキュリティ変更履歴 | GET | /admin/security/change-history | superAdmin |

### データ構造

```typescript
interface IpAllowlistEntry {
  ip: string;
  description: string;
  addedBy: string;
  addedAt: Timestamp;
  expiresAt?: Timestamp;
}

interface IpBlocklistEntry {
  ip: string;
  reason: string;
  blockedBy: string;
  blockedAt: Timestamp;
  expiresAt?: Timestamp;
  autoBlocked: boolean;
}

interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  enabled: boolean;
  bypassRoles?: string[];
}

interface AuthPolicy {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  mfaRequired: boolean;
  mfaRequiredForAdmin: boolean;
  sessionTimeoutMinutes: number;
  adminSessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

interface SecurityChangeLog {
  id: string;
  changeType: "ip_allowlist" | "ip_blocklist" | "rate_limit" | "auth_policy";
  action: "create" | "update" | "delete";
  previousValue?: unknown;
  newValue?: unknown;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
}
```

## 見積もり

- 工数: 4日
- 難易度: 高

## 進捗

- [x] 完了

## 完了日

2025-12-12

## 備考

- セキュリティ設定の変更は全て監査ログに記録
- 重要な設定変更は複数管理者の承認を推奨
- 設定ミスによるロックアウト防止のため、緊急解除手順を用意

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-12 | 初版作成 |
| 2025-12-12 | 実装完了: API関数、テスト作成 |
