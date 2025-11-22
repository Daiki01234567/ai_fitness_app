# API設計書(Firebase Functions) v3.1

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.1  
**作成日**: 2025年11月22日  
**最終更新日**: 2025年11月22日  
**対象期間**: Phase 1-2 (0-4ヶ月)

---

## 📝 v3.1での主な変更点

### 法的要件との完全な整合性

✅ **要件定義書v3.1との整合**:
- 全31機能要件に対応するAPI設計
- FR-024〜027(GDPR対応)のAPI実装
- FR-028〜029(データ収集)のAPI実装
- NFR-001〜020(非機能要件)への対応

✅ **利用規約v3.1との整合**:
- 第1.2条: 用語定義に基づくAPI命名
- 第3.3条: 医療機器でない旨をレスポンスに反映
- 第6条: サブスクリプション管理API

✅ **プライバシーポリシーv3.1との整合**:
- 第8条: セキュリティ対策の実装
- 第9条: GDPR権利行使API
- データ最小化の原則を反映

✅ **システムアーキテクチャ設計書v3.1との整合**:
- 第5章: Firebase Functions設計
- 第8章: セキュリティアーキテクチャ
- 第9章: データフロー

✅ **Firestoreデータベース設計書v3.1との整合**:
- データモデルとの完全な一貫性
- Security Rulesとの連携
- GDPR対応データ構造

✅ **BigQuery設計書v3.1との整合**:
- データ取り込みAPIの設計
- 分析データの仮名化処理

---

## 目次

1. [概要](#1-概要)
2. [API設計原則](#2-api設計原則)
3. [認証](#3-認証)
4. [ユーザー管理API](#4-ユーザー管理api)
5. [セッション管理API](#5-セッション管理api)
6. [サブスクリプション管理API](#6-サブスクリプション管理api)
7. [通知API](#7-通知api)
8. [GDPR対応API](#8-gdpr対応api)
9. [BigQuery連携API](#9-bigquery連携api)
10. [エラーハンドリング](#10-エラーハンドリング)
11. [レート制限](#11-レート制限)
12. [監視・ロギング](#12-監視ロギング)
13. [デプロイ・運用](#13-デプロイ運用)
14. [まとめ](#14-まとめ)
15. [APIエンドポイント一覧](#15-apiエンドポイント一覧)

---

## 1. 概要

### 1.1 ドキュメントの目的

本ドキュメントは、Firebase Functions(Cloud Functions for Firebase)を使用したバックエンドAPIの設計を定義し、以下を明確にします:

1. **APIエンドポイント**: 各機能のエンドポイント定義
2. **リクエスト/レスポンス**: データ構造と形式
3. **認証・認可**: Firebase Authenticationとの連携
4. **セキュリティ**: アクセス制御とデータ保護
5. **エラーハンドリング**: エラー処理とステータスコード
6. **パフォーマンス**: レート制限と最適化

### 1.2 参照ドキュメント

| ドキュメント | バージョン | 参照箇所 |
|------------|----------|---------|
| **要件定義書** | v3.1 | 第3章(機能要件)、第4章(非機能要件) |
| **利用規約** | v3.1 | 第1.2条(用語定義)、第6条(課金) |
| **プライバシーポリシー** | v3.1 | 第8条(セキュリティ)、第9条(GDPR) |
| **システムアーキテクチャ設計書** | v3.1 | 第5章、第8章、第9章 |
| **Firestoreデータベース設計書** | v3.1 | 第3章、第4章、第5章 |
| **BigQuery設計書** | v3.1 | 第7章(データ取り込み) |

### 1.3 技術スタック

#### 1.3.1 Firebase Functions

| 項目 | 設定 |
|-----|------|
| **ランタイム** | Node.js 20 |
| **リージョン** | asia-northeast1 (東京) |
| **メモリ** | 256MB (デフォルト), 512MB (重い処理) |
| **タイムアウト** | 60秒 (デフォルト), 540秒 (最大) |
| **最小インスタンス** | 0 (コールドスタート許容) |
| **最大インスタンス** | 10 (Phase 1-2) |

#### 1.3.2 使用ライブラリ

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "zod": "^3.22.0",
    "@google-cloud/bigquery": "^7.3.0",
    "@google-cloud/storage": "^7.7.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "firebase-functions-test": "^3.1.0"
  }
}
```

### 1.4 API設計方針

#### 1.4.1 RESTful API

本プロジェクトでは、RESTful API設計を採用します:

| メソッド | 用途 | 冪等性 |
|---------|------|--------|
| **GET** | リソースの取得 | ✅ Yes |
| **POST** | リソースの作成 | ❌ No |
| **PUT** | リソースの更新(全体) | ✅ Yes |
| **PATCH** | リソースの更新(部分) | ❌ No |
| **DELETE** | リソースの削除 | ✅ Yes |

#### 1.4.2 URL設計

**ベースURL**:
```
https://asia-northeast1-[PROJECT_ID].cloudfunctions.net/api
```

**命名規則**:
- リソース名は複数形: `/users`, `/sessions`
- 階層構造: `/users/{userId}/sessions`
- ケバブケース: `/export-data`, `/delete-account`

#### 1.4.3 バージョニング

**URLパスによるバージョニング**:
```
/v1/users
/v2/users (将来)
```

### 1.5 セキュリティ要件

| 項目 | 要件 | 根拠 |
|-----|------|------|
| **認証** | Firebase Authentication必須 | NFR-009 |
| **HTTPS** | すべてのAPIはHTTPSのみ | NFR-011 |
| **CORS** | 許可されたオリジンのみ | NFR-011 |
| **レート制限** | 100リクエスト/分/ユーザー | NFR-001 |
| **入力検証** | すべての入力をバリデーション | NFR-011 |
| **ログ記録** | すべてのAPIアクセスをログ | NFR-017 |

---

## 2. API設計原則

### 2.1 HTTPステータスコード

本プロジェクトで使用するHTTPステータスコード:

| コード | 意味 | 使用場面 |
|-------|------|---------|
| **200** | OK | 成功(GET, PUT, PATCH) |
| **201** | Created | リソース作成成功(POST) |
| **204** | No Content | 成功(DELETE、レスポンスボディなし) |
| **400** | Bad Request | リクエストの形式エラー |
| **401** | Unauthorized | 認証エラー |
| **403** | Forbidden | 権限エラー |
| **404** | Not Found | リソースが見つからない |
| **409** | Conflict | リソースの競合 |
| **429** | Too Many Requests | レート制限超過 |
| **500** | Internal Server Error | サーバーエラー |
| **503** | Service Unavailable | サービス一時停止 |

### 2.2 レスポンス形式

#### 2.2.1 成功レスポンス

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp: string;
    version: string;
  };
}
```

**例**:
```json
{
  "success": true,
  "data": {
    "userId": "abc123",
    "displayName": "山田太郎"
  },
  "metadata": {
    "timestamp": "2025-11-22T10:00:00Z",
    "version": "1.0.0"
  }
}
```

#### 2.2.2 エラーレスポンス

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    version: string;
  };
}
```

**例**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "認証が必要です",
    "details": {
      "reason": "invalid_token"
    }
  },
  "metadata": {
    "timestamp": "2025-11-22T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### 2.3 ページネーション

**クエリパラメータ**:
```
GET /api/v1/sessions?page=1&limit=20
```

**レスポンス**:
```typescript
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### 2.4 入力検証

**Zodによるバリデーション**:

```typescript
import { z } from 'zod';

// ユーザー登録のスキーマ
const createUserSchema = z.object({
  displayName: z.string().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region: z.enum(['JP', 'US', 'EEA', 'OTHER']),
});

// 使用例
function validateCreateUser(data: unknown) {
  return createUserSchema.parse(data);
}
```

---

## 3. 認証

### 3.1 Firebase Authentication

本プロジェクトでは、Firebase Authenticationを使用します。

#### 3.1.1 認証フロー

```
1. クライアント: Firebase Auth SDKでログイン
2. クライアント: IDトークンを取得
3. クライアント: APIリクエストのAuthorizationヘッダーにIDトークンを含める
4. サーバー: IDトークンを検証
5. サーバー: ユーザー情報を取得
6. サーバー: リクエストを処理
```

#### 3.1.2 認証ミドルウェア

```typescript
import { auth } from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

/**
 * 認証ミドルウェア
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: { reason: 'missing_token' }
        }
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // IDトークンを検証
    const decodedToken = await auth().verifyIdToken(idToken);
    
    // リクエストにユーザー情報を追加
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '認証に失敗しました',
        details: { reason: 'invalid_token' }
      }
    });
  }
}
```

#### 3.1.3 認証方法

本プロジェクトでサポートする認証方法:

| 方法 | プロバイダー | Phase |
|-----|------------|-------|
| **Google OAuth** | Google | Phase 1 |
| **Apple OAuth** | Apple | Phase 1 |
| **匿名認証** | Firebase Anonymous | Phase 2 (検討) |

### 3.2 認可(Authorization)

#### 3.2.1 権限チェック

```typescript
/**
 * 自分のリソースかチェック
 */
function checkOwnership(req: AuthenticatedRequest, userId: string): boolean {
  return req.user?.uid === userId;
}

/**
 * プレミアムプランかチェック
 */
async function checkPremium(userId: string): Promise<boolean> {
  const subDoc = await db.collection('subscriptions').doc(userId).get();
  if (!subDoc.exists) return false;
  
  const sub = subDoc.data();
  return sub.planId === 'premium' && 
         (sub.status === 'active' || sub.status === 'trial');
}

/**
 * 使用例
 */
app.get('/api/v1/users/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  
  // 自分のデータのみ取得可能
  if (!checkOwnership(req, userId)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '権限がありません'
      }
    });
  }
  
  // ... リソースを取得
});
```

---

## 4. ユーザー管理API

### 4.1 ユーザー登録

**エンドポイント**: `POST /api/v1/users`

**目的**: 新規ユーザーを登録します。

**認証**: 必須(Firebase Authentication)

**リクエスト**:

```typescript
interface CreateUserRequest {
  displayName: string;       // 表示名(1-50文字)
  dateOfBirth: string;       // 生年月日(YYYY-MM-DD)
  region: 'JP' | 'US' | 'EEA' | 'OTHER';
  notificationEnabled: boolean;
}
```

**リクエスト例**:
```json
{
  "displayName": "山田太郎",
  "dateOfBirth": "1990-01-01",
  "region": "JP",
  "notificationEnabled": true
}
```

**レスポンス**:

```typescript
interface CreateUserResponse {
  success: true;
  data: {
    userId: string;
    displayName: string;
    email?: string;
    createdAt: string;
  };
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "userId": "abc123",
    "displayName": "山田太郎",
    "email": "yamada@example.com",
    "createdAt": "2025-11-22T10:00:00Z"
  }
}
```

**実装例**:

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const createUserSchema = z.object({
  displayName: z.string().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region: z.enum(['JP', 'US', 'EEA', 'OTHER']),
  notificationEnabled: z.boolean(),
});

export const createUser = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      // メソッドチェック
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' }
        });
      }

      // 認証チェック
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // 入力検証
      const validatedData = createUserSchema.parse(req.body);

      // 年齢確認
      const birthDate = new Date(validatedData.dateOfBirth);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      const minAge = validatedData.region === 'EEA' ? 16 : 13;
      
      if (age < minAge) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AGE_RESTRICTION',
            message: `${minAge}歳以上である必要があります`
          }
        });
      }

      // Firestoreに保存
      const db = getFirestore();
      const userDoc = {
        userId: user.uid,
        displayName: validatedData.displayName,
        email: user.email || null,
        dateOfBirth: validatedData.dateOfBirth,
        region: validatedData.region,
        notificationEnabled: validatedData.notificationEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('users').doc(user.uid).set(userDoc);

      // レスポンス
      return res.status(201).json({
        success: true,
        data: {
          userId: userDoc.userId,
          displayName: userDoc.displayName,
          email: userDoc.email,
          createdAt: userDoc.createdAt,
        }
      });

    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ユーザー登録に失敗しました'
        }
      });
    }
  }
);
```

**エラーコード**:

| コード | HTTPステータス | 説明 |
|-------|--------------|------|
| `UNAUTHORIZED` | 401 | 認証が必要 |
| `AGE_RESTRICTION` | 400 | 年齢制限 |
| `VALIDATION_ERROR` | 400 | 入力エラー |
| `USER_ALREADY_EXISTS` | 409 | ユーザー既存 |
| `INTERNAL_ERROR` | 500 | サーバーエラー |

---

### 4.2 ユーザー情報取得

**エンドポイント**: `GET /api/v1/users/{userId}`

**目的**: ユーザー情報を取得します。

**認証**: 必須

**パラメータ**:

| 名前 | 型 | 必須 | 説明 |
|-----|---|------|------|
| `userId` | string | ✅ | ユーザーID |

**レスポンス**:

```typescript
interface GetUserResponse {
  success: true;
  data: {
    userId: string;
    displayName: string;
    email?: string;
    dateOfBirth: string;
    region: string;
    notificationEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
}
```

**実装例**:

```typescript
export const getUser = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      // 認証チェック
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // パスパラメータからuserIdを取得
      const userId = req.params.userId;

