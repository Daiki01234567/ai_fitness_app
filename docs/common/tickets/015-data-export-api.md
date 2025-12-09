# 015 データエクスポートAPI

## 概要

ユーザーが自分のデータをダウンロードできるAPIを実装します。

GDPR（ヨーロッパのプライバシー法）では、ユーザーが「自分のデータをもらいたい」と言ったら、提供しないといけません。これを「データポータビリティ権」といいます。

## Phase

Phase 2（API・データパイプライン実装）

## 依存チケット

- common/002: Firestoreセキュリティルール実装
- common/011: セッションAPI

## 要件

### JSONエクスポートAPI

1. **全データエクスポート**: ユーザーの全データをJSON形式でエクスポート
2. **対象データ**:
   - プロフィール情報
   - トレーニングセッション履歴
   - 設定情報
   - 同意履歴

### ダウンロードリンク生成

1. **一時ストレージにアップロード**: Cloud Storageに一時保存
2. **署名付きURL発行**: 24時間有効なダウンロードリンクを生成
3. **自動削除**: 24時間後にファイルを自動削除

### PDF生成API（将来対応）

1. **サマリーレポート**: トレーニング履歴のPDFレポート生成
2. **見やすいフォーマット**: グラフや表を含む

## 受け入れ条件

- [ ] JSONエクスポートAPIが動作する
- [ ] エクスポートに全データ（プロフィール、セッション、設定）が含まれる
- [ ] 署名付きURLが発行される
- [ ] URLは24時間で失効する
- [ ] ファイルが24時間後に自動削除される
- [ ] レート制限（3回/月）が適用される
- [ ] 認証されていないリクエストは401エラーになる

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - セクション7.1（gdpr_requestDataExport）
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - セクション7（データ主体の権利）

## 技術詳細

### APIエンドポイント

| 関数名 | メソッド | 説明 | レート制限 |
|--------|---------|------|-----------|
| `gdpr_requestDataExport` | POST | データエクスポートリクエスト | 3回/月 |
| `gdpr_getExportStatus` | GET | エクスポート状況確認 | 10回/日 |

### リクエスト/レスポンス

```typescript
// リクエスト
interface DataExportRequest {
  format: 'json';  // 将来は 'pdf' も対応予定
  includeSessionData: boolean;  // トレーニングデータを含めるか
}

// レスポンス
interface DataExportResponse {
  success: true;
  data: {
    exportId: string;           // エクスポートID
    downloadUrl: string;        // ダウンロードURL（署名付き）
    expiresAt: string;          // 有効期限（24時間後）
    fileSize: number;           // ファイルサイズ（バイト）
  };
  message: string;
}
```

### 実装イメージ

```typescript
import { Storage } from '@google-cloud/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const storage = new Storage();
const bucket = storage.bucket('user-exports');

export const gdpr_requestDataExport = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  // レート制限チェック（3回/月）
  const exportCount = await getMonthlyExportCount(uid);
  if (exportCount >= 3) {
    throw new HttpsError(
      'resource-exhausted',
      '今月のエクスポート上限（3回）に達しました'
    );
  }

  // Firestoreから全データを収集
  const userData = await collectAllUserData(uid);

  // JSONファイルを作成
  const jsonContent = JSON.stringify(userData, null, 2);

  // Cloud Storageにアップロード
  const fileName = `exports/${uid}/${Date.now()}.json`;
  const file = bucket.file(fileName);
  await file.save(jsonContent, {
    contentType: 'application/json',
  });

  // 24時間有効な署名付きURLを生成
  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000,  // 24時間後
  });

  // エクスポート記録を保存
  const exportId = await saveExportRecord(uid, fileName);

  return {
    success: true,
    data: {
      exportId,
      downloadUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fileSize: Buffer.byteLength(jsonContent),
    },
    message: 'データエクスポートが完了しました。24時間以内にダウンロードしてください。',
  };
});

/**
 * ユーザーの全データを収集
 */
async function collectAllUserData(uid: string) {
  const firestore = admin.firestore();

  // プロフィール
  const userDoc = await firestore.collection('users').doc(uid).get();

  // セッション履歴
  const sessionsSnapshot = await firestore
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .orderBy('createdAt', 'desc')
    .get();

  // 設定
  const settingsDoc = await firestore.collection('userSettings').doc(uid).get();

  // 同意履歴
  const consentsSnapshot = await firestore
    .collection('consents')
    .where('userId', '==', uid)
    .orderBy('timestamp', 'desc')
    .get();

  return {
    exportedAt: new Date().toISOString(),
    profile: userDoc.data(),
    sessions: sessionsSnapshot.docs.map(doc => doc.data()),
    settings: settingsDoc.data(),
    consentHistory: consentsSnapshot.docs.map(doc => doc.data()),
  };
}
```

### 自動削除の設定

Cloud Storageのライフサイクルルールで24時間後に自動削除:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": {
          "age": 1,
          "matchesPrefix": ["exports/"]
        }
      }
    ]
  }
}
```

### エクスポートされるデータ例

```json
{
  "exportedAt": "2025-12-10T12:00:00Z",
  "profile": {
    "userId": "abc123",
    "email": "user@example.com",
    "displayName": "山田太郎",
    "profile": {
      "height": 170,
      "weight": 65,
      "fitnessLevel": "intermediate"
    }
  },
  "sessions": [
    {
      "sessionId": "session_001",
      "exerciseType": "squat",
      "repCount": 15,
      "overallScore": 85,
      "createdAt": "2025-12-09T10:00:00Z"
    }
  ],
  "settings": {
    "notificationEnabled": true,
    "audioFeedbackEnabled": true
  },
  "consentHistory": [
    {
      "consentType": "terms_of_service",
      "version": "v3.2",
      "accepted": true,
      "timestamp": "2025-12-01T09:00:00Z"
    }
  ]
}
```

## 関連する機能要件・非機能要件

| ID | 内容 |
|----|------|
| FR-035 | データポータビリティ権（GDPR第20条） |
| NFR-029 | GDPR準拠 |

## 見積もり

4日

## 進捗

- [ ] 未着手
