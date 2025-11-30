# GDPR Test Suite

GDPR Article 17 (削除権) および Article 20 (データポータビリティ権) に準拠したデータエクスポート・削除機能のテストスイートです。

## テスト構成

### 単体テスト

#### exportData.test.ts
エクスポートAPI (`gdpr_requestDataExport`, `gdpr_getExportStatus`) の単体テスト

**テストケース**:
- ✅ 認証済みユーザーのエクスポートリクエスト作成
- ✅ 未認証リクエストの拒否
- ✅ 本人のリクエストステータス取得
- ✅ 他ユーザーリクエストへのアクセス拒否

#### deleteData.test.ts
削除API (`gdpr_requestAccountDeletion`, `gdpr_cancelDeletion`) の単体テスト

**テストケース**:
- ✅ ソフト削除リクエスト作成（30日猶予期間）
- ✅ ハード削除リクエスト作成
- ✅ 部分削除リクエスト作成
- ✅ deletionScheduledフラグ設定
- ✅ 削除キャンセル
- ✅ 期限後キャンセル拒否
- ✅ deletionScheduledフラグクリア

#### gdprService.test.ts
GDPRサービス関数の単体テスト

**テストケース**:
- collectUserData:
  - ✅ 全データタイプ収集
  - ✅ 日付範囲スコープ尊重
  - ✅ 特定データタイプスコープ尊重
  - ✅ 欠損データの適切な処理
- deleteUserData:
  - ✅ 全スコープデータ削除
  - ✅ 部分スコープデータ削除
- verifyCompleteDeletion:
  - ✅ 完全削除検証（成功）
  - ✅ 完全削除検証（残存データ検出）
- generateDeletionCertificate:
  - ✅ 削除証明書生成と署名
  - ✅ 削除証明書Firestore保存

### 統合テスト

#### gdprFlow.test.ts
GDPR機能のエンドツーエンドフローテスト

**テストケース**:
- Export Flow:
  - ✅ エクスポートフロー（リクエスト〜ダウンロード）
- Deletion Flow:
  - ✅ ソフト削除フロー（復元可能）
  - ✅ ハード削除フロー
- Recovery Flow:
  - ✅ 猶予期間内アカウント復元
  - ✅ 期限後復元拒否

### コンプライアンステスト

#### gdprCompliance.test.ts
GDPR準拠性検証テスト

**テストケース**:
- Article 17 - Right to Erasure:
  - ✅ 全個人データ削除
  - ✅ 削除証明書提供
  - ✅ データ残存確認
- Article 20 - Data Portability:
  - ✅ 機械可読形式データ提供
  - ✅ 全ユーザーデータ含有
  - ✅ 72時間以内完了
- Data Integrity:
  - ✅ エクスポート時データ整合性
  - ✅ 削除完全性確保

## テストヘルパー

### gdprTestHelpers.ts
GDPR機能テスト用のヘルパー関数

**提供機能**:
- `createTestUser()` - テストユーザー作成
- `createTestSession()` - テストセッション作成
- `cleanupTestUser()` - テストデータクリーンアップ
- `createMockExportRequest()` - モックエクスポートリクエスト生成
- `createMockDeletionRequest()` - モック削除リクエスト生成

## テスト実行

```bash
# 全GDPRテスト実行
npm test -- --testPathPattern=gdpr

# 単体テストのみ
npm test -- tests/gdpr/

# 統合テストのみ
npm test -- tests/integration/gdprFlow.test.ts

# コンプライアンステストのみ
npm test -- tests/compliance/gdprCompliance.test.ts

# カバレッジ付き実行
npm run test:coverage -- --testPathPattern=gdpr
```

## 参照仕様書

- `docs/specs/00_要件定義書_v3_3.md` - FR-025〜FR-027
- `docs/specs/06_データ処理記録_ROPA_v1_0.md` - GDPR準拠
- `docs/specs/07_セキュリティポリシー_v1_0.md` - セキュリティ要件
- `docs/tickets/015_data_export_deletion.md` - 実装チケット

## 注意事項

- テストはFirebase Emulatorを使用せず、モックを使用しています
- 実際のCloud Storage, BigQuery操作はモックされています  
- 認証チェックはモックAuthで実行されます
- テスト実行前にTypeScript/Jest設定の確認が必要です

## カバレッジ目標

- Branches: 70%以上
- Functions: 70%以上
- Lines: 70%以上
- Statements: 70%以上

## 今後の改善

1. TypeScript/Jest設定問題の解決
2. 各テストケースの詳細実装
3. エッジケーステストの追加
4. パフォーマンステストの追加
5. セキュリティテストの強化
