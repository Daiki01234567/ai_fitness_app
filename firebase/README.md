# Firebase Security Rules Tests

Firestore Security Rules のユニットテストです。

## セットアップ

```bash
# 依存関係をインストール
npm install
```

## テストの実行

```bash
# 全テストを実行
npm test

# ウォッチモードでテスト
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

## テストカバレッジ

このテストスイートは以下をカバーします:

### Users Collection
- ✅ 認証要件（未認証/認証済み/削除予定ユーザー）
- ✅ 所有権検証（自分/他人）
- ✅ フィールドレベルアクセス制御（tosAccepted, ppAccepted, deletionScheduled）
- ✅ Immutableフィールド（email, createdAt）
- ✅ バリデーション（身長100-250cm, 体重30-300kg）

### Sessions Subcollection
- ✅ 認証要件
- ✅ 所有権検証
- ✅ 削除予定ユーザーの書き込み制限
- ✅ Immutableフィールド（sessionId, userId, exerciseType）
- ✅ バリデーション（repCount 0-1000, 有効なexerciseType）

### Consents Collection
- ✅ 認証要件
- ✅ 所有権検証
- ✅ Immutability（監査ログとして変更・削除不可）
- ✅ バリデーション（有効なconsentType）

### DataDeletionRequests Collection
- ✅ 認証要件
- ✅ 所有権検証
- ✅ Cloud Functions onlyの更新・削除

### Admin-only Collections
- ✅ BigQuerySyncFailures（管理者のみアクセス可）
- ✅ AuditLogs（管理者のみ読み取り可）

### Catch-all Deny Rule
- ✅ 未定義のコレクションへのアクセス拒否

## テストアーキテクチャ

```
firebase/
├── firestore.rules          # セキュリティルール
├── package.json             # テスト依存関係
├── jest.config.js           # Jest設定
├── tsconfig.json            # TypeScript設定
├── __tests__/
│   ├── setup.ts             # テストセットアップ
│   └── firestore.rules.test.ts  # メインテストスイート
└── README.md                # このファイル
```

## トラブルシューティング

### エラー: `ECONNREFUSED localhost:8080`

Firestore エミュレータが起動していません:

```bash
# プロジェクトルートで実行
firebase emulators:start --only firestore
```

### エラー: `Module not found`

依存関係を再インストール:

```bash
rm -rf node_modules package-lock.json
npm install
```

### テストがタイムアウトする

`jest.config.js` の `testTimeout` を増やします:

```javascript
module.exports = {
  // ...
  testTimeout: 30000, // 30秒
};
```

## CI/CD統合

GitHub Actions で実行する例:

```yaml
- name: Install dependencies
  run: |
    cd firebase
    npm install

- name: Run Firestore Rules tests
  run: |
    cd firebase
    npm test
```

## 関連ドキュメント

- [Firebase Security Rules ドキュメント](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Rules Unit Testing](https://firebase.google.com/docs/rules/unit-tests)
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md`
- `docs/common/tickets/002-firestore-security-rules.md`
