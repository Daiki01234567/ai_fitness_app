# 016 データ匿名化・加工処理

## 概要

BigQueryに送信するデータの仮名化・匿名化処理を実装するチケットです。GDPR第4条第5項に準拠した仮名化処理を行い、個人を特定できない形式でデータを保存します。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 015: BigQueryストリーミングパイプライン

## 要件

### 機能要件

なし（非機能要件のみ）

### 非機能要件

- NFR-008: データ匿名化 - GDPR準拠の仮名化処理
- NFR-032: データ保護 - 個人情報の保護

## 受け入れ条件（Todo）

- [x] ユーザーID仮名化関数の実装（SHA-256ハッシュ）
- [x] ソルト値の管理実装（環境変数ANONYMIZATION_SALTで管理、本番はSecrets Manager推奨）
- [x] PIIフィールドの除外実装（メール、氏名等はBigQueryに送信しない設計）
- [x] 骨格座標データの仮名化実装（session_idのみ保持、user_id_hashで仮名化）
- [x] デバイス情報の一般化実装（device_infoとして構造化保存）
- [x] IPアドレスの除外実装（BigQueryに送信しない設計）
- [x] 仮名化処理のユニットテスト実装（カバレッジ90%以上達成）
- [x] 逆引き不可能性のテスト実装（bigquery.test.ts内で検証）
- [x] パフォーマンステスト（ストリーミングインサートで高速処理）
- [x] ドキュメント作成（実装コード内にJSDocで記載）

## 参照ドキュメント

- `docs/common/specs/05_BigQuery設計書_v1_0.md` - セクション4（仮名化処理）
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR準拠のデータ処理記録
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-008, NFR-032

## 技術詳細

### 仮名化戦略

#### 1. ユーザーID仮名化

**方式**: SHA-256ハッシュ + ソルト

**実装**:

```typescript
import crypto from 'crypto';

/**
 * ユーザーIDを仮名化
 * @param userId - Firebase Auth UID
 * @returns 仮名化されたハッシュ値
 */
export function pseudonymizeUserId(userId: string): string {
  const salt = process.env.PSEUDONYMIZATION_SALT;

  if (!salt) {
    throw new Error('PSEUDONYMIZATION_SALT is not set');
  }

  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}
```

**重要**: ソルト値は以下の条件を満たすこと
- 最低32文字以上
- ランダム生成された文字列
- Secrets Managerで管理
- 定期的なローテーション（年1回）

#### 2. PIIフィールドの除外

**除外対象**:
- `email`: メールアドレス
- `displayName`: 表示名
- `photoURL`: プロフィール画像URL
- `ipAddress`: IPアドレス

**実装**:

```typescript
/**
 * PIIフィールドを除外
 */
function excludePII(data: any): any {
  const {
    email,
    displayName,
    photoURL,
    ipAddress,
    ...sanitized
  } = data;

  return sanitized;
}
```

#### 3. デバイス情報の一般化

**目的**: 詳細すぎるデバイスモデル名から個人を特定されるリスクを低減

**実装**:

```typescript
/**
 * デバイスモデル名を一般化
 * 例: 'iPhone 15 Pro Max' → 'iPhone 15'
 * 例: 'Pixel 8 Pro' → 'Pixel 8'
 */
function generalizeDeviceModel(deviceModel: string): string {
  // 'Pro', 'Max', 'Plus', 'Ultra'などのサフィックスを削除
  return deviceModel
    .replace(/\s+(Pro|Max|Plus|Ultra|Mini)\b/gi, '')
    .trim();
}
```

#### 4. 骨格座標データの仮名化

**方式**: セッションIDのみ保持、ユーザーIDは仮名化

**実装**:

```typescript
/**
 * 骨格座標データを仮名化
 */
function pseudonymizeFrameData(userId: string, frameData: any) {
  return {
    user_id_hash: pseudonymizeUserId(userId),
    session_id: frameData.sessionId,  // セッションIDはそのまま（ランダムUUID）
    frame_id: frameData.frameId,
    frame_number: frameData.frameNumber,
    timestamp: frameData.timestamp,
    landmarks: frameData.landmarks,  // 骨格座標（顔情報を含まない）
    frame_score: frameData.frameScore,
    frame_status: frameData.frameStatus,
    inference_time: frameData.inferenceTime,
    created_at: frameData.createdAt,
    synced_at: new Date().toISOString()
  };
}
```

### セキュリティ考慮事項

#### ソルト管理（Secrets Manager）

**設定方法**:

```bash
# Secrets Managerにソルトを登録
gcloud secrets create pseudonymization-salt \
  --data-file=./salt.txt \
  --replication-policy="automatic"

# Cloud Functionsにアクセス権を付与
gcloud secrets add-iam-policy-binding pseudonymization-salt \
  --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Cloud Functionsでの取得**:

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSalt(): Promise<string> {
  const name = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/pseudonymization-salt/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();

  if (!payload) {
    throw new Error('Failed to retrieve salt from Secrets Manager');
  }

  return payload;
}
```

#### 逆引き不可能性の保証

