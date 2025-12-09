# 013 データ同期関数

## 概要

Firestore（アプリのデータベース）に保存されたトレーニングデータを、BigQuery（分析用データベース）に自動で同期する関数を実装します。

この機能があることで、アプリで記録したトレーニングデータを、後から大規模に分析できるようになります。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/012: BigQueryパイプライン構築

## 要件

### Firestore→BigQuery同期関数

1. **リアルタイム同期**: セッション完了時に即座にBigQueryへ送信
2. **差分同期**: 変更があったデータのみ送信（全件送信しない）
3. **仮名化処理**: ユーザーIDをSHA-256でハッシュ化

### スケジュール実行設定

1. **1時間ごとの集計バッチ**: user_aggregatesテーブルを更新
2. **日次集計バッチ**: device_performanceテーブルを更新

### 差分同期ロジック

1. Firestoreのドキュメント更新をトリガーにして実行
2. 前回同期日時を記録し、それ以降のデータのみ処理
3. 失敗したデータは再試行キュー（DLQ）に入れる

## 受け入れ条件

- [ ] セッション完了時にBigQueryへデータが同期される
- [ ] ユーザーIDがSHA-256でハッシュ化されている
- [ ] メールアドレスは送信されていない
- [ ] 1時間ごとにuser_aggregatesが更新される
- [ ] 日次でdevice_performanceが更新される
- [ ] 同期失敗時にログが記録される
- [ ] 同期成功率99.9%以上

## 参照ドキュメント

- `docs/common/specs/05_BigQuery設計書_v1_0.md` - セクション6（データ同期フロー）
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - セクション4（仮名化処理）

## 技術詳細

### 同期タイミング

| データ種類 | 同期タイミング | 方法 |
|-----------|-------------|------|
| セッションデータ | セッション完了時 | Firestore Trigger → Cloud Functions → BigQuery |
| フレームデータ | セッション完了時（バッチ） | Cloud Functions → BigQuery Streaming Insert |
| 集計データ | 1時間ごと | Cloud Scheduler → Cloud Functions → BigQuery |
| デバイスパフォーマンス | 日次 | Cloud Scheduler → Cloud Functions → BigQuery |

### 仮名化処理

```typescript
import crypto from 'crypto';

/**
 * ユーザーIDを仮名化する
 *
 * 仮名化とは：元のユーザーIDを特定できない形に変換すること
 * SHA-256というアルゴリズムを使って、一方向のハッシュ値に変換します
 */
function pseudonymizeUserId(userId: string): string {
  const salt = process.env.PSEUDONYMIZATION_SALT;  // 環境変数で管理
  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}

// 例：
// userId = "abc123" → user_id_hash = "a1b2c3d4e5f6..."（64文字の16進数）
```

### Firestore Trigger の実装イメージ

```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

export const session_onComplete = onDocumentWritten(
  'users/{userId}/sessions/{sessionId}',
  async (event) => {
    const sessionData = event.data?.after.data();

    // セッションが完了した場合のみ同期
    if (sessionData?.status === 'completed') {
      try {
        await syncSessionToBigQuery(event.params.userId, sessionData);
        console.log('BigQuery sync successful');
      } catch (error) {
        console.error('BigQuery sync failed:', error);
        // 失敗時はリトライキューに登録（チケット014で実装）
        await enqueueRetryTask({
          userId: event.params.userId,
          sessionId: event.params.sessionId,
          tableName: 'sessions',
          retryCount: 0
        });
      }
    }
  }
);
```

### スケジュール関数の例

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * 1時間ごとにユーザー集計を更新
 */
export const updateUserAggregates = onSchedule(
  {
    schedule: 'every 1 hours',
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo'
  },
  async (event) => {
    // 直近1時間のセッションデータを集計してBigQueryに保存
    await aggregateAndSync();
  }
);
```

### なぜ仮名化が必要？

GDPR（ヨーロッパのプライバシー法）に準拠するため、分析用データには個人を特定できる情報を入れてはいけません。

- **送信するもの**: ハッシュ化されたユーザーID、トレーニングデータ、デバイス情報
- **送信しないもの**: メールアドレス、名前、生年月日などの個人情報

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| NFR-022 | データ分析基盤 |
| NFR-029 | GDPR準拠（仮名化） |

## 見積もり

4日

## 進捗

- [ ] 未着手
