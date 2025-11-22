# Firestoreデータベース設計書 v3.1

**プロジェクト名**: AIフィットネスアプリ(仮称)  
**バージョン**: 3.1  
**作成日**: 2025年11月21日  
**最終更新日**: 2025年11月21日  
**対象期間**: Phase 1-2 (0-4ヶ月)

---

## 📝 v3.1での主な変更点

### 法的要件との完全な整合性

✅ **要件定義書v3.1との整合**:
- 全31機能要件に対応するデータモデル
- GDPR対応機能(FR-024〜027)のデータ構造
- データ収集機能(FR-028〜029)の実装

✅ **利用規約v3.1との整合**:
- 第1.2条: 用語定義に基づくフィールド名
- 第3.3条: 医療機器でない旨をメタデータに反映
- 第6条: サブスクリプション管理の詳細設計

✅ **プライバシーポリシーv3.1との整合**:
- 第8条: Security Rulesによるアクセス制御
- 第9条: GDPR権利行使のためのデータ構造
- データ最小化の原則を反映

✅ **システムアーキテクチャ設計書v3.1との整合**:
- セキュリティアーキテクチャの実装
- データフローの具体化
- パフォーマンス最適化のためのインデックス設計

---

## 目次

1. [概要](#1-概要)
2. [データベース設計原則](#2-データベース設計原則)
3. [コレクション構造](#3-コレクション構造)
4. [データモデル詳細](#4-データモデル詳細)
5. [Security Rules](#5-security-rules)
6. [インデックス設計](#6-インデックス設計)
7. [データ移行](#7-データ移行)
8. [パフォーマンス最適化](#8-パフォーマンス最適化)
9. [バックアップ・復旧](#9-バックアップ復旧)
10. [運用](#10-運用)

---

## 1. 概要

### 1.1 ドキュメントの目的

本ドキュメントは、Firestoreデータベースの設計を定義し、以下を明確にします:

1. **コレクション構造**: データの論理的な構成
2. **データモデル**: 各コレクションのフィールド定義
3. **Security Rules**: アクセス制御ルール
4. **インデックス**: クエリ最適化
5. **運用**: バックアップ、移行、監視

### 1.2 参照ドキュメント

| ドキュメント | バージョン | 参照箇所 |
|------------|----------|---------|
| **要件定義書** | v3.1 | 第3章(機能要件)、第4章(非機能要件) |
| **利用規約** | v3.1 | 第1.2条(用語定義)、第6条(課金) |
| **プライバシーポリシー** | v3.1 | 第8条(セキュリティ)、第9条(GDPR) |
| **システムアーキテクチャ設計書** | v3.1 | 第6章(データ層)、第8章(セキュリティ) |

### 1.3 Firestore概要

**選定理由**:
- リアルタイム同期
- 自動スケーリング
- 強力なクエリ機能
- Security Rulesによるアクセス制御
- Offline対応

**制約**:
- ドキュメントサイズ: 最大1MB
- コレクション深度: 最大100レベル
- 書き込み速度: 1ドキュメント/秒
- インデックス数: 最大200個/コレクション

---

## 2. データベース設計原則

### 2.1 NoSQL設計原則

#### 2.1.1 非正規化

**RDBMSとの違い**:

| RDBMS | Firestore |
|-------|-----------|
| 正規化が基本 | 非正規化が基本 |
| JOINで結合 | 埋め込みまたは複数読み取り |
| トランザクション | 限定的なトランザクション |

**非正規化の例**:

```typescript
// ❌ RDBMS的な正規化(Firestoreでは非推奨)
sessions/{sessionId} {
  userId: "user123",
  exerciseId: "exercise456"
}

// ✅ 非正規化(Firestoreでは推奨)
sessions/{sessionId} {
  userId: "user123",
  exerciseId: "exercise456",
  exerciseName: "スクワット",      // 非正規化
  exerciseCategory: "自重",        // 非正規化
  userDisplayName: "山田太郎"      // 非正規化
}
```

**メリット**:
- 読み取り回数の削減
- クエリのシンプル化
- パフォーマンス向上

**デメリット**:
- データの重複
- 更新時の整合性維持が必要

#### 2.1.2 データモデリング戦略

**読み取り優先設計**:
- 読み取りが多い場合: 非正規化
- 書き込みが多い場合: 正規化

**本プロジェクトの設計方針**:
- セッションデータ: 読み取り多 → 非正規化
- ユーザープロフィール: 更新少 → 正規化
- 種目マスター: 読み取りのみ → 正規化

### 2.2 プライバシーバイデザイン

**GDPR第25条準拠**(プライバシーポリシーv3.1第8条):

| 原則 | 実装 |
|-----|------|
| **データ最小化** | 必要最小限のフィールドのみ定義 |
| **目的制限** | 各フィールドに利用目的を明記 |
| **保存期間制限** | TTLフィールドで自動削除 |
| **アクセス制御** | Security Rulesで厳格に制御 |
| **暗号化** | Firestore自動暗号化(AES-256) |

### 2.3 命名規則

#### 2.3.1 コレクション名

- **複数形**: `users`, `sessions`, `exercises`
- **小文字**: `notifications` (not `Notifications`)
- **スネークケース**: `export_logs` (not `exportLogs`)

#### 2.3.2 フィールド名

- **キャメルケース**: `userId`, `createdAt`
- **明確な命名**: `repCount` (not `reps`)
- **ブール値**: `isActive` (not `active`)

#### 2.3.3 ドキュメントID

- **自動生成**: Firestore自動ID(推奨)
- **カスタムID**: ユーザーIDなど一意な値
- **避けるべき**: 連番、タイムスタンプ(ホットスポット)

---

## 3. コレクション構造

### 3.1 全体構造図

```
firestore/
│
├── users/                              # ユーザー情報
│   └── {userId}/
│       ├── [fields]                    # プロフィール、設定、同意記録
│       └── (サブコレクションなし)
│
├── exercises/                          # 種目マスターデータ
│   └── {exerciseId}/
│       └── [fields]                    # 種目情報、MediaPipe設定
│
├── sessions/                           # トレーニングセッション
│   └── {sessionId}/
│       └── [fields]                    # セッションデータ、参考スコア
│
├── notifications/                      # 通知
│   └── {notificationId}/
│       └── [fields]                    # 通知内容、既読状態
│
├── subscriptions/                      # サブスクリプション
│   └── {userId}/                       # ドキュメントID = userId
│       └── [fields]                    # プラン情報、有効期限
│
├── consents/                           # 同意記録(GDPR対応)
│   └── {consentId}/
│       └── [fields]                    # 同意内容、取得日時
│
├── export_logs/                        # データエクスポート履歴
│   └── {exportId}/
│       └── [fields]                    # エクスポート情報、有効期限
│
├── deletion_requests/                  # 削除リクエスト
│   └── {requestId}/
│       └── [fields]                    # 削除対象、猶予期間
│
└── app_settings/                       # アプリ設定(管理用)
    └── {settingKey}/
        └── [fields]                    # メンテナンス情報、機能フラグ
```

### 3.2 コレクション概要

| コレクション | 目的 | 読み取り頻度 | 書き込み頻度 | 法的根拠 |
|------------|------|------------|------------|---------|
| **users** | ユーザー情報管理 | 高 | 低 | 利用規約第5条 |
| **exercises** | 種目マスター | 高 | 極低 | - |
| **sessions** | トレーニング記録 | 高 | 中 | 要件定義書FR-009 |
| **notifications** | 通知管理 | 中 | 中 | 要件定義書FR-018 |
| **subscriptions** | 課金管理 | 中 | 低 | 利用規約第6条 |
| **consents** | 同意記録 | 低 | 低 | プライバシーポリシー第9.1条 |
| **export_logs** | エクスポート履歴 | 低 | 低 | プライバシーポリシー第9.5条 |
| **deletion_requests** | 削除リクエスト | 低 | 極低 | プライバシーポリシー第9.6条 |
| **app_settings** | アプリ設定 | 低 | 極低 | - |

---

## 4. データモデル詳細

### 4.1 users コレクション

**目的**: ユーザーの基本情報、設定、プロフィールを管理

**法的根拠**: 利用規約v3.1第5条、プライバシーポリシーv3.1第4.2条

#### 4.1.1 スキーマ定義

```typescript
interface User {
  // ========================================
  // 基本情報
  // ========================================
  
  /** ユーザーID(Firebase Authentication UID) */
  userId: string;
  
  /** メールアドレス */
  email: string;
  
  /** 表示名 */
  displayName: string | null;
  
  /** プロフィール画像URL */
  photoURL: string | null;
  
  /** 生年月日(年齢確認用、暗号化保存) */
  dateOfBirth: Timestamp;
  
  /** 地域(年齢制限判定用) */
  region: 'JP' | 'EEA' | 'OTHER';
  
  /** 認証プロバイダー */
  provider: 'email' | 'google' | 'apple';
  
  // ========================================
  // プロフィール
  // ========================================
  
  profile?: {
    /** 身長(cm) */
    height?: number;
    
    /** 体重(kg) */
    weight?: number;
    
    /** トレーニング目標 */
    goal?: string;
    
    /** トレーニング経験 */
    experience?: 'beginner' | 'intermediate' | 'advanced';
  };
  
  // ========================================
  // 設定
  // ========================================
  
  settings: {
    /** 通知設定 */
    notifications: {
      /** トレーニングリマインダー */
      training: boolean;
      
      /** お知らせ通知 */
      news: boolean;
      
      /** プッシュ通知トークン(FCM) */
      fcmToken?: string;
    };
    
    /** プライバシー設定 */
    privacy: {
      /** データ収集への同意(FR-028, FR-029) */
      dataCollection: boolean;
      
      /** 分析データ利用への同意(任意) */
      analytics: boolean;
      
      /** マーケティング利用への同意(任意) */
      marketing: boolean;
    };
    
    /** 表示設定 */
    display?: {
      /** 言語 */
      language: 'ja' | 'en';
      
      /** テーマ */
      theme: 'light' | 'dark' | 'system';
    };
  };
  
  // ========================================
  // 同意記録(GDPR対応)
  // ========================================
  
  consents: {
    /** 利用規約への同意 */
    termsOfService: {
      /** バージョン */
      version: string;
      
      /** 同意日時 */
      acceptedAt: Timestamp;
      
      /** IPアドレス(仮名化) */
      ipAddress?: string;
    };
    
    /** プライバシーポリシーへの同意 */
    privacyPolicy: {
      version: string;
      acceptedAt: Timestamp;
      ipAddress?: string;
    };
    
    /** データ収集への同意(任意) */
    dataCollection?: {
      version: string;
      acceptedAt: Timestamp;
      revokedAt?: Timestamp;
    };
  };
  
  // ========================================
  // 統計情報(キャッシュ)
  // ========================================
  
  stats?: {
    /** 総セッション数 */
    totalSessions: number;
    
    /** 総トレーニング時間(秒) */
    totalDuration: number;
    
    /** 最終トレーニング日 */
    lastTrainingAt?: Timestamp;
  };
  
  // ========================================
  // メタデータ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
  
  /** 削除予定日時(論理削除用、30日猶予期間) */
  scheduledForDeletion?: Timestamp;
  
  /** アカウントステータス */
  status: 'active' | 'suspended' | 'pending_deletion';
}
```

#### 4.1.2 ドキュメント例

```json
{
  "userId": "abc123xyz",
  "email": "user@example.com",
  "displayName": "山田太郎",
  "photoURL": null,
  "dateOfBirth": "1990-01-01T00:00:00Z",
  "region": "JP",
  "provider": "email",
  
  "profile": {
    "height": 175,
    "weight": 70,
    "goal": "筋力向上",
    "experience": "intermediate"
  },
  
  "settings": {
    "notifications": {
      "training": true,
      "news": true,
      "fcmToken": "fcm_token_here"
    },
    "privacy": {
      "dataCollection": true,
      "analytics": false,
      "marketing": false
    },
    "display": {
      "language": "ja",
      "theme": "system"
    }
  },
  
  "consents": {
    "termsOfService": {
      "version": "v3.1",
      "acceptedAt": "2025-11-21T10:00:00Z",
      "ipAddress": "192.168.1.0"
    },
    "privacyPolicy": {
      "version": "v3.1",
      "acceptedAt": "2025-11-21T10:00:00Z",
      "ipAddress": "192.168.1.0"
    },
    "dataCollection": {
      "version": "v1.0",
      "acceptedAt": "2025-11-21T10:00:00Z"
    }
  },
  
  "stats": {
    "totalSessions": 150,
    "totalDuration": 45000,
    "lastTrainingAt": "2025-11-21T10:00:00Z"
  },
  
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-11-21T10:00:00Z",
  "status": "active"
}
```

#### 4.1.3 バリデーションルール

```typescript
class UserValidator {
  static validate(user: Partial<User>): string[] {
    const errors: string[] = [];
    
    // メールアドレス
    if (user.email && !this.isValidEmail(user.email)) {
      errors.push('無効なメールアドレス');
    }
    
    // 年齢確認
    if (user.dateOfBirth) {
      const age = this.calculateAge(user.dateOfBirth);
      if (user.region === 'JP' && age < 13) {
        errors.push('日本では13歳以上が必要です');
      }
      if (user.region === 'EEA' && age < 16) {
        errors.push('EEAでは16歳以上が必要です');
      }
    }
    
    // プロフィール
    if (user.profile?.height && (user.profile.height < 100 || user.profile.height > 250)) {
      errors.push('身長は100〜250cmの範囲で入力してください');
    }
    
    if (user.profile?.weight && (user.profile.weight < 30 || user.profile.weight > 200)) {
      errors.push('体重は30〜200kgの範囲で入力してください');
    }
    
    return errors;
  }
  
  private static isValidEmail(email: string): boolean {
    return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
  }
  
  private static calculateAge(dateOfBirth: Timestamp): number {
    const today = new Date();
    const birthDate = dateOfBirth.toDate();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}
```

---

### 4.2 exercises コレクション

**目的**: トレーニング種目のマスターデータ管理

**法的根拠**: 要件定義書v3.1 FR-013, FR-014

#### 4.2.1 スキーマ定義

```typescript
interface Exercise {
  // ========================================
  // 基本情報
  // ========================================
  
  /** 種目ID */
  exerciseId: string;
  
  /** 種目名(日本語) */
  name: string;
  
  /** 種目名(英語、Phase 3以降) */
  nameEn?: string;
  
  /** 説明 */
  description: string;
  
  /** 手順 */
  instructions: string[];
  
  // ========================================
  // 分類
  // ========================================
  
  /** カテゴリー */
  category: 'bodyweight' | 'dumbbell' | 'barbell' | 'machine';
  
  /** ターゲット筋肉 */
  targetMuscles: string[];
  
  /** 難易度 */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  /** タグ */
  tags: string[];
  
  // ========================================
  // MediaPipe設定
  // ========================================
  
  mediapipeConfig: {
    /** 監視する骨格ポイント */
    keyPoints: string[];
    
    /** 角度の閾値 */
    thresholds: {
      [key: string]: {
        min: number;
        max: number;
        ideal: number;
      };
    };
    
    /** カウント判定ロジック */
    countingLogic: {
      /** 開始姿勢 */
      startPose: string;
      
      /** 最下点/最上点 */
      peakPose: string;
      
      /** 完了姿勢 */
      endPose: string;
    };
  };
  
  // ========================================
  // メディア
  // ========================================
  
  /** サムネイル画像URL */
  thumbnailURL?: string;
  
  /** デモ動画URL */
  videoURL?: string;
  
  /** GIF画像URL */
  gifURL?: string;
  
  // ========================================
  // メタデータ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
  
  /** 公開状態 */
  isPublished: boolean;
  
  /** 順序(表示順) */
  order: number;
}
```

#### 4.2.2 ドキュメント例(スクワット)

```json
{
  "exerciseId": "squat",
  "name": "スクワット",
  "nameEn": "Squat",
  "description": "下半身を鍛える基本的なトレーニング種目です。",
  "instructions": [
    "足を肩幅に開いて立ちます",
    "つま先を少し外側に向けます",
    "お尻を後ろに引きながら膝を曲げます",
    "太ももが床と平行になるまで下ろします",
    "かかとで床を押して元の姿勢に戻ります"
  ],
  
  "category": "bodyweight",
  "targetMuscles": ["大腿四頭筋", "大臀筋", "ハムストリング"],
  "difficulty": "beginner",
  "tags": ["自重", "下半身", "初心者向け"],
  
  "mediapipeConfig": {
    "keyPoints": [
      "LEFT_HIP",
      "LEFT_KNEE",
      "LEFT_ANKLE",
      "RIGHT_HIP",
      "RIGHT_KNEE",
      "RIGHT_ANKLE"
    ],
    "thresholds": {
      "kneeAngle": {
        "min": 70,
        "max": 180,
        "ideal": 90
      },
      "hipAngle": {
        "min": 60,
        "max": 180,
        "ideal": 90
      }
    },
    "countingLogic": {
      "startPose": "standing",
      "peakPose": "squat_bottom",
      "endPose": "standing"
    }
  },
  
  "thumbnailURL": "https://storage.googleapis.com/fitness-app/exercises/squat_thumb.jpg",
  "videoURL": "https://storage.googleapis.com/fitness-app/exercises/squat_demo.mp4",
  "gifURL": "https://storage.googleapis.com/fitness-app/exercises/squat.gif",
  
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-11-21T00:00:00Z",
  "isPublished": true,
  "order": 1
}
```

---

### 4.3 sessions コレクション

**目的**: トレーニングセッションの記録管理

**法的根拠**: 要件定義書v3.1 FR-009〜012, プライバシーポリシーv3.1第4.1条

#### 4.3.1 スキーマ定義

```typescript
interface TrainingSession {
  // ========================================
  // 識別子
  // ========================================
  
  /** セッションID(自動生成) */
  sessionId: string;
  
  /** ユーザーID */
  userId: string;
  
  /** 種目ID */
  exerciseId: string;
  
  // ========================================
  // 非正規化フィールド(パフォーマンス最適化)
  // ========================================
  
  /** 種目名(コピー) */
  exerciseName: string;
  
  /** カテゴリー(コピー) */
  exerciseCategory: string;
  
  // ========================================
  // トレーニングデータ
  // ========================================
  
  /** レップ数 */
  repCount: number;
  
  /** セット数 */
  setCount: number;
  
  /** トレーニング時間(秒) */
  duration: number;
  
  /** 使用重量(kg、ダンベル等) */
  weight?: number;
  
  /** メモ */
  notes?: string;
  
  // ========================================
  // 参考スコア(利用規約第1.2条「参考スコア」)
  // ========================================
  
  /** 平均参考スコア(0-100) */
  averageScore: number;
  
  /** 各レップの参考スコア */
  scores: number[];
  
  /** 最高参考スコア */
  maxScore: number;
  
  /** 最低参考スコア */
  minScore: number;
  
  // ========================================
  // 骨格座標データ(FR-028)
  // ========================================
  
  /** 
   * 骨格座標データの参照
   * 注意: 大量データのためCloud Storageに保存し、パスのみ保持
   * またはBigQueryにエクスポート後、Firestoreには保存しない
   */
  landmarksRef?: string;
  
  /** 
   * サマリー統計(分析用)
   * 詳細な骨格座標はBigQueryに保存
   */
  landmarksSummary?: {
    /** フレーム数 */
    frameCount: number;
    
    /** 平均可視性スコア */
    averageVisibility: number;
    
    /** データ品質 */
    quality: 'high' | 'medium' | 'low';
  };
  
  // ========================================
  // メタデータ(FR-029)
  // ========================================
  
  metadata: {
    /** アプリバージョン */
    appVersion: string;
    
    /** デバイス情報 */
    deviceInfo: {
      os: 'iOS' | 'Android';
      osVersion: string;
      model: string;
    };
    
    /** MediaPipeバージョン */
    mediapipeVersion: string;
    
    /** 処理時間(ms) */
    processingTime?: number;
  };
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
  
  /** BigQueryエクスポート済みフラグ */
  exportedToBigQuery?: boolean;
  
  /** BigQueryエクスポート日時 */
  exportedAt?: Timestamp;
}
```

#### 4.3.2 ドキュメント例

```json
{
  "sessionId": "session_abc123",
  "userId": "user_xyz789",
  "exerciseId": "squat",
  
  "exerciseName": "スクワット",
  "exerciseCategory": "bodyweight",
  
  "repCount": 10,
  "setCount": 3,
  "duration": 180,
  "weight": null,
  "notes": "フォームを意識して丁寧に実施",
  
  "averageScore": 85.5,
  "scores": [82, 85, 88, 87, 86, 85, 84, 86, 87, 85],
  "maxScore": 88,
  "minScore": 82,
  
  "landmarksRef": null,
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
  },
  
  "createdAt": "2025-11-21T10:00:00Z",
  "updatedAt": "2025-11-21T10:03:00Z",
  "exportedToBigQuery": true,
  "exportedAt": "2025-11-21T10:05:00Z"
}
```

---

### 4.4 subscriptions コレクション

**目的**: サブスクリプション(課金)情報の管理

**法的根拠**: 利用規約v3.1第6条

#### 4.4.1 スキーマ定義

```typescript
interface Subscription {
  // ========================================
  // 基本情報
  // ========================================
  
  /** ユーザーID(ドキュメントIDと同じ) */
  userId: string;
  
  // ========================================
  // プラン情報
  // ========================================
  
  /** プランID */
  planId: 'free' | 'premium';
  
  /** ステータス */
  status: 'active' | 'canceled' | 'expired' | 'trial' | 'paused';
  
  /** プラン名 */
  planName: string;
  
  /** 価格(円) */
  price: number;
  
  /** 通貨 */
  currency: 'JPY';
  
  // ========================================
  // RevenueCat連携
  // ========================================
  
  /** RevenueCat顧客ID */
  revenueCatId: string;
  
  /** プラットフォーム */
  platform: 'ios' | 'android';
  
  /** 元のトランザクションID */
  originalTransactionId: string;
  
  /** 最新のトランザクションID */
  latestTransactionId: string;
  
  /** プロダクトID */
  productId: string;
  
  // ========================================
  // 期間
  // ========================================
  
  /** 現在の期間開始日 */
  currentPeriodStart: Timestamp;
  
  /** 現在の期間終了日 */
  currentPeriodEnd: Timestamp;
  
  /** 無料トライアル終了日 */
  trialEnd?: Timestamp;
  
  /** 次回更新日 */
  nextRenewalDate?: Timestamp;
  
  // ========================================
  // キャンセル情報
  // ========================================
  
  /** キャンセル済みフラグ */
  isCanceled: boolean;
  
  /** キャンセル日時 */
  canceledAt?: Timestamp;
  
  /** キャンセル理由 */
  cancelReason?: string;
  
  /** 期間終了時の動作 */
  cancelAtPeriodEnd: boolean;
  
  // ========================================
  // 履歴
  // ========================================
  
  /** 購入日時 */
  purchasedAt: Timestamp;
  
  /** 更新回数 */
  renewalCount: number;
  
  /** 総支払額 */
  totalPaid: number;
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
}
```

#### 4.4.2 ドキュメント例

```json
{
  "userId": "user_xyz789",
  
  "planId": "premium",
  "status": "active",
  "planName": "プレミアムプラン",
  "price": 500,
  "currency": "JPY",
  
  "revenueCatId": "rc_user_xyz789",
  "platform": "ios",
  "originalTransactionId": "1000000123456789",
  "latestTransactionId": "1000000123456790",
  "productId": "com.example.fitnessapp.premium.monthly",
  
  "currentPeriodStart": "2025-11-01T00:00:00Z",
  "currentPeriodEnd": "2025-12-01T00:00:00Z",
  "trialEnd": "2025-11-08T00:00:00Z",
  "nextRenewalDate": "2025-12-01T00:00:00Z",
  
  "isCanceled": false,
  "cancelAtPeriodEnd": false,
  
  "purchasedAt": "2025-11-01T00:00:00Z",
  "renewalCount": 1,
  "totalPaid": 500,
  
  "createdAt": "2025-11-01T00:00:00Z",
  "updatedAt": "2025-11-21T10:00:00Z"
}
```

---

### 4.5 notifications コレクション

**目的**: プッシュ通知の管理

**法的根拠**: 要件定義書v3.1 FR-018, FR-019

#### 4.5.1 スキーマ定義

```typescript
interface Notification {
  // ========================================
  // 基本情報
  // ========================================
  
  /** 通知ID */
  notificationId: string;
  
  /** ユーザーID */
  userId: string;
  
  // ========================================
  // 通知内容
  // ========================================
  
  /** 通知タイプ */
  type: 'training_reminder' | 'news' | 'system' | 'achievement';
  
  /** タイトル */
  title: string;
  
  /** 本文 */
  body: string;
  
  /** アイコンURL */
  iconURL?: string;
  
  /** 画像URL */
  imageURL?: string;
  
  /** アクションURL(ディープリンク) */
  actionURL?: string;
  
  // ========================================
  // 状態
  // ========================================
  
  /** 既読フラグ */
  isRead: boolean;
  
  /** 既読日時 */
  readAt?: Timestamp;
  
  /** 送信済みフラグ */
  isSent: boolean;
  
  /** 送信日時 */
  sentAt?: Timestamp;
  
  // ========================================
  // スケジュール
  // ========================================
  
  /** 配信予定日時 */
  scheduledAt?: Timestamp;
  
  /** 有効期限 */
  expiresAt?: Timestamp;
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
}
```

---

### 4.6 consents コレクション

**目的**: ユーザーの同意記録(GDPR対応)

**法的根拠**: プライバシーポリシーv3.1第9.1条、GDPR第7条

#### 4.6.1 スキーマ定義

```typescript
interface Consent {
  // ========================================
  // 基本情報
  // ========================================
  
  /** 同意ID */
  consentId: string;
  
  /** ユーザーID */
  userId: string;
  
  // ========================================
  // 同意内容
  // ========================================
  
  /** 同意タイプ */
  type: 'terms_of_service' | 'privacy_policy' | 'data_collection' | 'analytics' | 'marketing';
  
  /** ドキュメントバージョン */
  version: string;
  
  /** 同意したかどうか */
  consented: boolean;
  
  /** 同意方法 */
  method: 'checkbox' | 'button' | 'implicit';
  
  // ========================================
  // 記録情報(GDPR第7条2項)
  // ========================================
  
  /** 同意日時 */
  consentedAt: Timestamp;
  
  /** 撤回日時 */
  revokedAt?: Timestamp;
  
  /** IPアドレス(仮名化) */
  ipAddress?: string;
  
  /** ユーザーエージェント */
  userAgent?: string;
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
}
```

---

### 4.7 export_logs コレクション

**目的**: データエクスポート履歴の管理

**法的根拠**: プライバシーポリシーv3.1第9.5条、GDPR第20条

#### 4.7.1 スキーマ定義

```typescript
interface ExportLog {
  // ========================================
  // 基本情報
  // ========================================
  
  /** エクスポートID */
  exportId: string;
  
  /** ユーザーID */
  userId: string;
  
  // ========================================
  // エクスポート情報
  // ========================================
  
  /** ファイル名 */
  filename: string;
  
  /** フォーマット */
  format: 'json' | 'csv';
  
  /** ファイルサイズ(bytes) */
  fileSize: number;
  
  /** Cloud Storage パス */
  storagePath: string;
  
  /** ダウンロードURL(署名付き、7日間有効) */
  downloadURL: string;
  
  // ========================================
  // ステータス
  // ========================================
  
  /** ステータス */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  /** エラーメッセージ */
  errorMessage?: string;
  
  // ========================================
  // 期限
  // ========================================
  
  /** エクスポート日時 */
  exportedAt: Timestamp;
  
  /** 有効期限(7日後) */
  expiresAt: Timestamp;
  
  /** ダウンロード済みフラグ */
  isDownloaded: boolean;
  
  /** ダウンロード日時 */
  downloadedAt?: Timestamp;
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
}
```

---

### 4.8 deletion_requests コレクション

**目的**: アカウント削除リクエストの管理

**法的根拠**: プライバシーポリシーv3.1第9.6条、GDPR第17条

#### 4.8.1 スキーマ定義

```typescript
interface DeletionRequest {
  // ========================================
  // 基本情報
  // ========================================
  
  /** リクエストID */
  requestId: string;
  
  /** ユーザーID */
  userId: string;
  
  /** ユーザーメールアドレス(通知用) */
  userEmail: string;
  
  // ========================================
  // 削除情報
  // ========================================
  
  /** ステータス */
  status: 'pending' | 'in_progress' | 'completed' | 'canceled';
  
  /** 削除理由 */
  reason?: string;
  
  /** 削除予定日時(30日後) */
  scheduledDeletionAt: Timestamp;
  
  /** 実際の削除日時 */
  deletedAt?: Timestamp;
  
  // ========================================
  // キャンセル情報
  // ========================================
  
  /** キャンセル可能期限(30日間) */
  cancelableUntil: Timestamp;
  
  /** キャンセル日時 */
  canceledAt?: Timestamp;
  
  // ========================================
  // タイムスタンプ
  // ========================================
  
  /** 作成日時 */
  createdAt: Timestamp;
  
  /** 更新日時 */
  updatedAt: Timestamp;
}
```

---

## 5. Security Rules

### 5.1 完全なSecurity Rules

**法的根拠**: プライバシーポリシーv3.1第8.2条

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========================================
    // ヘルパー関数
    // ========================================
    
    /** 認証済みかどうか */
    function isAuthenticated() {
      return request.auth != null;
    }
    
    /** 自分のデータかどうか */
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    /** 管理者かどうか */
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
    
    /** 年齢制限を満たしているか */
    function meetsAgeRequirement() {
      let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      let birthDate = userData.dateOfBirth;
      let age = duration.inYears(request.time - birthDate.toMillis());
      let region = userData.region;
      
      // 日本: 13歳以上
      if (region == 'JP') {
        return age >= 13;
      }
      // EEA: 16歳以上
      if (region == 'EEA') {
        return age >= 16;
      }
      // その他: 13歳以上
      return age >= 13;
    }
    
    /** サブスクリプションがアクティブか */
    function hasActiveSubscription() {
      let sub = get(/databases/$(database)/documents/subscriptions/$(request.auth.uid)).data;
      return sub.status == 'active' || sub.status == 'trial';
    }
    
    /** プレミアムプランか */
    function isPremium() {
      let sub = get(/databases/$(database)/documents/subscriptions/$(request.auth.uid)).data;
      return sub.planId == 'premium' && (sub.status == 'active' || sub.status == 'trial');
    }
    
    // ========================================
    // users コレクション
    // ========================================
    
    match /users/{userId} {
      // 読み取り: 自分のデータのみ
      allow read: if isOwner(userId);
      
      // 作成: 自分のデータのみ、年齢制限チェック
      allow create: if isOwner(userId) && 
                      meetsAgeRequirement() &&
                      request.resource.data.keys().hasAll([
                        'userId', 'email', 'createdAt', 'updatedAt', 'status'
                      ]);
      
      // 更新: 自分のデータのみ、特定フィールドのみ変更可能
      allow update: if isOwner(userId) && 
                      // 変更不可フィールド
                      !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['userId', 'createdAt', 'email']) &&
                      // updatedAtは必須
                      request.resource.data.updatedAt == request.time;
      
      // 削除: 直接削除不可(deletion_requestsを経由)
      allow delete: if false;
    }
    
    // ========================================
    // exercises コレクション
    // ========================================
    
    match /exercises/{exerciseId} {
      // 読み取り: 全ユーザー(公開されている種目のみ)
      allow read: if resource.data.isPublished == true;
      
      // 書き込み: 管理者のみ
      allow write: if isAdmin();
    }
    
    // ========================================
    // sessions コレクション
    // ========================================
    
    match /sessions/{sessionId} {
      // 読み取り: 自分のセッションのみ
      allow read: if isAuthenticated() && 
                    resource.data.userId == request.auth.uid;
      
      // 作成: 自分のセッションのみ、必須フィールドチェック
      allow create: if isAuthenticated() && 
                      request.resource.data.userId == request.auth.uid &&
                      request.resource.data.keys().hasAll([
                        'sessionId', 'userId', 'exerciseId', 'repCount', 
                        'setCount', 'duration', 'createdAt'
                      ]) &&
                      // 無料プランは1日3回まで
                      (isPremium() || 
                       (countSessionsToday(request.auth.uid) < 3));
      
      // 更新: 自分のセッションのみ、特定フィールドのみ
      allow update: if isOwner(resource.data.userId) &&
                      !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['sessionId', 'userId', 'createdAt']);
      
      // 削除: 自分のセッションのみ
      allow delete: if isOwner(resource.data.userId);
    }
    
    /** 今日のセッション数をカウント */
    function countSessionsToday(userId) {
      // 注意: この関数は簡略化されています
      // 実際にはCloud Functionsで実装推奨
      return 0;
    }
    
    // ========================================
    // notifications コレクション
    // ========================================
    
    match /notifications/{notificationId} {
      // 読み取り: 自分の通知のみ
      allow read: if isAuthenticated() && 
                    resource.data.userId == request.auth.uid;
      
      // 更新: readフラグのみ変更可能
      allow update: if isOwner(resource.data.userId) && 
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['isRead', 'readAt', 'updatedAt']);
      
      // 作成・削除: Cloud Functionsのみ
      allow create, delete: if false;
    }
    
    // ========================================
    // subscriptions コレクション
    // ========================================
    
    match /subscriptions/{userId} {
      // 読み取り: 自分のサブスクリプションのみ
      allow read: if isOwner(userId);
      
      // 書き込み: Cloud Functionsのみ(RevenueCat webhook経由)
      allow write: if false;
    }
    
    // ========================================
    // consents コレクション
    // ========================================
    
    match /consents/{consentId} {
      // 読み取り: 自分の同意記録のみ
      allow read: if isAuthenticated() && 
                    resource.data.userId == request.auth.uid;
      
      // 作成: 自分の同意記録のみ
      allow create: if isAuthenticated() && 
                      request.resource.data.userId == request.auth.uid;
      
      // 更新: 撤回のみ可能
      allow update: if isOwner(resource.data.userId) &&
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['consented', 'revokedAt', 'updatedAt']) &&
                      request.resource.data.consented == false;
      
      // 削除: 不可
      allow delete: if false;
    }
    
    // ========================================
    // export_logs コレクション
    // ========================================
    
    match /export_logs/{exportId} {
      // 読み取り: 自分のログのみ
      allow read: if isAuthenticated() && 
                    resource.data.userId == request.auth.uid;
      
      // 書き込み: Cloud Functionsのみ
      allow write: if false;
    }
    
    // ========================================
    // deletion_requests コレクション
    // ========================================
    
    match /deletion_requests/{requestId} {
      // 読み取り: 自分のリクエストのみ
      allow read: if isAuthenticated() && 
                    resource.data.userId == request.auth.uid;
      
      // 作成: 自分のリクエストのみ
      allow create: if isAuthenticated() && 
                      request.resource.data.userId == request.auth.uid &&
                      request.resource.data.status == 'pending';
      
      // 更新: キャンセルのみ可能
      allow update: if isOwner(resource.data.userId) &&
                      request.resource.data.status == 'canceled' &&
                      request.time < resource.data.cancelableUntil;
      
      // 削除: 不可
      allow delete: if false;
    }
    
    // ========================================
    // app_settings コレクション(管理用)
    // ========================================
    
    match /app_settings/{settingKey} {
      // 読み取り: 全ユーザー
      allow read: if true;
      
      // 書き込み: 管理者のみ
      allow write: if isAdmin();
    }
    
    // ========================================
    // デフォルト: すべて拒否
    // ========================================
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 5.2 Security Rulesテスト

```typescript
import * as testing from '@firebase/rules-unit-testing';

describe('Firestore Security Rules', () => {
  let testEnv: testing.RulesTestEnvironment;
  
  beforeAll(async () => {
    testEnv = await testing.initializeTestEnvironment({
      projectId: 'fitness-app-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });
  
  afterAll(async () => {
    await testEnv.cleanup();
  });
  
  describe('users collection', () => {
    it('should allow user to read their own document', async () => {
      const userId = 'user123';
      const context = testEnv.authenticatedContext(userId);
      const userDoc = context.firestore().collection('users').doc(userId);
      
      await testing.assertSucceeds(userDoc.get());
    });
    
    it('should not allow user to read other user document', async () => {
      const context = testEnv.authenticatedContext('user123');
      const otherUserDoc = context.firestore().collection('users').doc('user456');
      
      await testing.assertFails(otherUserDoc.get());
    });
    
    it('should not allow unauthenticated user to read', async () => {
      const context = testEnv.unauthenticatedContext();
      const userDoc = context.firestore().collection('users').doc('user123');
      
      await testing.assertFails(userDoc.get());
    });
  });
  
  describe('sessions collection', () => {
    it('should allow user to create their own session', async () => {
      const userId = 'user123';
      const context = testEnv.authenticatedContext(userId);
      const sessionDoc = context.firestore().collection('sessions').doc();
      
      await testing.assertSucceeds(sessionDoc.set({
        sessionId: sessionDoc.id,
        userId: userId,
        exerciseId: 'squat',
        repCount: 10,
        setCount: 3,
        duration: 180,
        createdAt: new Date(),
      }));
    });
    
    it('should not allow user to create session for other user', async () => {
      const context = testEnv.authenticatedContext('user123');
      const sessionDoc = context.firestore().collection('sessions').doc();
      
      await testing.assertFails(sessionDoc.set({
        sessionId: sessionDoc.id,
        userId: 'user456', // 他人のユーザーID
        exerciseId: 'squat',
        repCount: 10,
        setCount: 3,
        duration: 180,
        createdAt: new Date(),
      }));
    });
  });
});
```

---

## 6. インデックス設計

### 6.1 複合インデックス

**目的**: クエリパフォーマンスの最適化

**法的根拠**: 要件定義書v3.1 NFR-004(データベースクエリ100ms以内)

#### 6.1.1 インデックス定義

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
        { "fieldPath": "exerciseId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "exerciseCategory", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "exercises",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "difficulty", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "exercises",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPublished", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isRead", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "export_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

#### 6.1.2 インデックスの使用例

```typescript
// ユーザーの最新セッションを取得
const sessions = await firestore
  .collection('sessions')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

// 特定種目のセッションを取得
const squatSessions = await firestore
  .collection('sessions')
  .where('userId', '==', userId)
  .where('exerciseId', '==', 'squat')
  .orderBy('createdAt', 'desc')
  .get();

// 未読通知を取得
const unreadNotifications = await firestore
  .collection('notifications')
  .where('userId', '==', userId)
  .where('isRead', '==', false)
  .orderBy('createdAt', 'desc')
  .get();
```

---

## 7. データ移行

### 7.1 初期データ投入

#### 7.1.1 種目マスターデータ

```typescript
const exercises = [
  {
    exerciseId: 'squat',
    name: 'スクワット',
    category: 'bodyweight',
    targetMuscles: ['大腿四頭筋', '大臀筋'],
    difficulty: 'beginner',
    isPublished: true,
    order: 1,
  },
  {
    exerciseId: 'pushup',
    name: 'プッシュアップ',
    category: 'bodyweight',
    targetMuscles: ['大胸筋', '三角筋'],
    difficulty: 'beginner',
    isPublished: true,
    order: 2,
  },
  // ... 他の種目
];

// 投入
const batch = firestore.batch();
exercises.forEach((exercise) => {
  const ref = firestore.collection('exercises').doc(exercise.exerciseId);
  batch.set(ref, {
    ...exercise,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});
await batch.commit();
```

---

## 8. パフォーマンス最適化

### 8.1 ベストプラクティス

| 項目 | 推奨 | 理由 |
|-----|------|------|
| **ドキュメントサイズ** | < 100KB | 読み取り速度向上 |
| **バッチ書き込み** | 最大500操作 | 書き込み効率化 |
| **リスナー** | 必要最小限 | コスト削減 |
| **インデックス** | 適切に設計 | クエリ速度向上 |
| **キャッシュ** | 積極的に活用 | 読み取り回数削減 |

---

## 9. バックアップ・復旧

### 9.1 バックアップ戦略

```bash
# 日次バックアップ
gcloud firestore export gs://backup-bucket/firestore/$(date +%Y%m%d) \
  --collection-ids=users,sessions,subscriptions

# 復旧
gcloud firestore import gs://backup-bucket/firestore/20251121
```

---

## 10. 運用

### 10.1 監視項目

| 項目 | 閾値 | アラート |
|-----|------|---------|
| **読み取り/日** | 50,000回 | 80%で警告 |
| **書き込み/日** | 20,000回 | 80%で警告 |
| **ストレージ** | 10GB | 80%で警告 |

---

**Document Version**: v3.1  
**Last Updated**: 2025年11月21日  
**Author**: Project Team  
**Approved by**: (承認待ち)

---

**以上**