      // 権限チェック(自分のデータのみ)
      if (user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // Firestoreから取得
      const db = getFirestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' }
        });
      }

      const userData = userDoc.data();

      return res.status(200).json({
        success: true,
        data: userData
      });

    } catch (error) {
      console.error('Error getting user:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 4.3 ユーザー情報更新

**エンドポイント**: `PATCH /api/v1/users/{userId}`

**目的**: ユーザー情報を更新します。

**認証**: 必須

**リクエスト**:

```typescript
interface UpdateUserRequest {
  displayName?: string;
  notificationEnabled?: boolean;
}
```

**レスポンス**:

```typescript
interface UpdateUserResponse {
  success: true;
  data: {
    userId: string;
    updatedAt: string;
  };
}
```

**実装例**:

```typescript
const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  notificationEnabled: z.boolean().optional(),
});

export const updateUser = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      // 認証・権限チェック
      const user = req.user;
      const userId = req.params.userId;

      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 入力検証
      const validatedData = updateUserSchema.parse(req.body);

      // 更新
      const db = getFirestore();
      await db.collection('users').doc(userId).update({
        ...validatedData,
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: {
          userId,
          updatedAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 4.4 ユーザー削除(アカウント削除)

**エンドポイント**: `DELETE /api/v1/users/{userId}`

**目的**: ユーザーアカウントを削除します(GDPR対応)。

**認証**: 必須

**レスポンス**:

```typescript
interface DeleteUserResponse {
  success: true;
  message: string;
}
```

**実装例**:

```typescript
export const deleteUser = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // GDPR準拠: deletion_requestsに記録
      const db = getFirestore();
      await db.collection('deletion_requests').add({
        userId,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日後
        cancelableUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: 'アカウント削除リクエストを受け付けました。30日後に削除されます。'
      });

    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

**Part 1 完了**

このファイルには以下が含まれています:
- 概要(目的、参照ドキュメント、技術スタック)
- API設計原則(HTTPステータスコード、レスポンス形式、ページネーション、入力検証)
- 認証(Firebase Authentication、認証ミドルウェア、認可)
- ユーザー管理API(登録、取得、更新、削除)

次のファイル(Part 2)には以下を含めます:
- セッション管理API
- サブスクリプション管理API
- 通知API

---

## 5. セッション管理API

### 5.1 セッション作成

**エンドポイント**: `POST /api/v1/sessions`

**目的**: 新しいトレーニングセッションを作成します。

**認証**: 必須

**リクエスト**:

```typescript
interface CreateSessionRequest {
  exerciseId: string;           // 種目ID
  exerciseName: string;         // 種目名
  exerciseCategory: string;     // カテゴリー
  repCount: number;             // レップ数
  setCount?: number;            // セット数
  duration: number;             // 時間(秒)
  weight?: number;              // 重量(kg)
  notes?: string;               // メモ
  averageScore: number;         // 平均スコア
  scores: number[];             // スコア配列
  maxScore: number;             // 最大スコア
  minScore: number;             // 最小スコア
  landmarksSummary?: {          // 骨格座標サマリー
    frameCount: number;
    averageVisibility: number;
    quality: 'high' | 'medium' | 'low';
  };
  metadata: {
    appVersion: string;
    deviceInfo: {
      os: 'iOS' | 'Android';
      osVersion: string;
      model: string;
    };
    mediapipeVersion: string;
    processingTime: number;     // 処理時間(ms)
  };
}
```

**リクエスト例**:
```json
{
  "exerciseId": "squat",
  "exerciseName": "スクワット",
  "exerciseCategory": "bodyweight",
  "repCount": 10,
  "setCount": 3,
  "duration": 180,
  "weight": null,
  "notes": "フォームを意識して実施",
  "averageScore": 85.5,
  "scores": [82, 85, 88, 87, 86, 85, 84, 86, 87, 85],
  "maxScore": 88,
  "minScore": 82,
  "landmarksSummary": {
    "frameCount": 300,
    "averageVisibility": 0.92,
    "quality": "high"
  },
  "metadata": {
    "appVersion": "1.0.0",
    "deviceInfo": {
      "os": "iOS",
      "osVersion": "16.0",
      "model": "iPhone 13"
    },
    "mediapipeVersion": "0.9.0",
    "processingTime": 1500
  }
}
```

**レスポンス**:

```typescript
interface CreateSessionResponse {
  success: true;
  data: {
    sessionId: string;
    userId: string;
    createdAt: string;
  };
}
```

**実装例**:

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const createSessionSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  exerciseCategory: z.string(),
  repCount: z.number().int().positive(),
  setCount: z.number().int().positive().optional(),
  duration: z.number().positive(),
  weight: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  averageScore: z.number().min(0).max(100),
  scores: z.array(z.number().min(0).max(100)),
  maxScore: z.number().min(0).max(100),
  minScore: z.number().min(0).max(100),
  landmarksSummary: z.object({
    frameCount: z.number().int().positive(),
    averageVisibility: z.number().min(0).max(1),
    quality: z.enum(['high', 'medium', 'low']),
  }).optional(),
  metadata: z.object({
    appVersion: z.string(),
    deviceInfo: z.object({
      os: z.enum(['iOS', 'Android']),
      osVersion: z.string(),
      model: z.string(),
    }),
    mediapipeVersion: z.string(),
    processingTime: z.number().int().positive(),
  }),
});

