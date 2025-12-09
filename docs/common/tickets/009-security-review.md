# 009 セキュリティレビュー

## 概要

Phase 1で実装した機能のセキュリティを確認し、問題がないことを検証するチケットです。

「セキュリティレビュー」とは、アプリやシステムに脆弱性（弱い部分）がないかをチェックすることです。悪意のある攻撃からユーザーのデータを守るために、この作業は非常に重要です。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002（Firestore Security Rules実装）
- 003（Cloud Functions基盤）
- 004（認証トリガー実装）

## 要件

### 機能要件

- なし（レビューチケットのため）

### 非機能要件

- NFR-013: 脆弱性診断 - リリース前に実施
- NFR-012: アクセス制御 - Cloud IAMによるアクセス管理

## 受け入れ条件（Todo）

- [ ] Firestore Security Rulesのセキュリティテストを実施
  - [ ] 未認証ユーザーのアクセス拒否を確認
  - [ ] 他人のデータへのアクセス拒否を確認
  - [ ] 同意フィールドの変更禁止を確認
  - [ ] 削除予定ユーザーの書き込み禁止を確認
- [ ] 認証フローのセキュリティテストを実施
  - [ ] トークン検証が正しく行われているか確認
  - [ ] カスタムクレームが正しく設定されているか確認
- [ ] OWASP Top 10に基づく脆弱性チェックを実施
  - [ ] インジェクション攻撃への対策
  - [ ] 認証の不備への対策
  - [ ] 機密データの露出への対策
- [ ] セキュリティチェックリストを完成
- [ ] セキュリティレビュー報告書を作成

## 参照ドキュメント

- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針
- `docs/common/specs/02-2_非機能要件_v1_0.md` - セキュリティ要件
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - セキュリティルール

## 技術詳細

### OWASP Top 10 チェックリスト

OWASP（Open Web Application Security Project）は、Webアプリケーションのセキュリティに関する国際的な非営利団体です。OWASP Top 10は、最も重大なセキュリティリスクのリストです。

| No | リスク | チェック項目 | 対策 |
|----|--------|------------|------|
| A01 | アクセス制御の不備 | 認証なしでAPIにアクセスできないか | 全APIで認証必須 |
| A02 | 暗号化の失敗 | データが暗号化されているか | TLS 1.3, AES-256 |
| A03 | インジェクション | 入力値が適切にサニタイズされているか | バリデーション実装 |
| A04 | 安全でない設計 | セキュリティがデフォルトで有効か | デフォルト拒否ルール |
| A05 | セキュリティ設定の誤り | 不要なサービスが有効になっていないか | 最小権限の原則 |
| A06 | 脆弱なコンポーネント | 依存パッケージに脆弱性がないか | npm audit |
| A07 | 認証の不備 | 強力な認証が使われているか | Firebase Auth |
| A08 | ソフトウェアの整合性 | CI/CDパイプラインが安全か | 署名検証 |
| A09 | ログとモニタリングの不足 | セキュリティイベントが記録されているか | Cloud Logging |
| A10 | SSRF | サーバーサイドのリクエスト偽造 | URLのホワイトリスト |

### Firestore Security Rulesテスト

