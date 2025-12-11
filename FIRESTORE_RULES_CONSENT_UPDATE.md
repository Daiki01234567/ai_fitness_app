# Firestoreセキュリティルール修正：初回同意更新対応

## 修正日時
2025-12-11

## 問題
Expo版アプリの認証フローにおいて、新規ユーザーが利用規約同意画面で「同意して続ける」を押すと`PERMISSION_DENIED`エラーが発生していました。

## 原因
`firebase/firestore.rules`の`validateUserUpdate`関数（L460-480）で、同意フィールド（`tosAccepted`、`ppAccepted`等）が完全に読み取り専用として実装されていたため、クライアント側からの初回同意更新ができませんでした。

## 仕様書要件
`docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md`より：
1. **登録完了後**: `tosAccepted = false`, `ppAccepted = false`で初期データ作成
2. **利用規約同意画面**: `tosAccepted = true`, `ppAccepted = true`に更新

## 修正内容

### 1. `firebase/firestore.rules`の修正

#### A. `validateUserUpdate`関数の修正（L460-475）
```javascript
function validateUserUpdate(newData, oldData) {
  return newData.email == oldData.email
         && newData.createdAt == oldData.createdAt
         // 変更前: 同意フィールドは完全に読み取り専用
         // 変更後: validateConsentUpdate関数で初回同意を許可
         && validateConsentUpdate(newData, oldData)
         && newData.get('deletionScheduled', false) == oldData.get('deletionScheduled', false)
         // ... 以下省略
}
```

#### B. `validateConsentUpdate`関数の追加（L477-513）
新しいヘルパー関数を追加し、以下のロジックを実装：

**許可される更新**:
- `tosAccepted`: `false → true`のみ（初回同意）
- `ppAccepted`: `false → true`のみ（初回同意）
- `tosAcceptedAt`、`ppAcceptedAt`: 初回同意時に設定可能
- `tosVersion`、`ppVersion`: 初回同意時に設定可能

**拒否される更新**:
- `true → false`（同意撤回）：Cloud Functionsのみが実行可能
- タイムスタンプ・バージョンの後続変更
- 同意済み状態でのメタデータ変更

```javascript
function validateConsentUpdate(newData, oldData) {
  // Case 1: No change (both remain same)
  let tosUnchanged = newData.tosAccepted == oldData.tosAccepted;
  let ppUnchanged = newData.ppAccepted == oldData.ppAccepted;

  // Case 2: Initial consent (false → true only)
  let tosInitialConsent = oldData.tosAccepted == false && newData.tosAccepted == true;
  let ppInitialConsent = oldData.ppAccepted == false && newData.ppAccepted == true;

  // tosAccepted: must be unchanged OR initial consent
  let tosValid = tosUnchanged || tosInitialConsent;
  // ppAccepted: must be unchanged OR initial consent
  let ppValid = ppUnchanged || ppInitialConsent;

  // Timestamp fields: can only be set during initial consent
  let tosTimestampValid = tosUnchanged
    ? (newData.get('tosAcceptedAt', null) == oldData.get('tosAcceptedAt', null))
    : (tosInitialConsent && newData.get('tosAcceptedAt', null) != null);
  let ppTimestampValid = ppUnchanged
    ? (newData.get('ppAcceptedAt', null) == oldData.get('ppAcceptedAt', null))
    : (ppInitialConsent && newData.get('ppAcceptedAt', null) != null);

  // Version fields: can only be set during initial consent
  let tosVersionValid = tosUnchanged
    ? (newData.get('tosVersion', null) == oldData.get('tosVersion', null))
    : (tosInitialConsent && newData.get('tosVersion', null) != null);
  let ppVersionValid = ppUnchanged
    ? (newData.get('ppVersion', null) == oldData.get('ppVersion', null))
    : (ppInitialConsent && newData.get('ppVersion', null) != null);

  return tosValid && ppValid && tosTimestampValid && ppTimestampValid && tosVersionValid && ppVersionValid;
}
```

### 2. テストの追加（`firebase/__tests__/firestore.rules.test.ts`）

#### A. 既存テストの更新（L270-288）
テスト名を明確化：
- 変更前: "同意フィールド（tosAccepted）は変更できない"
- 変更後: "同意フィールド（tosAccepted）の撤回（true → false）はできない"

#### B. 新規テストケースの追加（L342-475）
`Initial Consent Update`テストスイートを追加：

1. **初回同意（tosAccepted: false → true）は許可される**
2. **初回同意（ppAccepted: false → true）は許可される**
3. **両方の初回同意（tosAccepted & ppAccepted: false → true）を同時更新できる**
4. **初回同意時にタイムスタンプ未設定は拒否される**
5. **初回同意時にバージョン未設定は拒否される**
6. **同意済み（true → true）の場合、タイムスタンプ・バージョンは変更不可**

## テスト結果

```
Test Suites: 1 passed, 1 total
Tests:       51 passed, 51 total
```

全テストが成功しました。

## セキュリティ上の考慮事項

### 維持されるセキュリティ
- ✅ 同意撤回（`true → false`）はCloud Functionsのみが実行可能
- ✅ 初回同意時は必ずタイムスタンプとバージョンを設定
- ✅ 同意済み後のメタデータ変更は不可
- ✅ `deletionScheduled`等の管理フィールドは引き続き保護

### 新たに許可される操作
- ✅ ユーザー自身による初回同意更新（`false → true`）
- ✅ 同意メタデータ（タイムスタンプ、バージョン）の初回設定

## 影響範囲

### 修正ファイル
1. `firebase/firestore.rules` - セキュリティルール本体
2. `firebase/__tests__/firestore.rules.test.ts` - テストコード

### 影響を受けるフロー
- ✅ **新規登録フロー**: 登録後の利用規約同意画面で正常に同意更新が可能に
- ✅ **既存ユーザー**: 同意撤回はCloud Functions経由のみで、既存の動作に変更なし
- ✅ **GDPR準拠**: 同意記録の不変性とCloud Functions経由の管理は維持

## デプロイ手順

```bash
# 1. ルールの検証（テスト実行）
cd firebase
npm test -- firestore.rules.test.ts

# 2. Firestoreセキュリティルールのデプロイ
firebase deploy --only firestore:rules
```

## 関連ドキュメント
- `docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md` - 認証フロー仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - データ構造仕様
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ要件