export const createSession = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      // 認証チェック
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // 入力検証
      const validatedData = createSessionSchema.parse(req.body);

      // 無料プランの利用回数チェック
      const db = getFirestore();
      const subDoc = await db.collection('subscriptions').doc(user.uid).get();
      
      if (subDoc.exists) {
        const sub = subDoc.data();
        if (sub.planId === 'free') {
          // 今日のセッション数をカウント
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const sessionsToday = await db.collection('sessions')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', today.toISOString())
            .count()
            .get();

          if (sessionsToday.data().count >= 3) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FREE_PLAN_LIMIT',
                message: '無料プランは1日3回までです。プレミアムプランにアップグレードしてください。'
              }
            });
          }
        }
      }

      // セッションを作成
      const sessionDoc = {
        sessionId: db.collection('sessions').doc().id,
        userId: user.uid,
        ...validatedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        exportedToBigQuery: false,
      };

      await db.collection('sessions').doc(sessionDoc.sessionId).set(sessionDoc);

      return res.status(201).json({
        success: true,
        data: {
          sessionId: sessionDoc.sessionId,
          userId: sessionDoc.userId,
          createdAt: sessionDoc.createdAt,
        }
      });

    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

**エラーコード**:

| コード | HTTPステータス | 説明 |
|-------|--------------|------|
| `UNAUTHORIZED` | 401 | 認証が必要 |
| `FREE_PLAN_LIMIT` | 403 | 無料プラン上限 |
| `VALIDATION_ERROR` | 400 | 入力エラー |
| `INTERNAL_ERROR` | 500 | サーバーエラー |

---

### 5.2 セッション一覧取得

**エンドポイント**: `GET /api/v1/users/{userId}/sessions`

**目的**: ユーザーのセッション一覧を取得します。

**認証**: 必須

**クエリパラメータ**:

| 名前 | 型 | 必須 | デフォルト | 説明 |
|-----|---|------|----------|------|
| `page` | number | ❌ | 1 | ページ番号 |
| `limit` | number | ❌ | 20 | 1ページあたりの件数 |
| `sortBy` | string | ❌ | createdAt | ソート項目 |
| `order` | string | ❌ | desc | ソート順(asc/desc) |
| `exerciseId` | string | ❌ | - | 種目IDでフィルタ |
| `startDate` | string | ❌ | - | 開始日(YYYY-MM-DD) |
| `endDate` | string | ❌ | - | 終了日(YYYY-MM-DD) |

**レスポンス**:

```typescript
interface GetSessionsResponse {
  success: true;
  data: Session[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

**実装例**:

```typescript
export const getSessions = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // クエリパラメータ
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const order = req.query.order as 'asc' | 'desc' || 'desc';
      const exerciseId = req.query.exerciseId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      // Firestoreクエリ
      const db = getFirestore();
      let query = db.collection('sessions')
        .where('userId', '==', userId);

      // フィルタ
      if (exerciseId) {
        query = query.where('exerciseId', '==', exerciseId);
      }
      if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      }
      if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      // ソート
      query = query.orderBy(sortBy, order);

      // 総数を取得
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // ページネーション
      const offset = (page - 1) * limit;
      query = query.offset(offset).limit(limit);

      const snapshot = await query.get();
      const sessions = snapshot.docs.map(doc => doc.data());

      return res.status(200).json({
        success: true,
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        }
      });

    } catch (error) {
      console.error('Error getting sessions:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 5.3 セッション詳細取得

**エンドポイント**: `GET /api/v1/sessions/{sessionId}`

**目的**: セッションの詳細情報を取得します。

**認証**: 必須

**レスポンス**:

```typescript
interface GetSessionResponse {
  success: true;
  data: Session;
}
```

**実装例**:

```typescript
export const getSession = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const sessionId = req.params.sessionId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // セッションを取得
      const db = getFirestore();
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'セッションが見つかりません' }
        });
      }

      const session = sessionDoc.data();

      // 権限チェック
      if (session.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      return res.status(200).json({
        success: true,
        data: session
      });

    } catch (error) {
      console.error('Error getting session:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 5.4 セッション更新

**エンドポイント**: `PATCH /api/v1/sessions/{sessionId}`

**目的**: セッション情報を更新します(メモなど)。

**認証**: 必須

**リクエスト**:

```typescript
interface UpdateSessionRequest {
  notes?: string;
  weight?: number;
}
```

**実装例**:

```typescript
const updateSessionSchema = z.object({
  notes: z.string().max(500).optional(),
  weight: z.number().positive().optional(),
});

export const updateSession = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const sessionId = req.params.sessionId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // 入力検証
      const validatedData = updateSessionSchema.parse(req.body);

      // セッションを取得
      const db = getFirestore();
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'セッションが見つかりません' }
        });
      }

      const session = sessionDoc.data();

      // 権限チェック
      if (session.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 更新
      await db.collection('sessions').doc(sessionId).update({
        ...validatedData,
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: {
          sessionId,
          updatedAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error('Error updating session:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 5.5 セッション削除

**エンドポイント**: `DELETE /api/v1/sessions/{sessionId}`

**目的**: セッションを削除します。

**認証**: 必須

**実装例**:

```typescript
export const deleteSession = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const sessionId = req.params.sessionId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // セッションを取得
      const db = getFirestore();
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'セッションが見つかりません' }
        });
      }

      const session = sessionDoc.data();

      // 権限チェック
      if (session.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 削除
      await db.collection('sessions').doc(sessionId).delete();

      return res.status(204).send();

    } catch (error) {
      console.error('Error deleting session:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

## 6. サブスクリプション管理API

### 6.1 RevenueCat Webhook

**エンドポイント**: `POST /api/v1/webhooks/revenuecat`

**目的**: RevenueCatからのWebhookを受け取り、サブスクリプション情報を更新します。

**認証**: RevenueCat署名検証

**Webhookイベント**:

| イベント | 説明 |
|---------|------|
| `INITIAL_PURCHASE` | 初回購入 |
| `RENEWAL` | 更新 |
| `CANCELLATION` | キャンセル |
| `EXPIRATION` | 有効期限切れ |
| `BILLING_ISSUE` | 課金エラー |

**実装例**:

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * RevenueCat Webhook署名検証
 */
function verifyRevenueCatSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const computedSignature = hmac.digest('hex');
  return signature === computedSignature;
}

export const revenuecatWebhook = onRequest(
  {
    region: 'asia-northeast1',
    cors: false,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      // メソッドチェック
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' }
        });
      }

      // 署名検証
      const signature = req.headers['x-revenuecat-signature'] as string;
      const payload = JSON.stringify(req.body);
      const secret = process.env.REVENUECAT_WEBHOOK_SECRET || '';

      if (!verifyRevenueCatSignature(payload, signature, secret)) {
        console.error('Invalid RevenueCat signature');
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: '署名が無効です' }
        });
      }

      // Webhookデータ
      const event = req.body;
      const eventType = event.type;
      const appUserId = event.app_user_id;
      const productId = event.product_id;
      const expirationDate = event.expiration_at_ms 
        ? new Date(event.expiration_at_ms).toISOString() 
        : null;

      console.log('RevenueCat webhook:', { eventType, appUserId, productId });

      // Firestoreを更新
      const db = getFirestore();
      const subRef = db.collection('subscriptions').doc(appUserId);

      switch (eventType) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
          await subRef.set({
            userId: appUserId,
            planId: 'premium',
            status: 'active',
            planName: 'プレミアムプラン',
            price: 500,
            currency: 'JPY',
            revenueCatId: event.subscriber.subscriber_attributes?.['$revenueCatId'] || '',
            platform: event.store === 'APP_STORE' ? 'ios' : 'android',
            originalTransactionId: event.original_transaction_id,
            latestTransactionId: event.transaction_id,
            productId,
            currentPeriodStart: new Date(event.purchased_at_ms).toISOString(),
            currentPeriodEnd: expirationDate,
            nextRenewalDate: expirationDate,
            isCanceled: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          break;

        case 'CANCELLATION':
          await subRef.update({
            isCanceled: true,
            canceledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          break;

        case 'EXPIRATION':
          await subRef.update({
            status: 'expired',
            updatedAt: new Date().toISOString(),
          });
          break;

        case 'BILLING_ISSUE':
          await subRef.update({
            status: 'paused',
            updatedAt: new Date().toISOString(),
          });
          break;

        default:
          console.log('Unknown event type:', eventType);
      }

      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('Error processing RevenueCat webhook:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 6.2 サブスクリプション情報取得

**エンドポイント**: `GET /api/v1/users/{userId}/subscription`

**目的**: ユーザーのサブスクリプション情報を取得します。

**認証**: 必須

**レスポンス**:

```typescript
interface GetSubscriptionResponse {
  success: true;
  data: {
    planId: 'free' | 'premium';
    status: 'active' | 'canceled' | 'expired' | 'trial' | 'paused';
    planName: string;
    price: number;
    currency: string;
    currentPeriodEnd?: string;
    isCanceled: boolean;
  };
}
```

**実装例**:

```typescript
export const getSubscription = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // サブスクリプション情報を取得
      const db = getFirestore();
      const subDoc = await db.collection('subscriptions').doc(userId).get();

      if (!subDoc.exists) {
        // デフォルトは無料プラン
        return res.status(200).json({
          success: true,
          data: {
            planId: 'free',
            status: 'active',
            planName: '無料プラン',
            price: 0,
            currency: 'JPY',
            isCanceled: false,
          }
        });
      }

      const sub = subDoc.data();

      return res.status(200).json({
        success: true,
        data: {
          planId: sub.planId,
          status: sub.status,
          planName: sub.planName,
          price: sub.price,
          currency: sub.currency,
          currentPeriodEnd: sub.currentPeriodEnd,
          isCanceled: sub.isCanceled,
        }
      });

    } catch (error) {
      console.error('Error getting subscription:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

## 7. 通知API

### 7.1 通知一覧取得

**エンドポイント**: `GET /api/v1/users/{userId}/notifications`

**目的**: ユーザーの通知一覧を取得します。

**認証**: 必須

**クエリパラメータ**:

| 名前 | 型 | 必須 | デフォルト | 説明 |
|-----|---|------|----------|------|
| `page` | number | ❌ | 1 | ページ番号 |
| `limit` | number | ❌ | 20 | 1ページあたりの件数 |
| `unreadOnly` | boolean | ❌ | false | 未読のみ |

**レスポンス**:

```typescript
interface GetNotificationsResponse {
  success: true;
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

**実装例**:

```typescript
export const getNotifications = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // クエリパラメータ
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      // Firestoreクエリ
      const db = getFirestore();
      let query = db.collection('notifications')
        .where('userId', '==', userId);

      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      query = query.orderBy('createdAt', 'desc');

      // 総数を取得
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // ページネーション
      const offset = (page - 1) * limit;
      query = query.offset(offset).limit(limit);

      const snapshot = await query.get();
      const notifications = snapshot.docs.map(doc => doc.data());

      return res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        }
      });

    } catch (error) {
      console.error('Error getting notifications:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 7.2 通知を既読にする

**エンドポイント**: `PATCH /api/v1/notifications/{notificationId}/read`

**目的**: 通知を既読にします。

**認証**: 必須

**実装例**:

```typescript
export const markNotificationAsRead = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const notificationId = req.params.notificationId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // 通知を取得
      const db = getFirestore();
      const notificationDoc = await db.collection('notifications').doc(notificationId).get();

      if (!notificationDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '通知が見つかりません' }
        });
      }

      const notification = notificationDoc.data();

      // 権限チェック
      if (notification.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 既読にする
      await db.collection('notifications').doc(notificationId).update({
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: {
          notificationId,
          isRead: true,
          readAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 7.3 すべての通知を既読にする

**エンドポイント**: `PATCH /api/v1/users/{userId}/notifications/read-all`

**目的**: すべての通知を既読にします。

**認証**: 必須

**実装例**:

```typescript
export const markAllNotificationsAsRead = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 未読の通知を取得
      const db = getFirestore();
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      // バッチで更新
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isRead: true,
          readAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      return res.status(200).json({
        success: true,
        message: `${snapshot.size}件の通知を既読にしました`,
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

**Part 2 完了**

このファイルには以下が含まれています:
- セッション管理API(作成、一覧取得、詳細取得、更新、削除)
- サブスクリプション管理API(RevenueCat Webhook、情報取得)
- 通知API(一覧取得、既読、すべて既読)

次のファイル(Part 3)には以下を含めます:
- GDPR対応API
- BigQuery連携API

---

## 8. GDPR対応API

### 8.1 データエクスポート

**エンドポイント**: `POST /api/v1/users/{userId}/export`

**目的**: ユーザーのデータをエクスポートします(GDPR第20条対応)。

**認証**: 必須

**法的根拠**: プライバシーポリシーv3.1第9.5条、GDPR第20条(データポータビリティの権利)

**リクエスト**:

```typescript
interface ExportDataRequest {
  format: 'json' | 'csv';  // エクスポート形式
}
```

**レスポンス**:

```typescript
interface ExportDataResponse {
  success: true;
  data: {
    exportId: string;
    status: 'pending' | 'processing' | 'completed';
    message: string;
  };
}
```

**実装例**:

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';

const exportDataSchema = z.object({
  format: z.enum(['json', 'csv']),
});

export const exportUserData = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 300,  // 5分
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 入力検証
      const validatedData = exportDataSchema.parse(req.body);

      // エクスポートログを作成
      const db = getFirestore();
      const exportId = db.collection('export_logs').doc().id;
      const exportLog = {
        exportId,
        userId,
        format: validatedData.format,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('export_logs').doc(exportId).set(exportLog);

      // 非同期でエクスポート処理を実行
      processExport(exportId, userId, validatedData.format).catch(error => {
        console.error('Error processing export:', error);
      });

      return res.status(202).json({
        success: true,
        data: {
          exportId,
          status: 'pending',
          message: 'データのエクスポートを開始しました。完了後、ダウンロードURLが通知されます。'
        }
      });

    } catch (error) {
      console.error('Error exporting user data:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);

/**
 * エクスポート処理(非同期)
 */
async function processExport(
  exportId: string,
  userId: string,
  format: 'json' | 'csv'
): Promise<void> {
  const db = getFirestore();
  const storage = getStorage();

  try {
    // ステータスを更新
    await db.collection('export_logs').doc(exportId).update({
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    // 1. ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // 2. セッション情報を取得
    const sessionsSnapshot = await db.collection('sessions')
      .where('userId', '==', userId)
      .get();
    const sessions = sessionsSnapshot.docs.map(doc => doc.data());

    // 3. サブスクリプション情報を取得
    const subDoc = await db.collection('subscriptions').doc(userId).get();
    const subscription = subDoc.exists ? subDoc.data() : null;

    // 4. 同意記録を取得
    const consentsSnapshot = await db.collection('consents')
      .where('userId', '==', userId)
      .get();
    const consents = consentsSnapshot.docs.map(doc => doc.data());

    // 5. データを結合
    const exportData = {
      user: userData,
      sessions,
      subscription,
      consents,
      exportedAt: new Date().toISOString(),
    };

    // 6. ファイルを作成
    let fileContent: string;
    let filename: string;
    let contentType: string;

    if (format === 'json') {
      fileContent = JSON.stringify(exportData, null, 2);
      filename = `user_data_${userId}_${Date.now()}.json`;
      contentType = 'application/json';
    } else {
      // CSV形式(簡略化)
      fileContent = convertToCSV(exportData);
      filename = `user_data_${userId}_${Date.now()}.csv`;
      contentType = 'text/csv';
    }

    // 7. Cloud Storageにアップロード
    const bucket = storage.bucket();
    const file = bucket.file(`exports/${userId}/${filename}`);
    
    await file.save(fileContent, {
      contentType,
      metadata: {
        userId,
        exportId,
      },
    });

    // 8. 署名付きURLを生成(7日間有効)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,  // 7日後
    });

    // 9. エクスポートログを更新
    await db.collection('export_logs').doc(exportId).update({
      status: 'completed',
      filename,
      fileSize: Buffer.byteLength(fileContent),
      storagePath: `exports/${userId}/${filename}`,
      downloadURL: signedUrl,
      updatedAt: new Date().toISOString(),
    });

    // 10. 通知を作成
    await db.collection('notifications').add({
      notificationId: db.collection('notifications').doc().id,
      userId,
      type: 'export_completed',
      title: 'データのエクスポートが完了しました',
      body: 'データをダウンロードできます(7日間有効)',
      actionURL: `/exports/${exportId}`,
      isRead: false,
      isSent: true,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in processExport:', error);

    // エラー状態に更新
    await db.collection('export_logs').doc(exportId).update({
      status: 'failed',
      errorMessage: error.message,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * CSVに変換(簡略化)
 */
function convertToCSV(data: any): string {
  // 実装は省略(実際にはCSVライブラリを使用)
  return '';
}
```

---

### 8.2 エクスポート状態確認

**エンドポイント**: `GET /api/v1/exports/{exportId}`

**目的**: エクスポート処理の状態を確認します。

**認証**: 必須

**レスポンス**:

```typescript
interface GetExportResponse {
  success: true;
  data: {
    exportId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    filename?: string;
    fileSize?: number;
    downloadURL?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

**実装例**:

```typescript
export const getExportStatus = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const exportId = req.params.exportId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // エクスポートログを取得
      const db = getFirestore();
      const exportDoc = await db.collection('export_logs').doc(exportId).get();

      if (!exportDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'エクスポートが見つかりません' }
        });
      }

      const exportData = exportDoc.data();

      // 権限チェック
      if (exportData.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      return res.status(200).json({
        success: true,
        data: exportData
      });

    } catch (error) {
      console.error('Error getting export status:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 8.3 アカウント削除リクエスト

**エンドポイント**: `POST /api/v1/users/{userId}/deletion-request`

**目的**: アカウント削除をリクエストします(GDPR第17条対応)。

**認証**: 必須

**法的根拠**: プライバシーポリシーv3.1第9.6条、GDPR第17条(削除権)

**レスポンス**:

```typescript
interface CreateDeletionRequestResponse {
  success: true;
  data: {
    requestId: string;
    scheduledDeletionAt: string;
    cancelableUntil: string;
    message: string;
  };
}
```

**実装例**:

```typescript
export const createDeletionRequest = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      // 権限チェック
      if (!user || user.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // 既存のリクエストをチェック
      const db = getFirestore();
      const existingRequests = await db.collection('deletion_requests')
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'processing'])
        .get();

      if (!existingRequests.empty) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DELETION_REQUEST_EXISTS',
            message: '既にアカウント削除リクエストが存在します'
          }
        });
      }

      // 削除リクエストを作成
      const requestId = db.collection('deletion_requests').doc().id;
      const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);  // 30日後
      const cancelableUntil = scheduledDeletionAt;

      const deletionRequest = {
        requestId,
        userId,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        scheduledDeletionAt: scheduledDeletionAt.toISOString(),
        cancelableUntil: cancelableUntil.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('deletion_requests').doc(requestId).set(deletionRequest);

      // 通知を作成
      await db.collection('notifications').add({
        notificationId: db.collection('notifications').doc().id,
        userId,
        type: 'deletion_scheduled',
        title: 'アカウント削除リクエストを受け付けました',
        body: `30日後にアカウントが削除されます。${cancelableUntil.toISOString()}までキャンセル可能です。`,
        isRead: false,
        isSent: true,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.status(201).json({
        success: true,
        data: {
          requestId,
          scheduledDeletionAt: scheduledDeletionAt.toISOString(),
          cancelableUntil: cancelableUntil.toISOString(),
          message: 'アカウント削除リクエストを受け付けました。30日後に削除されます。'
        }
      });

    } catch (error) {
      console.error('Error creating deletion request:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 8.4 アカウント削除リクエストキャンセル

**エンドポイント**: `POST /api/v1/deletion-requests/{requestId}/cancel`

**目的**: アカウント削除リクエストをキャンセルします。

**認証**: 必須

**レスポンス**:

```typescript
interface CancelDeletionRequestResponse {
  success: true;
  message: string;
}
```

**実装例**:

```typescript
export const cancelDeletionRequest = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;
      const requestId = req.params.requestId;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // リクエストを取得
      const db = getFirestore();
      const requestDoc = await db.collection('deletion_requests').doc(requestId).get();

      if (!requestDoc.exists) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'リクエストが見つかりません' }
        });
      }

      const request = requestDoc.data();

      // 権限チェック
      if (request.userId !== user.uid) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '権限がありません' }
        });
      }

      // キャンセル可能期限をチェック
      if (new Date() > new Date(request.cancelableUntil)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_CANCEL',
            message: 'キャンセル可能期限を過ぎています'
          }
        });
      }

      // ステータスをチェック
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'キャンセルできない状態です'
          }
        });
      }

      // キャンセル
      await db.collection('deletion_requests').doc(requestId).update({
        status: 'canceled',
        canceledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: 'アカウント削除リクエストをキャンセルしました'
      });

    } catch (error) {
      console.error('Error canceling deletion request:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);
```

---

### 8.5 同意記録の作成

**エンドポイント**: `POST /api/v1/consents`

**目的**: ユーザーの同意を記録します(GDPR第7条対応)。

**認証**: 必須

**法的根拠**: プライバシーポリシーv3.1第9.1条、GDPR第7条(同意)

**リクエスト**:

```typescript
interface CreateConsentRequest {
  type: 'terms_of_service' | 'privacy_policy' | 'data_collection' | 'analytics' | 'marketing';
  version: string;          // ドキュメントのバージョン
  consented: boolean;
  method: 'checkbox' | 'button' | 'implicit';
}
```

**実装例**:

```typescript
const createConsentSchema = z.object({
  type: z.enum(['terms_of_service', 'privacy_policy', 'data_collection', 'analytics', 'marketing']),
  version: z.string(),
  consented: z.boolean(),
  method: z.enum(['checkbox', 'button', 'implicit']),
});

export const createConsent = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '認証が必要です' }
        });
      }

      // 入力検証
      const validatedData = createConsentSchema.parse(req.body);

      // 同意記録を作成
      const db = getFirestore();
      const consentId = db.collection('consents').doc().id;

      // IPアドレスを仮名化(GDPR第4条5項)
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const hashedIp = ipAddress ? pseudonymizeIpAddress(ipAddress as string) : null;

      const consent = {
        consentId,
        userId: user.uid,
        type: validatedData.type,
        version: validatedData.version,
        consented: validatedData.consented,
        method: validatedData.method,
        consentedAt: new Date().toISOString(),
        ipAddress: hashedIp,
        userAgent: req.headers['user-agent'] || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('consents').doc(consentId).set(consent);

      return res.status(201).json({
        success: true,
        data: {
          consentId,
          type: consent.type,
          consented: consent.consented,
          consentedAt: consent.consentedAt,
        }
      });

    } catch (error) {
      console.error('Error creating consent:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'エラーが発生しました' }
      });
    }
  }
);

/**
 * IPアドレスを仮名化
 */
function pseudonymizeIpAddress(ipAddress: string): string {
  const crypto = require('crypto');
  const salt = process.env.PSEUDONYMIZATION_SALT || '';
  return crypto
    .createHash('sha256')
    .update(ipAddress + salt)
    .digest('hex');
}
```

---

## 9. BigQuery連携API

### 9.1 Firestoreデータ取り込み(スケジュール実行)

**関数名**: `syncFirestoreToBigQuery`

**目的**: FirestoreからBigQueryにデータを取り込みます。

**トリガー**: Cloud Scheduler(毎日午前2時)

**法的根拠**: 要件定義書v3.1第9章、BigQuery設計書v3.1第7章

**実装例**:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const syncFirestoreToBigQuery = onSchedule(
  {
    schedule: '0 2 * * *',  // 毎日午前2時(JST)
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 540,    // 9分
    region: 'asia-northeast1',
  },
  async (event) => {
    const startTime = Date.now();
    console.log('Starting Firestore to BigQuery sync...');

    try {
      // 1. 昨日のデータを取得
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 2. Firestoreからデータをエクスポート
      const db = getFirestore();
      
      // ユーザーデータ
      const usersSnapshot = await db.collection('users')
        .where('updatedAt', '>=', yesterday.toISOString())
        .where('updatedAt', '<', today.toISOString())
        .get();

      // セッションデータ
      const sessionsSnapshot = await db.collection('sessions')
        .where('createdAt', '>=', yesterday.toISOString())
        .where('createdAt', '<', today.toISOString())
        .get();

      // サブスクリプションデータ
      const subsSnapshot = await db.collection('subscriptions')
        .where('updatedAt', '>=', yesterday.toISOString())
        .where('updatedAt', '<', today.toISOString())
        .get();

      // 同意記録データ
      const consentsSnapshot = await db.collection('consents')
        .where('createdAt', '>=', yesterday.toISOString())
        .where('createdAt', '<', today.toISOString())
        .get();

      console.log('Data fetched:', {
        users: usersSnapshot.size,
        sessions: sessionsSnapshot.size,
        subscriptions: subsSnapshot.size,
        consents: consentsSnapshot.size,
      });

      // 3. データを仮名化
      const salt = process.env.PSEUDONYMIZATION_SALT || '';

      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          user_hashed: pseudonymizeUserId(data.userId, salt),
          userId: undefined,  // 元のIDは削除
          email: undefined,   // メールアドレスは削除
        };
      });

      const sessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          user_hashed: pseudonymizeUserId(data.userId, salt),
          userId: undefined,
        };
      });

      const subscriptions = subsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          user_hashed: pseudonymizeUserId(data.userId, salt),
          userId: undefined,
        };
      });

      const consents = consentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          user_hashed: pseudonymizeUserId(data.userId, salt),
          userId: undefined,
        };
      });

      // 4. BigQueryに挿入
      const bigquery = new BigQuery();
      const datasetId = 'fitness_app_prod';

      // ユーザーテーブル
      if (users.length > 0) {
        await bigquery
          .dataset(datasetId)
          .table('users')
          .insert(users);
        console.log(`Inserted ${users.length} users`);
      }

      // セッションテーブル
      if (sessions.length > 0) {
        await bigquery
          .dataset(datasetId)
          .table('training_sessions')
          .insert(sessions);
        console.log(`Inserted ${sessions.length} sessions`);
      }

      // サブスクリプションテーブル
      if (subscriptions.length > 0) {
        await bigquery
          .dataset(datasetId)
          .table('subscriptions')
          .insert(subscriptions);
        console.log(`Inserted ${subscriptions.length} subscriptions`);
      }

      // 同意記録テーブル
      if (consents.length > 0) {
        await bigquery
          .dataset(datasetId)
          .table('consent_logs')
          .insert(consents);
        console.log(`Inserted ${consents.length} consents`);
      }

      // 5. エクスポート済みフラグを更新
      const batch = db.batch();
      
      sessionsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          exportedToBigQuery: true,
          exportedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      const elapsedTime = Date.now() - startTime;
      console.log(`Sync completed in ${elapsedTime}ms`);

      return { success: true, elapsedTime };

    } catch (error) {
      console.error('Error syncing to BigQuery:', error);
      throw error;
    }
  }
);

/**
 * ユーザーIDを仮名化
 */
function pseudonymizeUserId(userId: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(userId + salt)
    .digest('hex');
}
```

---

### 9.2 データ品質チェック(スケジュール実行)

**関数名**: `checkBigQueryDataQuality`

**目的**: BigQueryのデータ品質をチェックします。

**トリガー**: Cloud Scheduler(毎日午前3時)

**実装例**:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { BigQuery } from '@google-cloud/bigquery';

export const checkBigQueryDataQuality = onSchedule(
  {
    schedule: '0 3 * * *',  // 毎日午前3時(JST)
    timeZone: 'Asia/Tokyo',
    memory: '256MiB',
    timeoutSeconds: 300,
    region: 'asia-northeast1',
  },
  async (event) => {
    console.log('Starting data quality check...');

    try {
      const bigquery = new BigQuery();
      const datasetId = 'fitness_app_prod';

      // 1. NULL値のチェック
      const nullCheckQuery = `
        SELECT
          'users' AS table_name,
          COUNTIF(user_hashed IS NULL) AS null_user_hashed,
          COUNTIF(display_name IS NULL) AS null_display_name,
          COUNTIF(region IS NULL) AS null_region,
          COUNT(*) AS total_rows
        FROM \`${datasetId}.users\`
        WHERE DATE(created_at) = CURRENT_DATE() - 1

        UNION ALL

        SELECT
          'training_sessions' AS table_name,
          COUNTIF(user_hashed IS NULL) AS null_user_hashed,
          COUNTIF(exercise_id IS NULL) AS null_exercise_id,
          COUNTIF(rep_count IS NULL) AS null_rep_count,
          COUNT(*) AS total_rows
        FROM \`${datasetId}.training_sessions\`
        WHERE DATE(started_at) = CURRENT_DATE() - 1
      `;

      const [nullCheckResults] = await bigquery.query(nullCheckQuery);
      console.log('NULL check results:', nullCheckResults);

      // 2. 重複チェック
      const duplicateCheckQuery = `
        SELECT
          user_hashed,
          COUNT(*) AS duplicate_count
        FROM \`${datasetId}.users\`
        WHERE DATE(created_at) = CURRENT_DATE() - 1
        GROUP BY user_hashed
        HAVING COUNT(*) > 1
      `;

      const [duplicateResults] = await bigquery.query(duplicateCheckQuery);
      console.log('Duplicate check results:', duplicateResults);

      // 3. アラートを送信(必要に応じて)
      const hasIssues = nullCheckResults.some(row => 
        row.null_user_hashed > 0 || duplicateResults.length > 0
      );

      if (hasIssues) {
        console.warn('Data quality issues detected!');
        // ここでSlackやメールで通知
      }

      return { success: true, hasIssues };

    } catch (error) {
      console.error('Error checking data quality:', error);
      throw error;
    }
  }
);
```

---

**Part 3 完了**

このファイルには以下が含まれています:
- GDPR対応API(データエクスポート、エクスポート状態確認、アカウント削除リクエスト、キャンセル、同意記録)
- BigQuery連携API(Firestoreデータ取り込み、データ品質チェック)

次のファイル(Part 4)には以下を含めます:
- エラーハンドリング
- レート制限
- 監視・ロギング
- デプロイ・運用

---

## 10. エラーハンドリング

### 10.1 エラーコード一覧

本プロジェクトで使用するエラーコード:

| コード | HTTPステータス | 説明 | 対処方法 |
|-------|--------------|------|---------|
| **UNAUTHORIZED** | 401 | 認証が必要 | ログインしてください |
| **INVALID_TOKEN** | 401 | トークンが無効 | 再ログインしてください |
| **FORBIDDEN** | 403 | 権限がありません | 権限を確認してください |
| **NOT_FOUND** | 404 | リソースが見つかりません | IDを確認してください |
| **VALIDATION_ERROR** | 400 | 入力エラー | 入力内容を確認してください |
| **AGE_RESTRICTION** | 400 | 年齢制限 | 利用規約を確認してください |
| **FREE_PLAN_LIMIT** | 403 | 無料プラン上限 | プレミアムプランにアップグレードしてください |
| **USER_ALREADY_EXISTS** | 409 | ユーザー既存 | 既に登録されています |
| **DELETION_REQUEST_EXISTS** | 409 | 削除リクエスト既存 | 既にリクエストされています |
| **CANNOT_CANCEL** | 400 | キャンセル不可 | キャンセル可能期限を過ぎています |
| **INVALID_STATUS** | 400 | 状態が無効 | 現在の状態では実行できません |
| **METHOD_NOT_ALLOWED** | 405 | メソッド不許可 | HTTPメソッドを確認してください |
| **RATE_LIMIT_EXCEEDED** | 429 | レート制限超過 | しばらく待ってから再試行してください |
| **INTERNAL_ERROR** | 500 | サーバーエラー | 管理者に連絡してください |
| **SERVICE_UNAVAILABLE** | 503 | サービス停止中 | しばらく待ってから再試行してください |

### 10.2 グローバルエラーハンドラー

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * グローバルエラーハンドラー
 */
export function globalErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Global error handler:', error);

  // Zodバリデーションエラー
  if (error.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力エラー',
        details: error.errors
      }
    });
  }

  // Firebase Authエラー
  if (error.code?.startsWith('auth/')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '認証エラー',
        details: { reason: error.code }
      }
    });
  }

  // Firestoreエラー
  if (error.code === 'not-found') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'リソースが見つかりません'
      }
    });
  }

  // デフォルトエラー
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'エラーが発生しました'
    }
  });
}
```

