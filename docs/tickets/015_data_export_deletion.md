# Ticket #015: データエクスポート・削除機能実装（GDPR対応）

**Phase**: Phase 2 (機能実装)
**期間**: Week 10
**優先度**: 高
**ステータス**: 進行中
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-025～FR-027)
- `docs/specs/06_データ処理記録_ROPA_v1_0.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

## 概要
GDPR要件に準拠したデータエクスポート（ポータビリティ）と削除機能を実装する。

## Todo リスト

### データエクスポート機能

#### GDPRモデル (`lib/core/gdpr/gdpr_models.dart`)
- [x] ExportRequest: エクスポートリクエストモデル
- [x] DeletionRequest: 削除リクエストモデル
- [x] ExportScope, DeletionScope: スコープ設定

#### GDPRサービス (`lib/core/gdpr/gdpr_service.dart`)
- [x] requestDataExport: エクスポートリクエスト
- [x] getExportStatus: ステータス取得
- [x] getExportRequests: リクエスト一覧
- [x] requestAccountDeletion: 削除リクエスト
- [x] cancelDeletion: 削除キャンセル
- [x] getDeletionStatus: 削除ステータス

#### GDPR状態管理 (`lib/core/gdpr/gdpr_state.dart`)
- [x] exportRequestsProvider: エクスポートリクエスト一覧
- [x] deletionStatusProvider: 削除ステータス
- [x] gdprServiceProvider: サービスインスタンス
- [x] ExportRequestNotifier: エクスポート状態管理
- [x] DeletionRequestNotifier: 削除状態管理

#### DataExportScreen (`screens/settings/data_export_screen.dart`)
- [x] エクスポートリクエスト画面
  - [x] エクスポート範囲選択
    - [x] 全データ
    - [x] 期間指定
    - [ ] データタイプ選択
  - [x] フォーマット選択
    - [x] JSON
    - [x] CSV
    - [ ] PDF（人間可読形式）
  - [ ] 配信方法
    - [ ] メール送信
    - [x] アプリ内ダウンロード
    - [ ] クラウドストレージ連携
- [x] リクエスト確認
  - [ ] 本人確認（再認証）
  - [x] 処理時間の説明
  - [x] プライバシー注意事項
- [x] リクエスト履歴表示（ExportStatusと統合）
  - [x] ステータス（処理中/完了/失敗）
  - [x] リクエスト日時
  - [x] 有効期限
- [x] ダウンロードリンク
  - [x] 一時URLの表示
  - [x] 有効期限表示（48時間）
  - [x] 再ダウンロードボタン
- [x] ボトムナビゲーション

### データ削除機能

#### AccountDeletionScreen (`screens/settings/account_deletion_screen.dart`)
- [x] 削除オプション選択
  - [x] アカウント完全削除（即時削除）
  - [x] 30日後に削除（復元可能）
  - [ ] 特定データタイプ削除
- [x] 削除影響の説明
  - [x] 削除されるデータリスト
  - [ ] 削除されないデータ（法的保存義務）
  - [x] 復元不可の警告
- [x] 猶予期間の説明
  - [x] 30日間の回復可能期間
  - [x] 即時削除オプション
- [x] 最終確認
  - [ ] パスワード再入力
  - [x] 削除理由（オプション）
  - [x] 確認チェックボックス
- [x] 復元機能（削除予定中）
  - [x] キャンセルボタン
  - [x] 残り日数表示
- [x] ボトムナビゲーション

#### ルーティング更新 (`lib/core/router/app_router.dart`)
- [x] /settings/export: データエクスポート画面
- [x] /settings/deletion: アカウント削除画面
- [x] goToDataExport(): 拡張関数
- [x] goToAccountDeletion(): 拡張関数

#### プロフィール画面更新 (`lib/screens/profile/profile_screen.dart`)
- [x] データエクスポートへのリンク
- [x] アカウント削除へのリンク

#### RecoveryScreen (`screens/auth/recovery_screen.dart`)
- [x] アカウント復元画面
  - [x] メールアドレス入力
  - [x] 復元コード入力
  - [x] 本人確認
- [x] 復元可能期限表示
- [x] データ復元確認

### Cloud Functions 実装

#### データエクスポートAPI

##### リクエスト作成 (`functions/src/api/gdpr/exportData.ts`)
- [x] エンドポイント実装 (`gdpr_requestDataExport`)
- [x] リクエスト検証
  - [x] ユーザー認証（Firebase Auth）
  - [x] レート制限（24時間に1回）
  - [x] 入力バリデーション（format, scope）
- [x] ジョブ作成
  - [x] Firestoreにエクスポートリクエスト保存
  - [x] Cloud Tasksでバックグラウンド処理スケジュール
  - [x] 監査ログ記録
- [x] 処理実行 (`gdpr_processDataExport` - Cloud Tasks トリガー)
  - [x] 全データ収集（Firestore, Storage, BigQuery）
  - [x] ZIPアーカイブ作成
  - [x] Cloud Storageアップロード
  - [x] 完了/失敗通知送信
  - [x] 監査ログ記録

##### データ収集 (`functions/src/services/gdprService.ts`)
- [x] Firestoreデータ取得 (`collectUserData()`)
  - [x] Users コレクション
  - [x] Sessions コレクション
  - [x] Consents コレクション
  - [x] Settings コレクション
  - [x] Subscriptions コレクション
- [x] Storage データ収集 (`collectStorageData()`)
  - [x] プロフィール画像（base64エンコード）
  - [x] メディアファイルメタデータ収集
- [x] BigQueryデータ抽出 (`collectBigQueryData()`)
  - [x] 集計データ（総セッション、総レップ、平均スコア）
  - [x] 種目別内訳
  - [x] 週間進捗（過去12週）
  - [x] 月間トレンド（過去12ヶ月）

##### データ変換 (`functions/src/services/gdprService.ts`)
- [x] フォーマット変換
  - [x] `transformToExportFormat()` - JSON/CSV変換
  - [x] `convertProfileToCSV()` - プロフィールCSV変換
  - [x] `convertSessionsToCSV()` - セッションCSV変換
  - [x] `convertConsentsToCSV()` - 同意CSV変換
  - [x] `convertSettingsToCSV()` - 設定CSV変換
  - [x] `convertSubscriptionsToCSV()` - サブスクリプションCSV変換
  - [x] `convertAnalyticsToCSV()` - 分析データCSV変換
  - [ ] PDF生成（将来実装）
- [x] データサニタイズ
  - [x] ユーザーIDの部分マスキング（README内）
  - [x] CSVエスケープ処理（`escapeCSV()`）

##### ファイル生成 (`functions/src/services/gdprService.ts`)
- [x] アーカイブ作成 (`createExportArchive()`)
  - [x] ZIP圧縮（archiver パッケージ使用、最大圧縮レベル9）
  - [ ] パスワード保護（将来実装）
  - [x] ファイル構造
    ```
    export_YYYYMMDD_HHMMSS/
    ├── README.txt（GDPR説明、データ内容説明）
    ├── profile.json (or .csv)
    ├── sessions.json (or .csv)
    ├── consents.json (or .csv)
    ├── settings.json (or .csv)
    ├── subscriptions.json (or .csv)
    ├── analytics.json (or .csv)
    └── media/
        └── profile_image.jpg (存在する場合)
    ```
- [x] README生成 (`generateReadmeContent()`)
  - [x] エクスポート情報（日時、フォーマット）
  - [x] 含まれるデータの説明
  - [x] GDPR/個人情報保護法に関する説明
  - [x] データ取り扱い注意事項
  - [x] 問い合わせ先
- [x] Cloud Storage アップロード (`uploadExportArchive()`)
  - [x] GDPR専用バケット使用
  - [x] 署名付きURL生成（48時間有効）
  - [x] メタデータ設定（userId, requestId, exportedAt）

##### 通知 (`functions/src/services/gdprService.ts`)
- [x] メール送信
  - [x] 完了通知 (`sendExportCompletionNotification()`)
    - [x] ダウンロードリンク
    - [x] 有効期限（日本時間表示）
    - [x] セキュリティ注意事項
  - [x] 失敗通知 (`sendExportFailureNotification()`)
  - [x] 開発環境ではログ出力のみ
  - [ ] 本番環境メール送信（SendGrid導入後）
- [ ] プッシュ通知（将来実装）
- [ ] アプリ内通知（将来実装）

#### データ削除API

##### 削除リクエスト (`functions/src/api/gdpr/deleteData.ts`)
- [x] エンドポイント実装 (`gdpr_requestAccountDeletion`)
- [x] 削除タイプ処理
  - [x] soft_delete（30日猶予）
  - [x] hard_delete（即時）
  - [x] partial_delete（部分削除）
- [x] スケジュール作成（Cloud Tasks連携）
- [x] キャンセル機能 (`gdpr_cancelDeletion`)
- [x] ステータス取得 (`gdpr_getDeletionStatus`)
  ```typescript
  interface DeletionRequest {
    userId: string;
    requestId: string;
    type: 'soft' | 'hard' | 'partial';
    scope: string[];
    requestedAt: Timestamp;
    scheduledAt: Timestamp;
    status: 'pending' | 'scheduled' | 'processing' | 'completed';
    canRecover: boolean;
    recoverDeadline?: Timestamp;
  }
  ```

##### 削除実行 (`functions/src/api/gdpr/deleteData.ts`, `functions/src/services/gdprService.ts`)
- [x] Firestore削除
  - [x] コレクション毎の削除
  - [x] サブコレクション再帰削除
  - [x] バッチ処理（500件単位）
- [x] Storage削除
  - [x] ユーザーフォルダ削除 (`deleteUserStorage()`)
  - [x] 共有データの確認 (`verifyStorageDeletion()`)
- [x] BigQuery削除
  - [x] DELETE文実行 (`deleteUserFromBigQuery()`)
  - [x] パーティション削除（user_hash ベース）
- [x] Auth削除
  - [x] Firebase Auth ユーザー削除
  - [x] カスタムクレーム削除（Auth削除時に自動削除）

##### 削除検証 (`functions/src/services/gdprService.ts`)
- [x] 削除完了確認
  - [x] 各サービス確認（Firestore, Storage, BigQuery, Auth）
  - [x] ログ記録（詳細な監査ログ）
  - [x] 監査証跡（auditLogsコレクションに記録）
- [x] 残存データチェック
  - [x] 法的保存義務データ（証明書に記載）
  - [x] 匿名化データ（BigQuery検証）
  - [ ] バックアップ処理（将来実装）

##### 復元処理 (`functions/src/api/gdpr/recoverData.ts`)
- [x] データ復元
  - [x] 復元コードリクエスト（gdpr_requestRecoveryCode）
  - [x] 復元コード検証（gdpr_verifyRecoveryCode）
  - [x] ステータス更新（deletionScheduled フラグ解除）
  - [x] アカウント復元実行（gdpr_recoverAccount）
- [x] 通知
  - [x] 復元コードメール送信（開発環境ではログ出力）
  - [ ] 復元完了通知メール（TODO: メール送信サービス導入後）
- [x] セキュリティ
  - [x] 6桁数字コード生成（暗号学的に安全）
  - [x] 有効期限24時間
  - [x] 試行回数5回まで（超過でコード無効化）
  - [x] レート制限（1時間に3回まで）
  - [x] 監査ログ記録

### Firestore設計

#### ExportRequests コレクション
```typescript
interface ExportRequest {
  userId: string;
  requestId: string;
  format: 'json' | 'csv' | 'pdf';
  scope: {
    type: 'all' | 'dateRange' | 'specific';
    startDate?: Timestamp;
    endDate?: Timestamp;
    dataTypes?: string[];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Timestamp;
  completedAt?: Timestamp;
  downloadUrl?: string;
  expiresAt?: Timestamp;
  error?: string;
}
```

#### DeletionRequests コレクション
```typescript
interface DeletionRequest {
  userId: string;
  requestId: string;
  type: 'soft' | 'hard' | 'partial';
  scope: string[];
  reason?: string;
  requestedAt: Timestamp;
  scheduledAt: Timestamp;
  executedAt?: Timestamp;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'cancelled';
  canRecover: boolean;
  recoverDeadline?: Timestamp;
  recoveredAt?: Timestamp;
}
```

### セキュリティ実装

#### 認証・認可
- [x] 本人確認強化
  - [x] 2段階認証要求（`middleware/reauth.ts`: isMfaEnabled, requireMfa）
  - [x] メール確認（`middleware/reauth.ts`: requireEmailVerified, isEmailVerified）
  - [x] セッション再認証（`middleware/reauth.ts`: requireRecentAuth, checkTokenAuthTime, requireReauthForSensitiveOp）
- [x] アクセス制御
  - [x] 本人のみアクセス可（既存実装 + アクセスログで追跡）
  - [x] 管理者権限での代理実行（`middleware/adminAuth.ts`: canActOnBehalfOf, requireActOnBehalfOf, executeAdminAction）
  - [x] 監査ログ（`services/auditLog.ts`既存 + `services/accessLog.ts`新規）

#### データ保護
- [x] 転送時暗号化
  - [x] HTTPS必須（Firebase Functions標準）
  - [ ] エンドツーエンド暗号化（オプション、将来実装）
- [x] 保存時暗号化
  - [x] Cloud Storage暗号化（Google管理キー、デフォルト）
  - [ ] パスワード保護ZIP（オプション、将来実装）
- [x] アクセスログ（`services/accessLog.ts`）
  - [x] ダウンロード記録（logExportDownload）
  - [x] IPアドレス記録（hashIpAddress でハッシュ化）

### コンプライアンス

#### GDPR要件
- [ ] 72時間以内の対応
- [ ] 無料提供
- [ ] 機械可読形式
- [x] 完全削除の保証（verifyCompleteDeletion()で検証）
- [x] 削除証明書発行（generateDeletionCertificate()で実装）
  - [x] 証明書ID生成
  - [x] HMAC-SHA256署名
  - [x] deletionCertificatesコレクションに保存
  - [x] gdpr_getDeletionCertificate APIで取得可能

#### 監査証跡
- [x] 全操作のログ記録（auditLogサービス使用）
- [x] タイムスタンプ（serverTimestamp使用）
- [x] 変更不可能な記録（Firestoreに保存）
- [ ] 定期監査レポート

### テスト実装

#### 単体テスト
- [x] エクスポート処理
- [x] 削除処理
- [x] データ変換

#### 統合テスト
- [x] エンドツーエンドフロー
- [x] 復元処理
- [x] 通知送信

#### コンプライアンステスト
- [x] GDPR要件充足
- [x] データ完全性
- [x] 削除確認

## 受け入れ条件
- [ ] データエクスポートが72時間以内に完了
- [ ] 全データが含まれることを確認
- [ ] 削除後にデータが残存しない
- [ ] 30日以内なら復元可能
- [ ] 監査ログが適切に記録される

## 注意事項
- 法的保存義務のあるデータは削除対象外
- バックアップの扱い（30日後に削除）
- 他ユーザーとの共有データの扱い
- キャッシュ・CDNからの削除

## 参考リンク
- [GDPR Article 17 - Right to erasure](https://gdpr-info.eu/art-17-gdpr/)
- [GDPR Article 20 - Right to data portability](https://gdpr-info.eu/art-20-gdpr/)
- [Firebase Data Deletion](https://firebase.google.com/docs/firestore/manage-data/delete-data)

## テスト実装状況 (2024-11-30更新)

### 作成済みテストファイル
1. **単体テスト**:
   - `functions/tests/gdpr/exportData.test.ts` - エクスポートAPI
   - `functions/tests/gdpr/deleteData.test.ts` - 削除API  
   - `functions/tests/gdpr/gdprService.test.ts` - GDPRサービス

2. **統合テスト**:
   - `functions/tests/integration/gdprFlow.test.ts` - GDPR E2Eフロー

3. **コンプライアンステスト**:
   - `functions/tests/compliance/gdprCompliance.test.ts` - GDPR準拠性

4. **テストヘルパー**:
   - `functions/tests/helpers/gdprTestHelpers.ts` - ヘルパー関数

### 実装済みテストケース

#### 単体テスト - exportData.test.ts
- ✅ 認証済みユーザーのエクスポートリクエスト作成
- ✅ 未認証リクエストの拒否
- ✅ 本人のリクエストステータス取得
- ✅ 他ユーザーリクエストへのアクセス拒否

#### 単体テスト - deleteData.test.ts  
- ✅ ソフト削除リクエスト（30日猶予）
- ✅ ハード削除リクエスト
- ✅ 部分削除リクエスト
- ✅ 削除キャンセル
- ✅ 期限後キャンセル拒否
- ✅ deletionScheduledフラグ管理

#### 単体テスト - gdprService.test.ts
- ✅ 全データタイプ収集
- ✅ スコープ別データ収集
- ✅ データ削除（全スコープ/部分スコープ）
- ✅ 削除検証
- ✅ 削除証明書生成

### 次のステップ
1. TypeScript/Jest設定問題の解決
2. テストケース詳細実装
3. カバレッジ70%以上達成
