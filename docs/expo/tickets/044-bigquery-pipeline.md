# 044 BigQueryパイプライン構築

## 概要
トレーニングデータをBigQueryに同期するパイプラインを構築します。

## Phase
Phase 2（機能実装）

## 依存チケット
- 001: Firebaseプロジェクトセットアップ
- 003: Firestoreセキュリティルール

## 要件
- FirestoreからBigQueryへのデータ同期
- ストリーミングインサート
- データの匿名化処理
- DLQ（失敗時の再試行キュー）
- 99.9%の同期成功率

## 受け入れ条件
- [ ] トレーニングデータがBigQueryに同期される
- [ ] ユーザーIDが匿名化されている
- [ ] 同期失敗時にリトライが実行される
- [ ] DLQで失敗データが保持される
- [ ] 同期成功率99.9%以上を達成

## 参照ドキュメント
- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - データベース設計
- `docs/expo/specs/02_要件定義書_Expo版_v1_Part2.md` - NFR-036

## 技術詳細
- Cloud Functions Trigger
- BigQuery Streaming Insert
- 指数バックオフによるリトライ

## 見積もり
5日

## 進捗
- [ ] 未着手
