# Ticket #015: データエクスポート・削除機能実装（GDPR対応）

**Phase**: Phase 2 (機能実装)
**期間**: Week 10
**優先度**: 高
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-025～FR-027)
- `docs/specs/06_データ処理記録_ROPA_v1_0.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

## 概要
GDPR要件に準拠したデータエクスポート（ポータビリティ）と削除機能を実装する。

## Todo リスト

### データエクスポート機能

#### ExportScreen (`screens/settings/export_screen.dart`)
- [ ] エクスポートリクエスト画面
  - [ ] エクスポート範囲選択
    - [ ] 全データ
    - [ ] 期間指定
    - [ ] データタイプ選択
  - [ ] フォーマット選択
    - [ ] JSON
    - [ ] CSV
    - [ ] PDF（人間可読形式）
  - [ ] 配信方法
    - [ ] メール送信
    - [ ] アプリ内ダウンロード
    - [ ] クラウドストレージ連携
- [ ] リクエスト確認
  - [ ] 本人確認（再認証）
  - [ ] 処理時間の説明
  - [ ] プライバシー注意事項

#### ExportStatusScreen (`screens/settings/export_status_screen.dart`)
- [ ] リクエスト履歴表示
  - [ ] ステータス（処理中/完了/失敗）
  - [ ] リクエスト日時
  - [ ] 有効期限
- [ ] ダウンロードリンク
  - [ ] 一時URLの表示
  - [ ] 有効期限表示（48時間）
  - [ ] 再ダウンロードボタン
- [ ] キャンセル機能

### データ削除機能

#### AccountDeletionScreen (`screens/settings/account_deletion_screen.dart`)
- [ ] 削除オプション選択
  - [ ] アカウント完全削除
  - [ ] データのみ削除
  - [ ] 特定データタイプ削除
- [ ] 削除影響の説明
  - [ ] 削除されるデータリスト
  - [ ] 削除されないデータ（法的保存義務）
  - [ ] 復元不可の警告
- [ ] 猶予期間の説明
  - [ ] 30日間の回復可能期間
  - [ ] 即時削除オプション
- [ ] 最終確認
  - [ ] パスワード再入力
  - [ ] 削除理由（オプション）
  - [ ] 確認チェックボックス

#### RecoveryScreen (`screens/auth/recovery_screen.dart`)
- [ ] アカウント復元画面
  - [ ] メールアドレス入力
  - [ ] 復元コード入力
  - [ ] 本人確認
- [ ] 復元可能期限表示
- [ ] データ復元確認

### Cloud Functions 実装

#### データエクスポートAPI

##### リクエスト作成 (`api/export/request.ts`)
- [ ] エンドポイント実装
- [ ] リクエスト検証
  - [ ] ユーザー認証
  - [ ] レート制限（24時間に1回）
  - [ ] 同時リクエスト防止
- [ ] ジョブ作成
  ```typescript
  interface ExportRequest {
    userId: string;
    requestId: string;
    format: 'json' | 'csv' | 'pdf';
    scope: 'all' | 'dateRange' | 'specific';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    requestedAt: Timestamp;
    completedAt?: Timestamp;
    downloadUrl?: string;
    expiresAt?: Timestamp;
  }
  ```

##### データ収集 (`functions/export/collect.ts`)
- [ ] Firestoreデータ取得
  - [ ] Users コレクション
  - [ ] Sessions コレクション
  - [ ] TrainingResults コレクション
  - [ ] Consents コレクション
- [ ] Storage データ収集
  - [ ] プロフィール画像
  - [ ] トレーニング動画（該当する場合）
- [ ] BigQueryデータ抽出
  - [ ] 集計データ
  - [ ] 分析結果

##### データ変換 (`functions/export/transform.ts`)
- [ ] フォーマット変換
  ```typescript
  function transformToJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2);
  }

  function transformToCSV(data: ExportData): string {
    // フラット化してCSV変換
  }

  function transformToPDF(data: ExportData): Buffer {
    // PDFレポート生成
  }
  ```
- [ ] データサニタイズ
  - [ ] 内部IDの除外
  - [ ] システム情報の除外
  - [ ] 機密情報のマスキング

##### ファイル生成 (`functions/export/generate.ts`)
- [ ] アーカイブ作成
  - [ ] ZIP圧縮
  - [ ] パスワード保護（オプション）
  - [ ] ファイル構造
    ```
    export_YYYYMMDD_HHMMSS/
    ├── profile.json
    ├── sessions/
    ├── training_results/
    ├── consents/
    └── README.txt
    ```
- [ ] Cloud Storage アップロード
  - [ ] 一時バケット使用
  - [ ] 署名付きURL生成
  - [ ] 自動削除設定（48時間）

##### 通知 (`functions/export/notify.ts`)
- [ ] メール送信
  - [ ] 完了通知
  - [ ] ダウンロードリンク
  - [ ] セキュリティ注意事項
- [ ] プッシュ通知
- [ ] アプリ内通知

#### データ削除API

##### 削除リクエスト (`api/deletion/request.ts`)
- [ ] エンドポイント実装
- [ ] 削除タイプ処理
  - [ ] soft_delete（30日猶予）
  - [ ] hard_delete（即時）
  - [ ] partial_delete（部分削除）
- [ ] スケジュール作成
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

##### 削除実行 (`functions/deletion/execute.ts`)
- [ ] Firestore削除
  - [ ] コレクション毎の削除
  - [ ] サブコレクション再帰削除
  - [ ] バッチ処理（500件単位）
- [ ] Storage削除
  - [ ] ユーザーフォルダ削除
  - [ ] 共有データの確認
- [ ] BigQuery削除
  - [ ] DELETE文実行
  - [ ] パーティション削除
- [ ] Auth削除
  - [ ] Firebase Auth ユーザー削除
  - [ ] カスタムクレーム削除

##### 削除検証 (`functions/deletion/verify.ts`)
- [ ] 削除完了確認
  - [ ] 各サービス確認
  - [ ] ログ記録
  - [ ] 監査証跡
- [ ] 残存データチェック
  - [ ] 法的保存義務データ
  - [ ] 匿名化データ
  - [ ] バックアップ処理

##### 復元処理 (`functions/deletion/recover.ts`)
- [ ] データ復元
  - [ ] バックアップからの復元
  - [ ] ステータス更新
  - [ ] 権限復活
- [ ] 通知
  - [ ] 復元完了通知
  - [ ] ログイン情報再送

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
- [ ] 本人確認強化
  - [ ] 2段階認証要求
  - [ ] メール確認
  - [ ] セッション再認証
- [ ] アクセス制御
  - [ ] 本人のみアクセス可
  - [ ] 管理者権限での代理実行
  - [ ] 監査ログ

#### データ保護
- [ ] 転送時暗号化
  - [ ] HTTPS必須
  - [ ] エンドツーエンド暗号化
- [ ] 保存時暗号化
  - [ ] Cloud Storage暗号化
  - [ ] パスワード保護ZIP
- [ ] アクセスログ
  - [ ] ダウンロード記録
  - [ ] IPアドレス記録

### コンプライアンス

#### GDPR要件
- [ ] 72時間以内の対応
- [ ] 無料提供
- [ ] 機械可読形式
- [ ] 完全削除の保証
- [ ] 削除証明書発行

#### 監査証跡
- [ ] 全操作のログ記録
- [ ] タイムスタンプ
- [ ] 変更不可能な記録
- [ ] 定期監査レポート

### テスト実装

#### 単体テスト
- [ ] エクスポート処理
- [ ] 削除処理
- [ ] データ変換

#### 統合テスト
- [ ] エンドツーエンドフロー
- [ ] 復元処理
- [ ] 通知送信

#### コンプライアンステスト
- [ ] GDPR要件充足
- [ ] データ完全性
- [ ] 削除確認

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