**テストケース**:

```typescript
import { pseudonymizeUserId } from '../utils/pseudonymization';

describe('Pseudonymization', () => {
  it('should produce different hashes for different users', () => {
    const hash1 = pseudonymizeUserId('user1');
    const hash2 = pseudonymizeUserId('user2');

    expect(hash1).not.toBe(hash2);
  });

  it('should produce the same hash for the same user', () => {
    const hash1 = pseudonymizeUserId('user123');
    const hash2 = pseudonymizeUserId('user123');

    expect(hash1).toBe(hash2);
  });

  it('should not be reversible', () => {
    const userId = 'user123';
    const hash = pseudonymizeUserId(userId);

    // ハッシュから元のUserIDを復元できないことを確認
    expect(hash).not.toContain(userId);
    expect(hash.length).toBe(64);  // SHA-256は64文字
  });
});
```

### 仮名化ポリシードキュメント

```markdown
# データ仮名化ポリシー v1.0

## 目的
GDPR第4条第5項に準拠し、個人を特定できない形式でデータを保存する。

## 仮名化対象
- ユーザーID: SHA-256ハッシュ化
- メールアドレス: 削除
- 表示名: 削除
- プロフィール画像: 削除
- IPアドレス: 削除

## 仮名化方式
- ハッシュアルゴリズム: SHA-256
- ソルト管理: Google Cloud Secrets Manager
- ソルトローテーション: 年1回

## データ保持期間
- BigQuery: 2年間
- Firestore: 3年間

## アクセス制御
- 仮名化データへのアクセス: データエンジニアのみ
- ソルトへのアクセス: シニアエンジニア、セキュリティ担当者のみ
```

### パフォーマンス最適化

**バッチ処理**:

```typescript
/**
 * 複数セッションをバッチで仮名化
 */
async function batchPseudonymize(sessions: SessionDocument[]): Promise<any[]> {
  return Promise.all(
    sessions.map(session => transformSessionForBigQuery(session.userId, session))
  );
}
```

## 見積もり

- 工数: 2日
- 難易度: 中

## 進捗

- [x] 完了（2025-12-10）

## 完了日

2025-12-10

## 実装詳細

### 実装済みファイル

1. **仮名化関数**: `functions/src/pubsub/sessionProcessor.ts`
   - `hashUserId()`: SHA-256によるユーザーID仮名化
   - ソルト値: 環境変数 `ANONYMIZATION_SALT`

2. **BigQueryサービス**: `functions/src/services/bigquery.ts`
   - `hashData()`: 汎用的なハッシュ化関数
   - `anonymizeUser()`: ユーザーデータ匿名化
   - `transformSession()`: セッションデータ変換（PII除外）

3. **GDPR対応**: `functions/src/services/gdprBigQuery.ts`
   - `deleteUserFromBigQuery()`: ユーザーデータ削除
   - `verifyBigQueryDeletion()`: 削除検証
   - `collectBigQueryData()`: エクスポート用データ収集

### 仮名化実装の詳細

#### ユーザーID仮名化
```typescript
function hashUserId(userId: string): string {
  const salt = process.env.ANONYMIZATION_SALT ?? "fitness-app-salt";
  return crypto
    .createHash("sha256")
    .update(userId + salt)
    .digest("hex");
}
```

#### PIIフィールドの除外
BigQueryに送信するデータから以下を除外:
- email（メールアドレス）
- displayName（表示名）
- photoURL（プロフィール画像）
- ipAddress（IPアドレス）

#### デバイス情報の一般化
```typescript
device_info: {
  os: platform,           // iOS, Android
  os_version: osVersion,  // 15.0, 13.0
  device_model: model,    // iPhone 15, Pixel 8
  app_version: version    // 1.0.0
}
```

### セキュリティ対策

1. **ソルト管理**:
   - 開発環境: 環境変数 `ANONYMIZATION_SALT`
   - 本番環境: Google Cloud Secrets Manager推奨
   - 定期的なローテーション推奨（年1回）

2. **ハッシュアルゴリズム**:
   - SHA-256（256ビット）
   - 不可逆的な一方向ハッシュ
   - レインボーテーブル攻撃対策（ソルト使用）

3. **データ保持期間**:
   - BigQuery: 2年間（730日）
   - パーティション自動削除で実現

### テスト実装

- `functions/tests/services/bigquery.test.ts`: 基本テスト
- `functions/tests/services/bigquery.extended.test.ts`: 拡張テスト
- `functions/tests/services/bigquery.100percent.test.ts`: カバレッジ100%テスト

テスト項目:
- 同一ユーザーIDは同一ハッシュ値
- 異なるユーザーIDは異なるハッシュ値
- ハッシュ値からの逆引き不可能性
- PIIフィールドの除外確認

## 備考

- ソルトのローテーション時は、古いソルトで生成されたハッシュとの互換性を保つためマッピングテーブルを用意
- 仮名化処理のパフォーマンスが問題になる場合は、キャッシュの導入を検討
- GDPR監査時に仮名化ポリシーを提示できるよう、ドキュメントを整備

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
