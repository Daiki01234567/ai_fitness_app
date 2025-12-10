# 006 GDPR同意管理API

## 概要

ユーザーが「利用規約」と「プライバシーポリシー」に同意したことを記録・管理する**基本的なAPI**を実装するチケットです。

GDPRとは、ヨーロッパの個人情報保護法のことで、「いつ」「何に」同意したかを正確に記録しておく必要があります。このAPIにより、ユーザーの同意状態を管理し、必要に応じて同意履歴を確認できるようにします。

**関連チケット**: チケット020（GDPR同意履歴・監査機能）で、本チケットの機能を拡張した監査機能・データアクセスログ・統計レポート機能を実装します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002（Firestore Security Rules実装）
- 003（Cloud Functions基盤）

## 要件

### 機能要件

- FR-024: 同意管理 - 利用規約・プライバシーポリシーへの同意記録
- FR-002-1: 同意状態管理機能 - 同意状態の確認と管理

### 非機能要件

- NFR-019: 同意管理 - 記録保持

## 受け入れ条件（Todo）

- [x] user_updateConsent API を実装
  - [x] 利用規約（ToS）への同意を記録
  - [x] プライバシーポリシー（PP）への同意を記録
  - [x] バージョン情報を保存
  - [x] IPアドレスとユーザーエージェントを記録
- [x] consentsコレクションへの履歴記録を実装
- [x] user_revokeConsent API を実装（同意撤回）
  - [x] 同意フラグをfalseに更新
  - [x] forceLogoutフラグをtrueに設定
  - [x] リフレッシュトークンを無効化
- [x] 同意状態取得API（getUserConsent）を実装
- [x] バリデーションを実装
- [ ] ユニットテストを作成
- [ ] エミュレータでテストが通ることを確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - user_updateConsent, user_revokeConsentの仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Consentsコレクションのスキーマ
- `docs/common/specs/07_データ処理記録_ROPA_v1_0.md` - GDPR対応

## 技術詳細

### user_updateConsent API

```typescript
// functions/src/api/users/updateConsent.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("user_updateConsent");

interface UpdateConsentRequest {
  tosAccepted: boolean;
  tosVersion: string;
  ppAccepted: boolean;
  ppVersion: string;
}

export const user_updateConsent = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;
  const data = request.data as UpdateConsentRequest;

  // バリデーション
  if (typeof data.tosAccepted !== "boolean" ||
      typeof data.ppAccepted !== "boolean") {
    throw new HttpsError("invalid-argument", "同意状態は真偽値で指定してください");
  }

  if (!data.tosVersion || !data.ppVersion) {
    throw new HttpsError("invalid-argument", "バージョン情報が必要です");
  }

  logger.info("同意更新リクエスト", { uid, tosAccepted: data.tosAccepted, ppAccepted: data.ppAccepted });

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  // トランザクションで更新
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(uid);

    // ユーザードキュメントを更新
    transaction.update(userRef, {
      tosAccepted: data.tosAccepted,
      tosAcceptedAt: data.tosAccepted ? now : null,
      tosVersion: data.tosAccepted ? data.tosVersion : null,
      ppAccepted: data.ppAccepted,
      ppAcceptedAt: data.ppAccepted ? now : null,
      ppVersion: data.ppAccepted ? data.ppVersion : null,
      updatedAt: now,
    });

    // 同意履歴を記録（consentsコレクション）
    if (data.tosAccepted) {
      const tosConsentRef = db.collection("consents").doc();
      transaction.set(tosConsentRef, {
        consentId: tosConsentRef.id,
        userId: uid,
        consentType: "tos",
        version: data.tosVersion,
        action: "accepted",
        timestamp: now,
        ipAddress: request.rawRequest?.ip || null,
        userAgent: request.rawRequest?.headers?.["user-agent"] || null,
      });
    }

    if (data.ppAccepted) {
      const ppConsentRef = db.collection("consents").doc();
      transaction.set(ppConsentRef, {
        consentId: ppConsentRef.id,
        userId: uid,
        consentType: "pp",
        version: data.ppVersion,
        action: "accepted",
        timestamp: now,
        ipAddress: request.rawRequest?.ip || null,
        userAgent: request.rawRequest?.headers?.["user-agent"] || null,
      });
    }
  });

  logger.info("同意更新完了", { uid });

  return {
    success: true,
    message: "同意状態を更新しました",
    data: {
      tosAccepted: data.tosAccepted,
      ppAccepted: data.ppAccepted,
    },
  };
});
```

