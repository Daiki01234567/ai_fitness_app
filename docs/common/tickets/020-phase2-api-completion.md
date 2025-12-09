# 020 Phase 2 API完了確認

## 概要

Phase 2で実装した全てのAPIとパイプラインが正しく動作することを確認し、ドキュメントを更新します。

このチケットは「まとめ」のチケットです。Phase 2で作った機能が全部ちゃんと動くかテストして、ドキュメント（説明書）を最新の状態に更新します。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/011: セッションAPI
- common/012: BigQueryパイプライン構築
- common/013: データ同期関数
- common/014: リトライ処理・DLQ実装
- common/015: データエクスポートAPI
- common/016: アカウント削除API
- common/017: 削除スケジューリング関数
- common/018: プッシュ通知基盤
- common/019: 通知送信関数

## 要件

### 全APIエンドポイントテスト

1. **単体テスト**: 各APIが単独で正しく動作する
2. **統合テスト**: APIが連携して正しく動作する
3. **負荷テスト**: 多数のリクエストに耐えられる

### BigQuery動作確認

1. **データ同期確認**: FirestoreからBigQueryにデータが同期される
2. **仮名化確認**: ユーザーIDがハッシュ化されている
3. **クエリ動作確認**: 分析クエリが正しく実行できる

### 通知機能テスト

1. **リマインダー通知**: スケジュール通知が送られる
2. **成果通知**: トリガー通知が送られる
3. **トピック通知**: トピック購読者に通知が送られる

### ドキュメント更新

1. **API設計書**: 実装に合わせて更新
2. **BigQuery設計書**: 実装に合わせて更新
3. **チケット完了**: 全チケットのステータスを更新

## 受け入れ条件

### APIテスト

- [ ] training_createSession が正常に動作する
- [ ] training_completeSession が正常に動作する
- [ ] training_getSession が正常に動作する
- [ ] training_getSessions がページネーション付きで動作する
- [ ] training_getStats が統計データを返す
- [ ] gdpr_requestDataExport がJSON出力する
- [ ] gdpr_requestAccountDeletion が削除をスケジュールする
- [ ] gdpr_cancelAccountDeletion がキャンセルできる
- [ ] notification_registerToken がトークンを保存する
- [ ] notification_subscribeToTopic が購読を登録する
- [ ] notification_send が通知を送信する

### BigQueryテスト

- [ ] sessionsテーブルにデータが同期される
- [ ] framesテーブルにデータが同期される
- [ ] user_aggregatesテーブルが更新される
- [ ] device_performanceテーブルが更新される
- [ ] user_id_hashが正しくハッシュ化されている
- [ ] メールアドレスがBigQueryに含まれていない
- [ ] 種目別平均スコアのクエリが動作する
- [ ] デバイス別パフォーマンスのクエリが動作する

### 通知テスト

- [ ] 指定時刻にリマインダーが届く
- [ ] 週間目標達成時に通知が届く
- [ ] 連続記録達成時に通知が届く
- [ ] 通知設定OFFのユーザーには届かない
- [ ] 通知履歴が記録される

### GDPR機能テスト

- [ ] データエクスポートに全データが含まれる
- [ ] ダウンロードURLが24時間で失効する
- [ ] 削除リクエスト後30日で完全削除される
- [ ] 削除予定ユーザーが書き込みできない
- [ ] 削除キャンセルで通常状態に戻る
- [ ] BigQueryからも削除される
- [ ] Stripeからも削除される（課金ユーザー）

### 非機能テスト

- [ ] API応答時間が95パーセンタイル200ms以内
- [ ] 同時100リクエストに耐えられる
- [ ] レート制限が正しく動作する
- [ ] エラーハンドリングが正しい

### ドキュメント

- [ ] API設計書が最新の実装と一致する
- [ ] BigQuery設計書が最新の実装と一致する
- [ ] チケット011-019のステータスが「完了」になっている
- [ ] READMEにPhase 2の機能が記載されている

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md`
- `docs/common/specs/05_BigQuery設計書_v1_0.md`
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md`

## 技術詳細

### テスト実行コマンド

```bash
# Firebase Functions テスト
cd functions
npm run test                # 全テスト実行
npm run test:coverage       # カバレッジ付きテスト

# エミュレータでのE2Eテスト
firebase emulators:start --only functions,firestore,auth

# BigQueryクエリテスト（開発環境）
bq query --use_legacy_sql=false < test_queries/sessions.sql
```

### テストシナリオ例

#### シナリオ1: トレーニング記録フロー

```
1. ユーザーがログイン
2. training_createSession でセッション開始
3. トレーニング実行
4. training_completeSession でセッション完了
5. BigQueryに同期される
6. training_getStats で統計が取得できる
```

#### シナリオ2: GDPR削除フロー

```
1. ユーザーが gdpr_requestAccountDeletion を呼ぶ
2. deletionScheduled = true になる
3. 新しいセッションを作成しようとするとエラー
4. 30日後に gdpr_executeScheduledDeletions が実行される
5. 全データが削除される
6. Firebase Auth からも削除される
```

#### シナリオ3: 通知フロー

```
1. アプリ起動時に notification_registerToken でトークン登録
2. notification_subscribeToTopic で workout_reminders を購読
3. 指定時刻に notification_sendWorkoutReminders が実行される
4. 端末に通知が届く
5. 通知履歴が記録される
```

### テストカバレッジ目標

| カテゴリ | 目標カバレッジ |
|---------|---------------|
| セッションAPI | 80%以上 |
| GDPR API | 90%以上 |
| 通知API | 75%以上 |
| BigQuery同期 | 80%以上 |
| リトライ処理 | 85%以上 |

### チェックリスト

#### コード品質

- [ ] TypeScriptの型エラーがない
- [ ] ESLintの警告がない
- [ ] 全関数にJSDocコメントがある
- [ ] エラーハンドリングが適切

#### セキュリティ

- [ ] 認証チェックが全APIにある
- [ ] 認可チェック（本人確認）がある
- [ ] 入力バリデーションがある
- [ ] レート制限が設定されている
- [ ] ログに機密情報が含まれていない

#### パフォーマンス

- [ ] 不要なFirestore読み取りがない
- [ ] バッチ処理が500件以下
- [ ] 並列処理が適切に使われている
- [ ] コールドスタート対策がされている

## 見積もり

5日

## 進捗

- [ ] 未着手
- [ ] APIテスト完了
- [ ] BigQueryテスト完了
- [ ] 通知テスト完了
- [ ] GDPRテスト完了
- [ ] 非機能テスト完了
- [ ] ドキュメント更新完了
