# Firestoreデータベース設計書 v1.0

**バージョン**: 1.0
**最終更新日**: 2025年12月9日
**対象**: AIフィットネスアプリ（共通仕様）
**基準**: Expo版要件定義書 v1.0

---

## 目次

1. [ドキュメント概要](#1-ドキュメント概要)
2. [データベース設計原則](#2-データベース設計原則)
3. [Firestore構成概要](#3-firestore構成概要)
4. [Usersコレクション](#4-usersコレクション)
5. [Sessionsコレクション](#5-sessionsコレクション)
6. [Consentsコレクション](#6-consentsコレクション)
7. [DataDeletionRequestsコレクション](#7-datadeletionrequestsコレクション)
8. [BigQuerySyncFailuresコレクション](#8-bigquerysyncfailuresコレクション)
9. [Firestoreセキュリティルール](#9-firestoreセキュリティルール)
10. [インデックス設計](#10-インデックス設計)
11. [データ保持ポリシー](#11-データ保持ポリシー)

---

## 1. ドキュメント概要

### 1.1 目的

本ドキュメントは、AIフィットネスアプリのCloud Firestoreデータベース設計を定義します。

**設計の目標**:
- GDPR完全準拠のデータ管理
- フィールドレベルのセキュリティ制御
- 30日削除猶予期間の実装
- BigQuery連携によるデータ分析基盤

### 1.2 想定読者

- バックエンドエンジニア
- フロントエンドエンジニア（Expo/React Native）
- セキュリティエンジニア
- QAエンジニア

### 1.3 参照ドキュメント

| ドキュメント名 | バージョン | 参照目的 |
|--------------|-----------|---------|
| プロジェクト概要 | v1.0 | プロジェクト全体理解 |
| 機能要件 | v1.0 | 機能要件の詳細 |
| 非機能要件 | v1.0 | パフォーマンス・セキュリティ要件 |

### 1.4 用語定義

| 用語 | 定義 |
|-----|------|
| **骨格座標データ** | MediaPipe Poseが抽出する33個の関節位置（X,Y,Z座標+信頼度） |
| **仮名化** | 個人を特定できる情報を削除・変換して匿名化する処理 |
| **同意管理** | 利用規約・プライバシーポリシーへの同意状態を管理する機能 |
| **削除猶予期間** | アカウント削除リクエストから実際の削除まで30日間の猶予期間 |

---

## 2. データベース設計原則

### 2.1 GDPR準拠設計

**データ最小化の原則**:
- 必要最小限のデータのみを収集・保存
- 各フィールドの収集目的を明確化
- 不要になったデータは自動削除

**プライバシー・バイ・デザイン**:
- デフォルトでプライバシー保護
- 仮名化データと個人データの分離
- アクセス制御をFirestoreルールで実装

**データ主体の権利保障**:
- アクセス権（データエクスポート機能）
- 削除権（30日猶予期間付き完全削除）
- 訂正権（プロフィール更新機能）
- 同意撤回権（強制ログアウト機能）

### 2.2 セキュリティ原則

**ゼロトラストアーキテクチャ**:
- 全てのアクセスを認証・認可
- フィールドレベルのアクセス制御
- 読み取り専用フィールドの保護

**多層防御**:
- Firebase Authentication（認証層）
- Firestoreセキュリティルール（認可層）
- Cloud Functions（ビジネスロジック層）
- BigQuery（分析層・仮名化処理）

### 2.3 命名規則

#### 2.3.1 コレクション名

- **複数形**を使用（例: `users`, `sessions`, `consents`）
- **PascalCase**を使用（例: `DataDeletionRequests`）
- **明確で説明的**な名前を使用

#### 2.3.2 フィールド名

- **camelCase**を使用（例: `createdAt`, `tosAccepted`）
- **boolean**フィールドは`is`または動詞の過去分詞で始める
- **日時**フィールドは`~At`または`~Date`で終わる

---

## 3. Firestore構成概要

### 3.1 コレクション階層

```
firestore/
├── users/                                    # ユーザー情報
│   ├── {userId}/                             # Firebase Auth UID
│   │   ├── sessions/                         # トレーニングセッション
│   │   │   └── {sessionId}/                  # 自動生成ID
│   │   │       └── frames/                   # フレームデータ
│   │   │           └── {frameId}/            # 自動生成ID
│   │   └── subscriptions/                    # サブスクリプション
│   │       └── {subscriptionId}/             # Stripe Subscription ID
│
├── consents/                                 # 同意管理
│   └── {consentId}/                          # 自動生成ID
│
├── dataDeletionRequests/                     # データ削除リクエスト
│   └── {requestId}/                          # 自動生成ID
│
└── bigquerySyncFailures/                     # BigQuery同期失敗
    └── {failureId}/                          # 自動生成ID
```

### 3.2 コレクション一覧

| コレクション名 | 種類 | 目的 | アクセス権 |
|--------------|-----|-----|----------|
| `users` | ルート | ユーザープロフィール情報 | 本人のみ読み書き |
| `users/{userId}/sessions` | サブ | トレーニングセッション記録 | 本人のみ読み書き |
| `users/{userId}/sessions/{sessionId}/frames` | サブ | フレーム単位の骨格座標データ | 本人のみ読み取り |
| `users/{userId}/subscriptions` | サブ | サブスクリプション情報（Stripe連携） | 本人のみ読み取り |
| `consents` | ルート | 同意履歴管理 | 本人のみ読み取り |
| `dataDeletionRequests` | ルート | データ削除リクエスト | 本人のみ読み取り |
| `bigquerySyncFailures` | ルート | BigQuery同期失敗記録 | 管理者のみ |

---

## 4. Usersコレクション

### 4.1 概要

**パス**: `/users/{userId}`
**ドキュメントID**: Firebase Authentication UID
**目的**: ユーザーの基本情報とプロフィールを管理

### 4.2 スキーマ定義

```typescript
interface UserDocument {
  // === 基本情報 ===
  userId: string;                    // Firebase Auth UID（必須）
  email: string;                     // メールアドレス（必須）
  displayName: string | null;        // 表示名（オプション）
  photoURL: string | null;           // プロフィール画像URL（オプション）

  // === プロフィール情報 ===
  profile: {
    height: number | null;           // 身長（cm、オプション）
    weight: number | null;           // 体重（kg、オプション）
    birthday: Timestamp | null;      // 生年月日（オプション）
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | null;
    goals: string[];                 // 目標リスト
  };

  // === 同意管理（GDPR対応） ===
  tosAccepted: boolean;              // 利用規約への同意（必須、読み取り専用）
  tosAcceptedAt: Timestamp | null;   // 利用規約同意日時（読み取り専用）
  tosVersion: string | null;         // 同意した利用規約バージョン（読み取り専用）
  ppAccepted: boolean;               // プライバシーポリシーへの同意（必須、読み取り専用）
  ppAcceptedAt: Timestamp | null;    // プライバシーポリシー同意日時（読み取り専用）
  ppVersion: string | null;          // 同意したプライバシーポリシーバージョン（読み取り専用）

  // === アカウント状態管理 ===
  isActive: boolean;                 // アカウント有効フラグ（必須）
  deletionScheduled: boolean;        // 削除予定フラグ（必須）
  deletionScheduledAt: Timestamp | null;  // 削除予定日時
  scheduledDeletionDate: Timestamp | null;  // 実際の削除予定日（30日後）

  // === 強制ログアウト機能（同意撤回対応） ===
  forceLogout: boolean;              // 強制ログアウトフラグ（必須）
  forceLogoutAt: Timestamp | null;   // 強制ログアウト設定日時

  // === サブスクリプション情報（Stripe連携） ===
  subscriptionStatus: 'free' | 'premium' | 'trial';  // サブスクリプション状態
  subscriptionPlan: string | null;   // プラン名（例: 'monthly_500'）
  stripeCustomerId: string | null;   // Stripe Customer ID
  stripeSubscriptionId: string | null;  // Stripe Subscription ID
  subscriptionStartDate: Timestamp | null;  // サブスクリプション開始日
  subscriptionEndDate: Timestamp | null;    // サブスクリプション終了日

  // === システム管理 ===
  createdAt: Timestamp;              // 作成日時（必須）
  updatedAt: Timestamp;              // 更新日時（必須）
  lastLoginAt: Timestamp | null;     // 最終ログイン日時

  // === データ保持期間管理（GDPR対応） ===
  dataRetentionDate: Timestamp | null;  // データ保持期限日（createdAt + 3年）
}
```

### 4.3 フィールド詳細

#### 4.3.1 基本情報

| フィールド | 型 | 必須 | 説明 | バリデーション |
|-----------|---|-----|------|--------------|
| `userId` | string | ✅ | Firebase Auth UID | 読み取り専用、変更不可 |
| `email` | string | ✅ | メールアドレス | 有効なメール形式、読み取り専用 |
| `displayName` | string \| null | ❌ | 表示名 | 最大100文字 |
| `photoURL` | string \| null | ❌ | プロフィール画像URL | 有効なURL形式 |

**実装上の注意点**:
- `userId`と`email`は**Firebase Authenticationから同期**され、Firestore上では**読み取り専用**
- プロフィール画像は**Firebase Storage**にアップロード後、URLを保存

#### 4.3.2 同意管理（GDPR対応）

| フィールド | 型 | 必須 | 説明 | 重要性 |
|-----------|---|-----|------|--------|
| `tosAccepted` | boolean | ✅ | 利用規約への同意 | **読み取り専用** |
| `tosAcceptedAt` | Timestamp \| null | ❌ | 利用規約同意日時 | **読み取り専用** |
| `tosVersion` | string \| null | ❌ | 同意した利用規約バージョン | **読み取り専用**（例: "1.0"） |
| `ppAccepted` | boolean | ✅ | プライバシーポリシーへの同意 | **読み取り専用** |
| `ppAcceptedAt` | Timestamp \| null | ❌ | プライバシーポリシー同意日時 | **読み取り専用** |
| `ppVersion` | string \| null | ❌ | 同意したプライバシーポリシーバージョン | **読み取り専用**（例: "1.0"） |

**CRITICAL - 読み取り専用の実装**:

同意フィールドは**Cloud Functionsのみが更新可能**です。ユーザーが直接変更することを**Firestoreセキュリティルールで禁止**します。

```javascript
// Firestoreセキュリティルールで強制
allow update: if request.auth != null
              && request.auth.uid == userId
              // 同意フィールドは変更禁止
              && request.resource.data.tosAccepted == resource.data.tosAccepted
              && request.resource.data.tosAcceptedAt == resource.data.tosAcceptedAt
              && request.resource.data.tosVersion == resource.data.tosVersion
              && request.resource.data.ppAccepted == resource.data.ppAccepted
              && request.resource.data.ppAcceptedAt == resource.data.ppAcceptedAt
              && request.resource.data.ppVersion == resource.data.ppVersion;
```

#### 4.3.3 削除猶予期間管理（30日間）

| フィールド | 型 | 必須 | 説明 | バリデーション |
|-----------|---|-----|------|--------------|
| `deletionScheduled` | boolean | ✅ | 削除予定フラグ | デフォルト: false |
| `deletionScheduledAt` | Timestamp \| null | ❌ | 削除予定日時 | 削除リクエスト時に設定 |
| `scheduledDeletionDate` | Timestamp \| null | ❌ | 実際の削除予定日 | deletionScheduledAt + 30日 |

**削除予定ユーザーのアクセス制御**:

```javascript
// Firestoreセキュリティルールで制御
match /users/{userId} {
  // 削除予定ユーザーは読み取りのみ許可（データエクスポート用）
  allow read: if request.auth != null
              && request.auth.uid == userId;

  // 削除予定ユーザーは書き込み禁止
  allow write: if request.auth != null
               && request.auth.uid == userId
               && !resource.data.deletionScheduled
               && !request.resource.data.deletionScheduled;
}
```

**実装上の注意点**:
- `deletionScheduled`が`true`の場合、**新規データ作成・更新を完全禁止**
- 削除予定ユーザーは**データエクスポートのみ可能**（GDPR第20条対応）
- 30日後に`gdpr_executeScheduledDeletions` Cloud Functionが自動実行

#### 4.3.4 サブスクリプション情報（Stripe連携）

| フィールド | 型 | 必須 | 説明 | バリデーション |
|-----------|---|-----|------|--------------|
| `subscriptionStatus` | string | ✅ | サブスクリプション状態 | 'free', 'premium', 'trial' |
| `subscriptionPlan` | string \| null | ❌ | プラン名 | 例: 'monthly_500' |
| `stripeCustomerId` | string \| null | ❌ | Stripe Customer ID | Stripe APIから取得 |
| `stripeSubscriptionId` | string \| null | ❌ | Stripe Subscription ID | Stripe APIから取得 |
| `subscriptionStartDate` | Timestamp \| null | ❌ | サブスクリプション開始日 | - |
| `subscriptionEndDate` | Timestamp \| null | ❌ | サブスクリプション終了日 | - |

**Stripeとの連携**:
- StripeのWebhookイベントを受信してFirestoreを更新
- `subscriptionStatus`は**Stripeの状態と同期**
- 課金状態の変更は**Cloud Functions経由でのみ更新**

**実装上の注意点**:
- 初回登録時は`subscriptionStatus: 'free'`
- プレミアムプラン購入後に`'premium'`に変更
- サブスクリプション終了後は`'free'`に戻る
- Flutter版はRevenueCatを使用するが、Expo版は**Stripe直接連携**

### 4.4 サンプルデータ

```json
{
  "userId": "abc123xyz789",
  "email": "user@example.com",
  "displayName": "山田太郎",
  "photoURL": "https://storage.googleapis.com/bucket/photos/abc123.jpg",

  "profile": {
    "height": 175,
    "weight": 70,
    "birthday": "1990-01-01T00:00:00Z",
    "gender": "male",
    "fitnessLevel": "beginner",
    "goals": ["体重を5kg減らす", "毎日続ける"]
  },

  "tosAccepted": true,
  "tosAcceptedAt": "2025-05-01T10:00:00Z",
  "tosVersion": "1.0",
  "ppAccepted": true,
  "ppAcceptedAt": "2025-05-01T10:00:00Z",
  "ppVersion": "1.0",

  "isActive": true,
  "deletionScheduled": false,
  "deletionScheduledAt": null,
  "scheduledDeletionDate": null,

  "forceLogout": false,
  "forceLogoutAt": null,

  "subscriptionStatus": "free",
  "subscriptionPlan": null,
  "stripeCustomerId": null,
  "stripeSubscriptionId": null,
  "subscriptionStartDate": null,
  "subscriptionEndDate": null,

  "createdAt": "2025-05-01T10:00:00Z",
  "updatedAt": "2025-12-09T15:30:00Z",
  "lastLoginAt": "2025-12-09T15:30:00Z",

  "dataRetentionDate": "2028-12-09T15:30:00Z"
}
```

---

## 5. Sessionsコレクション

### 5.1 概要

**パス**: `/users/{userId}/sessions/{sessionId}`
**ドキュメントID**: 自動生成ID
**目的**: トレーニングセッションの記録と骨格座標データの管理

### 5.2 スキーマ定義

```typescript
interface SessionDocument {
  // === 基本情報 ===
  sessionId: string;                 // セッションID（必須、自動生成）
  userId: string;                    // ユーザーID（必須、親ドキュメント）
  exerciseType: 'squat' | 'pushup' | 'armcurl' | 'sidelateral' | 'shoulderpress';

  // === セッション詳細 ===
  startTime: Timestamp;              // 開始時刻（必須）
  endTime: Timestamp | null;         // 終了時刻（セッション完了時に設定）
  duration: number | null;           // セッション時間（秒）
  status: 'active' | 'completed' | 'cancelled';  // セッション状態

  // === トレーニング結果 ===
  repCount: number;                  // 回数（必須）
  setCount: number;                  // セット数（必須、デフォルト: 1）

  // === フォーム確認補助結果 ===
  formFeedback: {
    overallScore: number;            // 総合スコア（0-100）
    goodFrames: number;              // 良好フレーム数
    warningFrames: number;           // 警告フレーム数
    errorFrames: number;             // エラーフレーム数
    warnings: Array<{
      type: string;                  // 警告タイプ
      count: number;                 // 発生回数
      severity: 'low' | 'medium' | 'high';
    }>;
  };

  // === カメラ設定 ===
  cameraSettings: {
    position: 'front' | 'side';      // カメラ位置
    resolution: string;              // 解像度（例: '1280x720'）
    fps: number;                     // フレームレート（例: 30）
  };

  // === セッションメタデータ ===
  sessionMetadata: {
    totalFrames: number;             // 総フレーム数
    processedFrames: number;         // 処理完了フレーム数
    averageFps: number;              // 平均FPS
    frameDropCount: number;          // フレームドロップ数
    averageConfidence: number;       // 平均信頼度スコア（0-1）

    // MediaPipeパフォーマンス監視
    mediapipePerformance: {
      averageInferenceTime: number;  // 平均推論時間（ms）
      maxInferenceTime: number;      // 最大推論時間（ms）
      minInferenceTime: number;      // 最小推論時間（ms）
    };

    // デバイス情報（低スペック端末の検出用）
    deviceInfo: {
      platform: 'iOS' | 'Android';   // プラットフォーム
      osVersion: string;             // OSバージョン
      deviceModel: string;           // デバイスモデル
      deviceMemory: number | null;   // デバイスメモリ（GB）
    };
  };

  // === BigQuery同期状態 ===
  bigquerySyncStatus: 'pending' | 'synced' | 'failed';
  bigquerySyncedAt: Timestamp | null;
  bigquerySyncError: string | null;
  bigquerySyncRetryCount: number;    // デフォルト: 0

  // === システム管理 ===
  createdAt: Timestamp;              // 作成日時（必須）
  updatedAt: Timestamp;              // 更新日時（必須）

  // === データ保持期間管理 ===
  dataRetentionDate: Timestamp | null;  // データ保持期限日（createdAt + 3年）
}
```

### 5.3 対象種目（Expo版）

| No | 種目名 | exerciseType | カテゴリ | 器具 |
|----|--------|--------------|---------|------|
| 1 | スクワット | `squat` | 下半身 | 不要 |
| 2 | プッシュアップ | `pushup` | 胸 | 不要 |
| 3 | アームカール | `armcurl` | 腕 | ダンベル |
| 4 | サイドレイズ | `sidelateral` | 肩 | ダンベル |
| 5 | ショルダープレス | `shoulderpress` | 肩 | ダンベル |

**Flutter版との違い**:
- Flutter版: スクワット、プッシュアップ、プランク、ランジ、ブリッジ
- Expo版: スクワット、プッシュアップ、**アームカール、サイドレイズ、ショルダープレス**

---

## 6. Consentsコレクション

### 6.1 概要

**パス**: `/consents/{consentId}`
**ドキュメントID**: 自動生成ID
**目的**: 同意変更履歴の不変監査ログ

### 6.2 スキーマ定義

```typescript
interface ConsentDocument {
  consentId: string;                 // 同意ID（自動生成）
  userId: string;                    // ユーザーID
  consentType: 'tos' | 'pp';         // 同意タイプ
  version: string;                   // 同意したバージョン
  action: 'accepted' | 'revoked';    // アクション
  timestamp: Timestamp;              // タイムスタンプ
  ipAddress: string | null;          // IPアドレス
  userAgent: string | null;          // ユーザーエージェント
}
```

**実装上の注意点**:
- 同意履歴は**不変（Immutable）**で削除不可
- GDPR監査証跡として保存
- ユーザーは読み取りのみ可能

---

## 7. DataDeletionRequestsコレクション

### 7.1 概要

**パス**: `/dataDeletionRequests/{requestId}`
**ドキュメントID**: 自動生成ID
**目的**: 30日猶予期間管理

### 7.2 スキーマ定義

```typescript
interface DataDeletionRequest {
  requestId: string;                 // リクエストID
  userId: string;                    // ユーザーID
  requestedAt: Timestamp;            // リクエスト日時
  scheduledDeletionDate: Timestamp;  // 削除予定日（+30日）
  status: 'pending' | 'cancelled' | 'completed';  // ステータス
  completedAt: Timestamp | null;     // 完了日時
  cancelledAt: Timestamp | null;     // キャンセル日時
}
```

---

## 8. BigQuerySyncFailuresコレクション

### 8.1 概要

**パス**: `/bigquerySyncFailures/{failureId}`
**ドキュメントID**: 自動生成ID
**目的**: BigQuery同期失敗の追跡（Dead Letter Queue）

### 8.2 スキーマ定義

```typescript
interface BigQuerySyncFailure {
  failureId: string;                 // 失敗ID
  sessionId: string;                 // セッションID
  userId: string;                    // ユーザーID
  failureReason: string;             // 失敗理由
  retryCount: number;                // リトライ回数
  lastRetryAt: Timestamp | null;     // 最終リトライ日時
  createdAt: Timestamp;              // 作成日時
  resolvedAt: Timestamp | null;      // 解決日時
  status: 'pending' | 'resolved' | 'abandoned';  // ステータス
}
```

---

## 9. Firestoreセキュリティルール

### 9.1 基本原則

- デフォルトは全拒否（明示的に許可したもののみアクセス可能）
- 認証済みユーザーのみアクセス許可
- フィールドレベルでのアクセス制御
- `request.auth.uid`で本人確認を徹底

### 9.2 Usersコレクションのルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isNotScheduledForDeletion() {
      return !resource.data.deletionScheduled;
    }

    // Usersコレクション
    match /users/{userId} {
      // 読み取り: 本人のみ
      allow read: if isAuthenticated() && isOwner(userId);

      // 作成: 本人のみ、初回登録時
      allow create: if isAuthenticated()
                    && isOwner(userId)
                    && request.resource.data.tosAccepted == true
                    && request.resource.data.ppAccepted == true;

      // 更新: 本人のみ、削除予定でない場合のみ
      allow update: if isAuthenticated()
                    && isOwner(userId)
                    && isNotScheduledForDeletion()
                    // 同意フィールドは変更禁止
                    && request.resource.data.tosAccepted == resource.data.tosAccepted
                    && request.resource.data.ppAccepted == resource.data.ppAccepted;

      // 削除: Cloud Functionsのみ
      allow delete: if false;

      // Sessionsサブコレクション
      match /sessions/{sessionId} {
        allow read, write: if isAuthenticated()
                           && isOwner(userId)
                           && isNotScheduledForDeletion();

        // Framesサブコレクション
        match /frames/{frameId} {
          allow read: if isAuthenticated() && isOwner(userId);
          allow write: if isAuthenticated()
                       && isOwner(userId)
                       && isNotScheduledForDeletion();
        }
      }

      // Subscriptionsサブコレクション
      match /subscriptions/{subscriptionId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow write: if false;  // Cloud Functionsのみ
      }
    }

    // Consentsコレクション
    match /consents/{consentId} {
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      allow write: if false;  // Cloud Functionsのみ
    }

    // DataDeletionRequestsコレクション
    match /dataDeletionRequests/{requestId} {
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      allow write: if false;  // Cloud Functionsのみ
    }

    // BigQuerySyncFailuresコレクション
    match /bigquerySyncFailures/{failureId} {
      allow read, write: if false;  // 管理者のみ（Cloud Functionsから）
    }
  }
}
```

---

## 10. インデックス設計

### 10.1 必須インデックス

```json
{
  "indexes": [
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "exerciseType", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dataDeletionRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledDeletionDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "bigquerySyncFailures",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 11. データ保持ポリシー

### 11.1 保持期間

| データ種別 | 保持期間 | 削除方法 |
|-----------|---------|---------|
| ユーザープロフィール | 最終ログインから3年 | Cloud Functions自動削除 |
| トレーニングセッション | 作成から3年 | Cloud Functions自動削除 |
| 仮名化データ（BigQuery） | 2年 | BigQueryパーティショニング自動削除 |
| 同意履歴 | 削除不可 | GDPR監査証跡として保存 |
| 削除リクエスト | 完了後1年 | Cloud Functions自動削除 |

### 11.2 自動削除の実装

```typescript
// 日次バッチ処理で3年以上経過したデータを削除
export const maintenance_deleteExpiredData = functions
  .pubsub
  .schedule('0 3 * * *')  // 毎日午前3時（UTC）
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const expiredUsers = await admin.firestore()
      .collection('users')
      .where('dataRetentionDate', '<=', threeYearsAgo)
      .get();

    for (const doc of expiredUsers.docs) {
      await deleteUserDataCompletely(doc.id);
    }
  });
```

---

## 変更履歴

| バージョン | 日付 | 主な変更内容 |
|-----------|------|-------------|
| **v1.0** | 2025年12月9日 | 初版作成。Flutter版v3.3を基に、Expo版の5種目（スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス）に対応。Stripe決済連携に変更。 |

---

**このドキュメントは、Expo版とFlutter版の両方で共通利用可能です。**

**作成者**: Claude (Documentation Engineer)
**最終確認日**: 2025年12月9日