### user_revokeConsent API（同意撤回）

```typescript
// functions/src/api/users/revokeConsent.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { createLogger } from "../../utils/logger";

const logger = createLogger("user_revokeConsent");

export const user_revokeConsent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;

  logger.info("同意撤回リクエスト", { uid });

  const db = getFirestore();
  const auth = getAuth();
  const now = FieldValue.serverTimestamp();

  // トランザクションで更新
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(uid);

    // ユーザードキュメントを更新
    transaction.update(userRef, {
      tosAccepted: false,
      tosAcceptedAt: null,
      tosVersion: null,
      ppAccepted: false,
      ppAcceptedAt: null,
      ppVersion: null,
      forceLogout: true,
      forceLogoutAt: now,
      updatedAt: now,
    });

    // 同意撤回履歴を記録
    const revokeConsentRef = db.collection("consents").doc();
    transaction.set(revokeConsentRef, {
      consentId: revokeConsentRef.id,
      userId: uid,
      consentType: "all",
      version: null,
      action: "revoked",
      timestamp: now,
      ipAddress: request.rawRequest?.ip || null,
      userAgent: request.rawRequest?.headers?.["user-agent"] || null,
    });
  });

  // リフレッシュトークンを無効化
  await auth.revokeRefreshTokens(uid);

  // カスタムクレームで強制ログアウトを設定
  await auth.setCustomUserClaims(uid, {
    forceLogout: true,
    forceLogoutAt: Date.now(),
  });

  logger.info("同意撤回完了", { uid });

  return {
    success: true,
    message: "同意を撤回しました。即座にログアウトされます。",
    forceLogout: true,
  };
});
```

### getUserConsent API（同意状態取得）

```typescript
// functions/src/api/users/getConsent.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("user_getConsent");

export const user_getConsent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;

  logger.info("同意状態取得リクエスト", { uid });

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "ユーザーが見つかりません");
  }

  const userData = userDoc.data();

  return {
    success: true,
    data: {
      tosAccepted: userData?.tosAccepted || false,
      tosAcceptedAt: userData?.tosAcceptedAt?.toDate?.()?.toISOString() || null,
      tosVersion: userData?.tosVersion || null,
      ppAccepted: userData?.ppAccepted || false,
      ppAcceptedAt: userData?.ppAcceptedAt?.toDate?.()?.toISOString() || null,
      ppVersion: userData?.ppVersion || null,
    },
  };
});
```

### レート制限

| API | 制限 | 時間窓 |
|-----|------|--------|
| user_updateConsent | 10回 | 1時間/ユーザー |
| user_revokeConsent | 5回 | 1日/ユーザー |
| user_getConsent | 60回 | 1時間/ユーザー |

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] 完了（テスト以外）

## 備考

### 基本機能の範囲
- 同意履歴（consentsコレクション）は削除不可（GDPR監査証跡）
- 同意撤回後は強制ログアウトされる
- アプリ側で同意状態をチェックし、未同意の場合は同意画面を表示する

### チケット020との関係
本チケットは基本的な同意管理機能（記録・撤回・状態取得）を提供します。以下の拡張機能はチケット020で実装します：

| 機能 | チケット006（本チケット） | チケット020（拡張） |
|------|----------------------|------------------|
| 同意記録・撤回 | ✅ 本チケットで実装 | - |
| 同意状態取得 | ✅ 本チケットで実装 | - |
| 同意履歴一覧 | - | Phase 2で実装 |
| 監査ログ検索 | - | Phase 2で実装（管理者向け） |
| データアクセスログ | - | Phase 2で実装 |
| 統計レポート | - | Phase 2で実装（管理者向け） |

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 同意管理API実装完了（recordConsent, revokeConsent, status） |
| 2025-12-10 | チケット020との関係を明記、基本機能と拡張機能を明確に区別 |
