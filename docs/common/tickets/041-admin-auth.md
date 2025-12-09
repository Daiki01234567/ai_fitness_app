# 041 管理者認証基盤

## 概要

管理者（運営チーム）がシステムにアクセスするための認証基盤を構築するチケットです。一般ユーザーとは異なる、より厳格なセキュリティ要件を満たす認証システムを実装します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 003: Firebase Authentication 統合
- 004: ユーザープロフィール API

## 要件

### 機能要件

- FR-ADM-001: ユーザーアカウント管理（管理者認証が前提）
- FR-ADM-009: セキュリティ監視（管理者認証が前提）

### 非機能要件

- NFR-038: 管理者認証 - 多要素認証必須
- NFR-040: IPアドレス制限 - 許可リスト方式

## 受け入れ条件（Todo）

### 管理者カスタムクレーム設定

- [ ] Firebase Admin SDKを使用した管理者カスタムクレーム付与機能を実装
- [ ] カスタムクレームの種類を定義（admin, superAdmin, readOnlyAdmin）
- [ ] カスタムクレーム設定用のCloud Functionを作成
- [ ] カスタムクレームの有効期限管理を実装

### 管理者専用ミドルウェア

- [ ] 管理者認証を検証するミドルウェアを実装
- [ ] カスタムクレームの検証ロジックを実装
- [ ] 認証失敗時の適切なエラーレスポンスを実装
- [ ] 認証ログの記録機能を実装

### ロールベースアクセス制御（RBAC）

- [ ] 管理者ロールの定義（superAdmin, admin, readOnlyAdmin）
- [ ] 各ロールの権限マトリクスを設計・実装
- [ ] ロールごとのアクセス制御ミドルウェアを実装
- [ ] ロール変更の監査ログ記録を実装

### IPアドレス制限

- [ ] 許可IPアドレスリストの管理機能を実装
- [ ] IPアドレス検証ミドルウェアを実装
- [ ] 許可リスト外からのアクセス時のアラート機能を実装

### 多要素認証（MFA）連携

- [ ] Firebase AuthenticationのMFA設定確認機能を実装
- [ ] MFA未設定の管理者へのアクセス拒否を実装
- [ ] MFA設定状況の監視機能を実装

### テスト

- [ ] 管理者認証ミドルウェアのユニットテストを作成
- [ ] ロールベースアクセス制御のテストを作成
- [ ] IPアドレス制限のテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - 管理者機能（セクション14）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - 管理者機能向け要件（セクション15）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針

## 技術詳細

### 管理者ロールの定義

```typescript
/**
 * 管理者ロールの種類
 *
 * superAdmin: すべての機能にアクセス可能（最高権限）
 * admin: ユーザー管理、データ閲覧、通知送信が可能
 * readOnlyAdmin: データ閲覧のみ可能（変更不可）
 */
type AdminRole = "superAdmin" | "admin" | "readOnlyAdmin";

interface AdminClaims {
  role: AdminRole;
  permissions: string[];
  mfaVerified: boolean;
  lastLoginAt: number;
}
```

### 権限マトリクス

| 機能 | superAdmin | admin | readOnlyAdmin |
|------|------------|-------|---------------|
| ユーザー一覧表示 | OK | OK | OK |
| ユーザー停止/復帰 | OK | OK | NG |
| ユーザー強制削除 | OK | NG | NG |
| 統計データ閲覧 | OK | OK | OK |
| 監査ログ閲覧 | OK | OK | OK |
| 監査ログエクスポート | OK | OK | NG |
| 通知送信 | OK | OK | NG |
| マスタデータ変更 | OK | NG | NG |
| 管理者ロール変更 | OK | NG | NG |
| セキュリティ設定変更 | OK | NG | NG |

### カスタムクレーム設定のCloud Function

```typescript
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * 管理者カスタムクレームを設定する
 * superAdminのみが実行可能
 */
export const setAdminClaims = onCall(async (request) => {
  // 呼び出し元がsuperAdminか確認
  const callerClaims = request.auth?.token;
  if (callerClaims?.role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "この操作にはsuperAdmin権限が必要です"
    );
  }

  const { targetUserId, role } = request.data;

  // カスタムクレームを設定
  await admin.auth().setCustomUserClaims(targetUserId, {
    role: role,
    permissions: getPermissionsForRole(role),
    mfaVerified: false,  // MFA検証はログイン時に更新
    lastLoginAt: Date.now(),
  });

  // 監査ログに記録
  await logAdminAction({
    action: "SET_ADMIN_CLAIMS",
    performedBy: request.auth?.uid,
    targetUser: targetUserId,
    newRole: role,
    timestamp: new Date(),
  });

  return { success: true };
});
```