```typescript
// firebase/tests/security-rules.test.ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

describe("セキュリティルールテスト", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "test-project",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe("認証テスト", () => {
    test("未認証ユーザーはアクセスできない", async () => {
      const context = testEnv.unauthenticatedContext();
      const db = context.firestore();

      await assertFails(db.collection("users").get());
    });

    test("認証済みユーザーは自分のデータにアクセスできる", async () => {
      const userId = "user123";
      const context = testEnv.authenticatedContext(userId);
      const db = context.firestore();

      // テストデータを作成
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.collection("users").doc(userId).set({
          userId: userId,
          email: "test@example.com",
          tosAccepted: true,
          ppAccepted: true,
        });
      });

      await assertSucceeds(db.collection("users").doc(userId).get());
    });
  });

  describe("他人のデータへのアクセス", () => {
    test("他人のプロフィールは読めない", async () => {
      const userId = "user123";
      const otherId = "other456";
      const context = testEnv.authenticatedContext(userId);
      const db = context.firestore();

      await assertFails(db.collection("users").doc(otherId).get());
    });

    test("他人のセッションは読めない", async () => {
      const userId = "user123";
      const otherId = "other456";
      const context = testEnv.authenticatedContext(userId);
      const db = context.firestore();

      await assertFails(
        db.collection("users").doc(otherId).collection("sessions").get()
      );
    });
  });

  describe("同意フィールドの保護", () => {
    test("同意フィールドは変更できない", async () => {
      const userId = "user123";
      const context = testEnv.authenticatedContext(userId);
      const db = context.firestore();

      // テストデータを作成
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.collection("users").doc(userId).set({
          userId: userId,
          email: "test@example.com",
          tosAccepted: true,
          ppAccepted: true,
          deletionScheduled: false,
        });
      });

      await assertFails(
        db.collection("users").doc(userId).update({
          tosAccepted: false,
        })
      );
    });
  });

  describe("削除予定ユーザーの制限", () => {
    test("削除予定ユーザーは書き込みできない", async () => {
      const userId = "user123";
      const context = testEnv.authenticatedContext(userId);
      const db = context.firestore();

      // 削除予定ユーザーを作成
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.collection("users").doc(userId).set({
          userId: userId,
          email: "test@example.com",
          tosAccepted: true,
          ppAccepted: true,
          deletionScheduled: true,
        });
      });

      await assertFails(
        db.collection("users").doc(userId).update({
          displayName: "新しい名前",
        })
      );
    });
  });
});
```

### 認証フローテスト

```typescript
// functions/tests/auth/security.test.ts
import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

describe("認証セキュリティテスト", () => {
  beforeAll(() => {
    if (getApps().length === 0) {
      initializeApp();
    }
  });

  test("トークンが正しく検証される", async () => {
    const auth = getAuth();

    // 無効なトークンは拒否される
    await expect(
      auth.verifyIdToken("invalid-token")
    ).rejects.toThrow();
  });

  test("カスタムクレームが正しく設定される", async () => {
    const auth = getAuth();
    const testUid = "test-user-123";

    // カスタムクレームを設定
    await auth.setCustomUserClaims(testUid, { admin: false });

    // 確認
    const user = await auth.getUser(testUid);
    expect(user.customClaims?.admin).toBe(false);
  });
});
```

### npm audit の実行

```bash
# 脆弱性チェック
cd functions
npm audit

# 高リスクの脆弱性があれば失敗
npm audit --audit-level=high

# 自動修正（可能な場合）
npm audit fix
```

### セキュリティレビュー報告書テンプレート

```markdown
# セキュリティレビュー報告書

## 概要

- レビュー日: YYYY-MM-DD
- レビュアー: [名前]
- 対象バージョン: Phase 1 完了時点

## チェック結果

### Firestore Security Rules

| チェック項目 | 結果 | 備考 |
|-------------|------|------|
| 未認証アクセス拒否 | ✅ PASS | |
| 他人データアクセス拒否 | ✅ PASS | |
| 同意フィールド保護 | ✅ PASS | |
| 削除予定ユーザー制限 | ✅ PASS | |

### OWASP Top 10

| リスク | 結果 | 備考 |
|--------|------|------|
| A01: アクセス制御 | ✅ PASS | |
| A02: 暗号化 | ✅ PASS | |
| ... | ... | |

### 依存パッケージ

| パッケージ | 脆弱性 | 対応 |
|-----------|--------|------|
| なし | - | - |

## 発見された問題

（問題があれば記載）

## 推奨事項

（改善提案があれば記載）

## 結論

Phase 1のセキュリティレビューを完了しました。
重大な脆弱性は発見されませんでした。
```

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [ ] 未着手

## 備考

- 本格的なペネトレーションテストはPhase 2で実施予定（NFR-014）
- 外部のセキュリティ専門家によるレビューはリリース前に検討
- セキュリティレビューは定期的に（四半期ごとに）実施する

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
