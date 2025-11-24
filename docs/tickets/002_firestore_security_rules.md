# Ticket #002: Firestore セキュリティルール実装

**Phase**: Phase 1 (インフラ構築)
**期間**: Week 1-2
**優先度**: 最高
**関連仕様書**:
- `docs/specs/02_Firestoreデータベース設計書_v3_3.md`
- `docs/specs/07_セキュリティポリシー_v1_0.md`

## 概要
GDPR準拠とフィールドレベルアクセス制御を実装したFirestoreセキュリティルールを構築する。

## Todo リスト

### 基本ルール設定
- [x] `firebase/firestore.rules` ファイル作成
- [x] デフォルト全拒否設定
- [x] 認証チェックヘルパー関数作成
  - [x] `isAuthenticated()` 関数
  - [x] `isOwner(userId)` 関数
  - [x] `hasValidData()` 関数

### Users コレクションルール
- [x] 自分のドキュメントのみ読み取り可能
- [x] 作成時のUID検証
- [x] フィールドレベル更新制限
  - [x] `tosAccepted` を読み取り専用に
  - [x] `ppAccepted` を読み取り専用に
  - [x] `deletionScheduled` を読み取り専用に
- [x] 削除操作を禁止（Cloud Functions のみ）

### Sessions コレクションルール
- [x] 所有者のみ読み取り可能
- [x] データバリデーション実装
  - [x] `exerciseType` の値チェック
  - [x] `poseData` のサイズ制限（最大10000フレーム）
  - [x] 必須フィールドチェック
- [x] 更新・削除を禁止（不変データ）

### Consents コレクションルール
- [x] 読み取りのみ許可
- [x] 作成は Cloud Functions のみ
- [x] 不変性の保証

### DataDeletionRequests コレクションルール
- [x] 作成時の検証
- [x] 削除予定ユーザーの書き込み制限
- [x] 30日猶予期間の実装

### カスタムクレーム対応
- [x] `admin` クレームチェック
- [x] `forceLogout` クレームチェック
- [x] 削除予定ユーザーのアクセス制限

### テスト実装
- [x] `@firebase/rules-unit-testing` 導入
- [x] Users コレクションのテスト
  - [x] 読み取りテスト
  - [x] 作成テスト
  - [x] 更新テスト
  - [x] 削除テスト
- [x] Sessions コレクションのテスト
- [x] 削除猶予期間のテスト
- [x] カスタムクレームのテスト

### ドキュメント
- [x] ルールの設計ドキュメント作成
- [x] テスト仕様書作成
- [x] 運用手順書作成

## 受け入れ条件
- [ ] 全てのセキュリティテストがパス（テスト実行環境が必要）
- [ ] エミュレータでの動作確認完了（エミュレータ起動が必要）
- [x] フィールドレベルアクセス制御が機能（実装完了）
- [x] 削除猶予期間が正しく動作（実装完了）
- [x] ドキュメントが完成

## 注意事項
- GDPR準拠を最優先
- パフォーマンスを考慮したルール設計
- 将来の拡張性を確保

## 参考リンク
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)
- [セキュリティルールのテスト](https://firebase.google.com/docs/firestore/security/test-rules-emulator)