### 10.3 カスタムエラークラス

```typescript
/**
 * APIエラー基底クラス
 */
export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * 認証エラー
 */
export class UnauthorizedError extends APIError {
  constructor(message: string = '認証が必要です', details?: any) {
    super('UNAUTHORIZED', message, 401, details);
  }
}

/**
 * 権限エラー
 */
export class ForbiddenError extends APIError {
  constructor(message: string = '権限がありません', details?: any) {
    super('FORBIDDEN', message, 403, details);
  }
}

/**
 * 見つからないエラー
 */
export class NotFoundError extends APIError {
  constructor(message: string = 'リソースが見つかりません', details?: any) {
    super('NOT_FOUND', message, 404, details);
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends APIError {
  constructor(message: string = '入力エラー', details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * レート制限エラー
 */
export class RateLimitError extends APIError {
  constructor(message: string = 'レート制限を超過しました', details?: any) {
    super('RATE_LIMIT_EXCEEDED', message, 429, details);
  }
}
```

---

## 11. レート制限

### 11.1 レート制限の実装

**法的根拠**: 要件定義書v3.1 NFR-001

```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;    // 時間窓(ミリ秒)
  maxRequests: number; // 最大リクエスト数
}

/**
 * レート制限ミドルウェア
 */
export function rateLimit(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return next();  // 認証前はスキップ
      }

      const userId = user.uid;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Firestoreでレート制限を管理
      const db = getFirestore();
      const rateLimitRef = db.collection('rate_limits').doc(userId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitRef);

        if (!doc.exists) {
          // 初回リクエスト
          transaction.set(rateLimitRef, {
            requests: [now],
            createdAt: new Date().toISOString(),
          });
          return;
        }

        const data = doc.data();
        const requests = data.requests as number[];

        // 古いリクエストを削除
        const recentRequests = requests.filter(time => time > windowStart);

        // レート制限チェック
        if (recentRequests.length >= config.maxRequests) {
          throw new RateLimitError(
            `レート制限: ${config.maxRequests}リクエスト/${config.windowMs / 1000}秒`,
            {
              limit: config.maxRequests,
              window: config.windowMs / 1000,
              retryAfter: Math.ceil((recentRequests[0] + config.windowMs - now) / 1000),
            }
          );
        }

        // 新しいリクエストを追加
        recentRequests.push(now);

        transaction.update(rateLimitRef, {
          requests: recentRequests,
          updatedAt: new Date().toISOString(),
        });
      });

      next();

    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          }
        });
      }
      next(error);
    }
  };
}

/**
 * 使用例
 */
import express from 'express';
const app = express();

// 100リクエスト/分
app.use('/api/v1', rateLimit({
  windowMs: 60 * 1000,    // 1分
  maxRequests: 100,
}));
```

