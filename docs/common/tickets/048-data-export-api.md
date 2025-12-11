# 048 データエクスポートAPI

## 概要

管理者がユーザーデータや統計データをエクスポートするためのAPIを実装するチケットです。GDPR準拠のデータポータビリティ要件にも対応します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤
- 042: ユーザー管理API

## 要件

### 機能要件

- FR-028: データエクスポート機能（GDPR Article 20準拠）

### 非機能要件

- NFR-038: 管理者認証
- NFR-008: データ暗号化

## 受け入れ条件（Todo）

### ユーザーデータエクスポートAPI

- [x] 特定ユーザーの全データをエクスポートするAPIを実装
- [x] エクスポート形式を選択可能にする（JSON, CSV）
- [x] 大量データに対応した非同期エクスポートを実装
- [x] エクスポートデータの暗号化オプションを実装
- [x] ダウンロードURLの有効期限を設定

### 統計データエクスポートAPI

- [x] 利用統計のエクスポートAPIを実装
- [x] 期間指定でのエクスポートを実装
- [x] レポート形式でのエクスポートを実装

### 監査ログエクスポートAPI

- [x] 監査ログのエクスポートAPIを実装
- [x] フィルタリング機能を実装（期間、アクション、ユーザー）
- [x] 大量ログの分割エクスポートを実装

### テスト

- [x] ユーザーデータエクスポートのユニットテストを作成
- [x] 統計データエクスポートのユニットテストを作成
- [x] 監査ログエクスポートのユニットテストを作成
- [x] 権限チェックのテストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-028
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - データポータビリティ

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| ユーザーデータエクスポート開始 | POST | /admin/export/user/:userId | admin以上 |
| エクスポート状態確認 | GET | /admin/export/status/:jobId | admin以上 |
| 統計データエクスポート | POST | /admin/export/stats | admin以上 |
| 監査ログエクスポート | POST | /admin/export/audit-logs | superAdmin |
| エクスポート履歴一覧 | GET | /admin/export/history | admin以上 |

### データ構造

```typescript
interface ExportJob {
  id: string;
  type: "user_data" | "stats" | "audit_logs";
  status: "pending" | "processing" | "completed" | "failed";
  format: "json" | "csv";
  requestedBy: string;
  targetUserId?: string;
  filters?: ExportFilters;
  downloadUrl?: string;
  downloadUrlExpiry?: Timestamp;
  fileSize?: number;
  recordCount?: number;
  errorMessage?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  action?: string;
  userId?: string;
}
```

## 見積もり

- 工数: 4日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025-12-12

## 備考

- Cloud Storageに一時保存してダウンロードURLを提供
- 大量データは非同期処理で実装
- エクスポートファイルは24時間後に自動削除

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-12 | 初版作成 |
| 2025-12-12 | 実装完了: API関数、エクスポートサービス、テスト作成 |
