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

- [ ] ユーザーID仮名化関数の実装（SHA-256ハッシュ）
- [ ] ソルト値の管理実装（Secrets Manager使用）
- [ ] PIIフィールドの除外実装（メール、氏名、写真URL）
- [ ] 骨格座標データの仮名化実装
- [ ] デバイス情報の一般化実装（詳細すぎるモデル名の丸め）
- [ ] IPアドレスの除外実装
- [ ] 仮名化処理のユニットテスト実装（カバレッジ90%以上）
- [ ] 逆引き不可能性のテスト実装
- [ ] パフォーマンステスト（1000件の仮名化処理が10秒以内）
- [ ] ドキュメント作成（仮名化ポリシー）

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

- [ ] 未着手

## 完了日

未定

## 備考

- ソルトのローテーション時は、古いソルトで生成されたハッシュとの互換性を保つためマッピングテーブルを用意
- 仮名化処理のパフォーマンスが問題になる場合は、キャッシュの導入を検討
- GDPR監査時に仮名化ポリシーを提示できるよう、ドキュメントを整備

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
