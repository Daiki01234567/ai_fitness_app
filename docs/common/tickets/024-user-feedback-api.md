# 024 ユーザーフィードバックAPI

## 概要

アプリ内からユーザーがフィードバック（感想、バグ報告、改善要望など）を送信できるAPIを実装するチケットです。フィードバックはFirestoreに保存され、管理者が後で確認できるようにします。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestore セキュリティルール実装
- 004: ユーザープロフィール API

## 要件

### 機能要件

- FR-031: お問い合わせフォーム

### 非機能要件

- NFR-002: データ整合性の保証
- NFR-020: 可用性（99.5%以上）

## 受け入れ条件（Todo）

- [x] フィードバック送信APIを実装（`feedback_submitFeedback`）
- [x] フィードバックタイプ（バグ報告、改善要望、その他）のバリデーション
- [x] フィードバック内容の文字数制限（1000文字以内）
- [x] フィードバックをFirestoreに保存（`feedbacks`コレクション）
- [x] ユーザー情報（userId, email）を自動で付与
- [x] フィードバック送信時刻の記録
- [x] レート制限の実装（10回/日）
- [x] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認（オプション）

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-031
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - サポートAPI
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Feedbacksコレクション

## 技術詳細

### データモデル

Feedbacksコレクション:

```typescript
interface Feedback {
  feedbackId: string;
  userId: string;
  email: string;
  type: 'bug_report' | 'feature_request' | 'general_feedback' | 'other';
  subject: string;  // 件名（100文字以内）
  message: string;  // 本文（1000文字以内）
  deviceInfo: {
    platform: 'iOS' | 'Android' | 'Web';
    osVersion: string;
    appVersion: string;
    deviceModel: string | null;
  };
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  adminNotes: string | null;  // 管理者のメモ
}
```

### 実装例: フィードバック送信API

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

interface SubmitFeedbackRequest {
  type: 'bug_report' | 'feature_request' | 'general_feedback' | 'other';
  subject: string;
  message: string;
  deviceInfo: {
    platform: 'iOS' | 'Android' | 'Web';
    osVersion: string;
    appVersion: string;
    deviceModel: string | null;
  };
}

export const feedback_submitFeedback = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email || '';
  const { type, subject, message, deviceInfo } = request.data as SubmitFeedbackRequest;

  // バリデーション
  if (!type || !subject || !message) {
    throw new HttpsError('invalid-argument', '必須項目が不足しています');
  }

  const validTypes = ['bug_report', 'feature_request', 'general_feedback', 'other'];
  if (!validTypes.includes(type)) {
    throw new HttpsError('invalid-argument', 'フィードバックタイプが無効です');
  }

  if (subject.length > 100) {
    throw new HttpsError('invalid-argument', '件名は100文字以内で入力してください');
  }

  if (message.length > 1000) {
    throw new HttpsError('invalid-argument', 'メッセージは1000文字以内で入力してください');
  }

  // レート制限チェック（10回/日）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recentFeedbacks = await admin.firestore()
    .collection('feedbacks')
    .where('userId', '==', uid)
    .where('submittedAt', '>=', admin.firestore.Timestamp.fromDate(today))
    .count()
    .get();

  if (recentFeedbacks.data().count >= 10) {
    throw new HttpsError(
      'resource-exhausted',
      '1日のフィードバック送信上限（10回）に達しました'
    );
  }

  // フィードバックを保存
  const feedbackRef = admin.firestore().collection('feedbacks').doc();
  await feedbackRef.set({
    feedbackId: feedbackRef.id,
    userId: uid,
    email: email,
    type,
    subject,
    message,
    deviceInfo,
    status: 'pending',
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    adminNotes: null
  });

  logger.info('フィードバック送信完了', { feedbackId: feedbackRef.id, userId: uid, type });

  return {
    success: true,
    data: {
      feedbackId: feedbackRef.id
    },
    message: 'フィードバックを送信しました。ご協力ありがとうございます。'
  };
});
```

### Firestoreセキュリティルール

```javascript
match /feedbacks/{feedbackId} {
  // ユーザーは自分のフィードバックのみ読み取り可能
  allow read: if request.auth.uid == resource.data.userId;

  // ユーザーは新規フィードバックの作成のみ可能（更新・削除は不可）
  allow create: if request.auth.uid == request.resource.data.userId;

  // 管理者はすべてのフィードバックを読み書き可能
  allow read, write: if request.auth.token.admin == true;
}
```

### フィードバックタイプの説明

| タイプ | 説明 | 例 |
|--------|------|-----|
| `bug_report` | バグ報告 | 「トレーニング記録が保存されない」 |
| `feature_request` | 機能改善要望 | 「ダークモードを追加してほしい」 |
| `general_feedback` | 一般的な感想 | 「アプリが使いやすくて気に入っています」 |
| `other` | その他 | 「アカウントの変更について質問があります」 |

## テスト観点

- 認証されていないユーザーはフィードバックを送信できないこと
- 必須項目が不足している場合、エラーが返ること
- 件名が100文字を超える場合、エラーが返ること
- メッセージが1000文字を超える場合、エラーが返ること
- 1日10回以上のフィードバック送信を試みると、レート制限エラーが返ること
- フィードバックが正しくFirestoreに保存されること

## 見積もり

- 工数: 1.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025-12-10

## 実装ファイル

- `functions/src/api/feedback/submit.ts` - フィードバック送信API
- `functions/src/api/feedback/list.ts` - フィードバック一覧取得API
- `functions/src/api/feedback/index.ts` - エクスポート

## 備考

- この機能はExpo版・Flutter版の両方で使用されます
- フィードバックの確認と対応は、Phase 4の管理者機能で実装します
- メール通知機能は、チケット022（プッシュ通知トリガー）の拡張として将来追加する可能性があります

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