### 11.2 レート制限の設定

| エンドポイント | 制限 | 窓時間 |
|-------------|------|-------|
| **すべてのAPI** | 100リクエスト | 1分 |
| **セッション作成** | 10リクエスト | 1分 |
| **データエクスポート** | 3リクエスト | 1日 |
| **アカウント削除リクエスト** | 1リクエスト | 1日 |

---

## 12. 監視・ロギング

### 12.1 ロギング

**法的根拠**: 要件定義書v3.1 NFR-017

#### 12.1.1 ロギングミドルウェア

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * リクエストロギングミドルウェア
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // レスポンス終了時にログ
  res.on('finish', () => {
    const elapsedTime = Date.now() - startTime;
    
    console.log({
      type: 'api_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.uid,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      elapsedTime,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}
```

#### 12.1.2 構造化ログ

```typescript
/**
 * 構造化ログヘルパー
 */
export const logger = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      message,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },

  warn: (message: string, data?: any) => {
    console.warn(JSON.stringify({
      severity: 'WARNING',
      message,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },

  error: (message: string, error?: any, data?: any) => {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },
};

/**
 * 使用例
 */
logger.info('User created', { userId: 'abc123' });
logger.error('Failed to create session', error, { userId: 'abc123' });
```

### 12.2 Cloud Monitoring

#### 12.2.1 カスタムメトリクス

```typescript
import { MetricServiceClient } from '@google-cloud/monitoring';

const client = new MetricServiceClient();
const projectId = process.env.GCP_PROJECT || 'ai-fitness-app';

/**
 * カスタムメトリクスを送信
 */
export async function recordMetric(
  metricType: string,
  value: number,
  labels: Record<string, string> = {}
) {
  const dataPoint = {
    interval: {
      endTime: {
        seconds: Date.now() / 1000,
      },
    },
    value: {
      doubleValue: value,
    },
  };

  const timeSeriesData = {
    metric: {
      type: `custom.googleapis.com/${metricType}`,
      labels,
    },
    resource: {
      type: 'global',
      labels: {
        project_id: projectId,
      },
    },
    points: [dataPoint],
  };

  const request = {
    name: `projects/${projectId}`,
    timeSeries: [timeSeriesData],
  };

  try {
    await client.createTimeSeries(request);
  } catch (error) {
    console.error('Error recording metric:', error);
  }
}

/**
 * 使用例
 */
await recordMetric('api/session_created', 1, {
  userId: 'abc123',
  exerciseId: 'squat',
});
```

#### 12.2.2 アラート設定

**Cloud Monitoring Alertsの設定**:

```yaml
# エラーレート アラート
displayName: "High Error Rate"
conditions:
  - displayName: "Error rate > 5%"
    conditionThreshold:
      filter: 'resource.type="cloud_function"'
      comparison: COMPARISON_GT
      thresholdValue: 0.05
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels:
  - email-alerts
  - slack-alerts

# レスポンスタイム アラート
displayName: "Slow Response Time"
conditions:
  - displayName: "95th percentile > 5s"
    conditionThreshold:
      filter: 'metric.type="cloudfunctions.googleapis.com/function/execution_times"'
      comparison: COMPARISON_GT
      thresholdValue: 5000
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          percentileAligner: ALIGN_PERCENTILE_95
notificationChannels:
  - email-alerts
```

### 12.3 Cloud Trace

```typescript
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

/**
 * Cloud Traceの初期化
 */
export function initializeTracing() {
  const provider = new NodeTracerProvider();
  provider.register();

  // Cloud Trace Exporterを登録
  const exporter = new TraceExporter();
  provider.addSpanProcessor(
    new SimpleSpanProcessor(exporter)
  );

  // HTTPリクエストのトレース
  registerInstrumentations({
    instrumentations: [new HttpInstrumentation()],
  });
}

/**
 * 使用例
 */
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('fitness-app');

export async function createSession(req, res) {
  const span = tracer.startSpan('createSession');
  
  try {
    // 処理...
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## 13. デプロイ・運用

### 13.1 ディレクトリ構造

```
functions/
├── src/
│   ├── index.ts                    # エントリーポイント
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── rateLimit.ts
│   │   ├── requestLogger.ts
│   │   └── errorHandler.ts
│   ├── api/
│   │   ├── users.ts
│   │   ├── sessions.ts
│   │   ├── subscriptions.ts
│   │   ├── notifications.ts
│   │   └── gdpr.ts
│   ├── scheduled/
│   │   ├── syncToBigQuery.ts
│   │   └── checkDataQuality.ts
│   ├── webhooks/
│   │   └── revenuecat.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── pseudonymize.ts
│   │   └── logger.ts
│   └── types/
│       └── index.ts
├── .env.example
├── .eslintrc.js
├── .gitignore
├── package.json
├── tsconfig.json
└── firebase.json
```

### 13.2 環境変数

**.env.example**:

```bash
# Firebase
FIREBASE_PROJECT_ID=ai-fitness-app
FIREBASE_REGION=asia-northeast1

# 仮名化
PSEUDONYMIZATION_SALT=<ランダムな64文字の文字列>

# RevenueCat
REVENUECAT_WEBHOOK_SECRET=<RevenueCatのWebhookシークレット>

# BigQuery
BIGQUERY_DATASET_ID=fitness_app_prod

# レート制限
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# その他
NODE_ENV=production
```

### 13.3 デプロイスクリプト

**package.json**:

```json
{
  "name": "fitness-app-functions",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "deploy": "npm run build && firebase deploy --only functions",
    "deploy:prod": "npm run build && firebase deploy --only functions --project production",
    "logs": "firebase functions:log",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "zod": "^3.22.0",
    "@google-cloud/bigquery": "^7.3.0",
    "@google-cloud/storage": "^7.7.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "firebase-functions-test": "^3.1.0",
    "jest": "^29.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0"
  }
}
```

### 13.4 デプロイコマンド

```bash
# ローカルエミュレータで実行
npm run serve

# 本番環境にデプロイ
npm run deploy:prod

# 特定の関数のみデプロイ
firebase deploy --only functions:createUser

# ログ確認
firebase functions:log

# ログ確認(特定の関数)
firebase functions:log --only createUser
```

### 13.5 CI/CDパイプライン

**GitHub Actions(.github/workflows/deploy.yml)**:

```yaml
name: Deploy to Firebase Functions

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd functions
          npm ci

      - name: Build
        run: |
          cd functions
          npm run build

      - name: Run tests
        run: |
          cd functions
          npm test

      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
```

### 13.6 ロールバック

```bash
# 以前のバージョンにロールバック
firebase functions:delete createUser
firebase deploy --only functions:createUser

# または、以前のデプロイをCloud Consoleから復元
```

---

## 14. まとめ

### 14.1 v3.1での主な成果

✅ **法的要件との完全な整合性**:
- 要件定義書v3.1、利用規約v3.1、プライバシーポリシーv3.1と完全に一致
- GDPR/EDPB Guidelines準拠のAPI実装
- 薬機法対応の表現統一

✅ **包括的なAPI設計**:
- ユーザー管理API(登録、取得、更新、削除)
- セッション管理API(CRUD操作)
- サブスクリプション管理API(RevenueCat連携)
- 通知API
- GDPR対応API(データエクスポート、アカウント削除)
- BigQuery連携API

✅ **セキュリティ対策**:
- Firebase Authentication必須
- レート制限の実装
- 入力検証(Zod)
- 仮名化処理

✅ **運用性の向上**:
- 構造化ロギング
- Cloud Monitoring連携
- エラーハンドリング
- CI/CDパイプライン

✅ **パフォーマンス最適化**:
- 適切なメモリ設定
- タイムアウト設定
- レート制限

### 14.2 このAPI設計書により実現できること

✅ **ユーザー管理**: 登録、認証、プロフィール管理  
✅ **セッション管理**: トレーニングセッションのCRUD  
✅ **サブスクリプション管理**: RevenueCatとの連携  
✅ **通知**: プッシュ通知、アプリ内通知  
✅ **GDPR対応**: データエクスポート、アカウント削除  
✅ **BigQuery連携**: 分析用データの取り込み  
✅ **監視・ロギング**: Cloud Monitoring、Cloud Trace  
✅ **セキュリティ**: 認証、認可、レート制限

### 14.3 次のステップ

このAPI設計書v3.1に基づき、以下の作業を進めます:

1. **Phase 1 (0-1ヶ月)**:
   - Firebase Functionsのセットアップ
   - ユーザー管理APIの実装
   - セッション管理APIの実装
   - 認証ミドルウェアの実装

2. **Phase 2 (1-4ヶ月)**:
   - サブスクリプション管理APIの実装
   - RevenueCat Webhookの実装
   - 通知APIの実装
   - GDPR対応APIの実装

3. **Phase 3 (4-8ヶ月)**:
   - BigQuery連携APIの実装
   - データ品質チェックの実装
   - パフォーマンス最適化

4. **Phase 4 (8-12ヶ月)**:
   - ML関連APIの実装
   - 高度な分析機能の追加

### 14.4 関連ドキュメント

| ドキュメント | バージョン | 関連箇所 |
|------------|----------|---------|
| **要件定義書** | v3.1 | 第3章(機能要件)、第4章(非機能要件) |
| **利用規約** | v3.1 | 第1.2条(用語定義)、第6条(課金) |
| **プライバシーポリシー** | v3.1 | 第8条(セキュリティ)、第9条(GDPR) |
| **システムアーキテクチャ設計書** | v3.1 | 第5章、第8章、第9章 |
| **Firestoreデータベース設計書** | v3.1 | 第3章、第4章、第5章 |
| **BigQuery設計書** | v3.1 | 第7章(データ取り込み) |

---

## 15. APIエンドポイント一覧

### 15.1 ユーザー管理

| メソッド | エンドポイント | 説明 | 認証 |
|---------|-------------|------|------|
| POST | `/api/v1/users` | ユーザー登録 | ✅ |
| GET | `/api/v1/users/{userId}` | ユーザー情報取得 | ✅ |
| PATCH | `/api/v1/users/{userId}` | ユーザー情報更新 | ✅ |
| DELETE | `/api/v1/users/{userId}` | ユーザー削除 | ✅ |

### 15.2 セッション管理

| メソッド | エンドポイント | 説明 | 認証 |
|---------|-------------|------|------|
| POST | `/api/v1/sessions` | セッション作成 | ✅ |
| GET | `/api/v1/users/{userId}/sessions` | セッション一覧取得 | ✅ |
| GET | `/api/v1/sessions/{sessionId}` | セッション詳細取得 | ✅ |
| PATCH | `/api/v1/sessions/{sessionId}` | セッション更新 | ✅ |
| DELETE | `/api/v1/sessions/{sessionId}` | セッション削除 | ✅ |

### 15.3 サブスクリプション管理

| メソッド | エンドポイント | 説明 | 認証 |
|---------|-------------|------|------|
| GET | `/api/v1/users/{userId}/subscription` | サブスクリプション情報取得 | ✅ |
| POST | `/api/v1/webhooks/revenuecat` | RevenueCat Webhook | 署名検証 |

### 15.4 通知

| メソッド | エンドポイント | 説明 | 認証 |
|---------|-------------|------|------|
| GET | `/api/v1/users/{userId}/notifications` | 通知一覧取得 | ✅ |
| PATCH | `/api/v1/notifications/{notificationId}/read` | 通知を既読にする | ✅ |
| PATCH | `/api/v1/users/{userId}/notifications/read-all` | すべて既読 | ✅ |

### 15.5 GDPR対応

| メソッド | エンドポイント | 説明 | 認証 |
|---------|-------------|------|------|
| POST | `/api/v1/users/{userId}/export` | データエクスポート | ✅ |
| GET | `/api/v1/exports/{exportId}` | エクスポート状態確認 | ✅ |
| POST | `/api/v1/users/{userId}/deletion-request` | アカウント削除リクエスト | ✅ |
| POST | `/api/v1/deletion-requests/{requestId}/cancel` | 削除リクエストキャンセル | ✅ |
| POST | `/api/v1/consents` | 同意記録作成 | ✅ |

### 15.6 スケジュール実行

| 関数名 | スケジュール | 説明 |
|-------|-----------|------|
| `syncFirestoreToBigQuery` | 毎日午前2時 | FirestoreからBigQueryへデータ取り込み |
| `checkBigQueryDataQuality` | 毎日午前3時 | BigQueryのデータ品質チェック |

---

**API設計書(Firebase Functions) v3.1 完成**

このドキュメントは、AIフィットネスアプリのバックエンドAPIの完全な設計を提供します。
全4パートで構成され、以下をカバーしています:

**Part 1**: 概要、API設計原則、認証、ユーザー管理API  
**Part 2**: セッション管理API、サブスクリプション管理API、通知API  
**Part 3**: GDPR対応API、BigQuery連携API  
**Part 4**: エラーハンドリング、レート制限、監視・ロギング、デプロイ・運用

このAPI設計書に基づいて実装することで、セキュアで拡張性の高い、法令準拠のバックエンドシステムを構築できます。