### 管理者認証ミドルウェア

```typescript
import { Request, Response, NextFunction } from "express";
import { logger } from "firebase-functions";

/**
 * 管理者認証を検証するミドルウェア
 *
 * 1. Firebase IDトークンを検証
 * 2. 管理者カスタムクレームを確認
 * 3. MFA認証状態を確認
 * 4. IPアドレスを確認（許可リストと照合）
 */
export const requireAdmin = (requiredRole?: AdminRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // IDトークンを取得
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        logger.warn("管理者認証失敗: トークンなし", { ip: req.ip });
        return res.status(401).json({
          error: "認証が必要です",
          code: "UNAUTHENTICATED",
        });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // 管理者ロールを確認
      const role = decodedToken.role as AdminRole;
      if (!role || !isAdminRole(role)) {
        logger.warn("管理者認証失敗: 権限なし", {
          uid: decodedToken.uid,
          ip: req.ip,
        });
        return res.status(403).json({
          error: "管理者権限がありません",
          code: "PERMISSION_DENIED",
        });
      }

      // 必要なロールレベルを確認
      if (requiredRole && !hasRequiredRole(role, requiredRole)) {
        logger.warn("管理者認証失敗: ロール不足", {
          uid: decodedToken.uid,
          currentRole: role,
          requiredRole: requiredRole,
        });
        return res.status(403).json({
          error: `この操作には${requiredRole}権限が必要です`,
          code: "INSUFFICIENT_ROLE",
        });
      }

      // MFA認証状態を確認
      if (!decodedToken.mfaVerified) {
        return res.status(403).json({
          error: "多要素認証が必要です",
          code: "MFA_REQUIRED",
        });
      }

      // IPアドレスを確認
      const clientIp = req.ip || req.connection.remoteAddress;
      if (!await isAllowedIp(clientIp)) {
        logger.error("管理者認証失敗: 許可されていないIP", {
          uid: decodedToken.uid,
          ip: clientIp,
        });
        // アラートを送信
        await sendSecurityAlert({
          type: "UNAUTHORIZED_IP_ACCESS",
          userId: decodedToken.uid,
          ip: clientIp,
        });
        return res.status(403).json({
          error: "このIPアドレスからのアクセスは許可されていません",
          code: "IP_NOT_ALLOWED",
        });
      }

      // 認証成功 - リクエストにユーザー情報を追加
      req.adminUser = {
        uid: decodedToken.uid,
        role: role,
        permissions: decodedToken.permissions,
      };

      next();
    } catch (error) {
      logger.error("管理者認証エラー", { error });
      return res.status(401).json({
        error: "認証に失敗しました",
        code: "AUTH_ERROR",
      });
    }
  };
};
```

### IPアドレス許可リストの管理

```typescript
/**
 * 許可IPアドレスリストはFirestoreで管理
 * コレクション: adminSettings/ipAllowlist
 */
interface IpAllowlistDoc {
  allowedIps: string[];      // 許可されたIPアドレス
  allowedCidrs: string[];    // 許可されたCIDR範囲
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * IPアドレスが許可リストに含まれるか確認
 */
async function isAllowedIp(ip: string): Promise<boolean> {
  const doc = await admin.firestore()
    .doc("adminSettings/ipAllowlist")
    .get();

  if (!doc.exists) {
    // 許可リストが設定されていない場合は拒否
    return false;
  }

  const data = doc.data() as IpAllowlistDoc;

  // 完全一致チェック
  if (data.allowedIps.includes(ip)) {
    return true;
  }

  // CIDR範囲チェック
  for (const cidr of data.allowedCidrs) {
    if (isIpInCidr(ip, cidr)) {
      return true;
    }
  }

  return false;
}
```

### Firestoreセキュリティルール（管理者用）

```javascript
// 管理者設定へのアクセス制御
match /adminSettings/{document=**} {
  // superAdminのみ読み書き可能
  allow read, write: if request.auth != null
    && request.auth.token.role == "superAdmin";
}

// 監査ログへのアクセス制御
match /auditLogs/{logId} {
  // 管理者は読み取りのみ可能（書き込みはCloud Functionsのみ）
  allow read: if request.auth != null
    && request.auth.token.role in ["superAdmin", "admin", "readOnlyAdmin"];
  allow write: if false;  // クライアントからの書き込みは禁止
}
```

## 見積もり

- 工数: 5日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 管理者の初期設定（最初のsuperAdmin作成）は、Firebase Consoleから直接カスタムクレームを設定する
- 本番環境での運用開始前に、セキュリティレビューを実施すること
- IPアドレス許可リストは定期的に見直しを行うこと

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
