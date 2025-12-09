# 045 コンテンツ管理API

## 概要

アプリ内で表示されるコンテンツ（お知らせ、FAQ、マスタデータなど）を管理者が編集・管理するためのAPIを実装するチケットです。アプリのリリースなしでコンテンツを更新できるようにします。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-ADM-003: コンテンツ管理 - トレーニングメニューやアセットを管理
- FR-ADM-006: マスタデータ管理 - カテゴリーや難易度などのマスタデータを管理

### 非機能要件

- NFR-042: 管理画面レスポンス - 3秒以内に応答

## 受け入れ条件（Todo）

### お知らせ管理API

- [ ] お知らせ一覧取得APIを実装
- [ ] お知らせ作成APIを実装
- [ ] お知らせ更新APIを実装
- [ ] お知らせ削除（論理削除）APIを実装
- [ ] お知らせの公開/非公開切り替えAPIを実装
- [ ] お知らせの公開予約機能を実装

### FAQ管理API

- [ ] FAQ一覧取得APIを実装
- [ ] FAQ作成APIを実装
- [ ] FAQ更新APIを実装
- [ ] FAQ削除（論理削除）APIを実装
- [ ] FAQカテゴリ管理APIを実装
- [ ] FAQ表示順序管理APIを実装

### マスタデータ管理API

- [ ] トレーニング種目マスタ管理APIを実装
- [ ] カテゴリマスタ管理APIを実装
- [ ] 難易度マスタ管理APIを実装
- [ ] マスタデータの有効/無効切り替えを実装
- [ ] マスタデータのバージョン管理を実装

### コンテンツバージョニング

- [ ] コンテンツ変更履歴の記録機能を実装
- [ ] 過去バージョンへのロールバック機能を実装
- [ ] 変更差分の表示機能を実装

### テスト

- [ ] 各コンテンツ管理APIのユニットテストを作成
- [ ] バージョニング機能のテストを作成
- [ ] 権限チェックのテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-003, FR-ADM-006
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - コレクション構造

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| GET | `/admin/announcements` | お知らせ一覧 | admin以上 |
| POST | `/admin/announcements` | お知らせ作成 | admin以上 |
| PUT | `/admin/announcements/:id` | お知らせ更新 | admin以上 |
| DELETE | `/admin/announcements/:id` | お知らせ削除 | admin以上 |
| GET | `/admin/faqs` | FAQ一覧 | admin以上 |
| POST | `/admin/faqs` | FAQ作成 | admin以上 |
| PUT | `/admin/faqs/:id` | FAQ更新 | admin以上 |
| DELETE | `/admin/faqs/:id` | FAQ削除 | admin以上 |
| GET | `/admin/masters/:type` | マスタデータ取得 | admin以上 |
| PUT | `/admin/masters/:type` | マスタデータ更新 | superAdmin |

### データ構造

#### お知らせ（Announcements）

```typescript
interface Announcement {
  id: string;
  title: string;                  // タイトル
  body: string;                   // 本文（Markdown対応）
  category: "info" | "maintenance" | "update" | "campaign";
  priority: "low" | "normal" | "high" | "urgent";
  status: "draft" | "scheduled" | "published" | "archived";
  publishedAt?: Timestamp;        // 公開日時
  scheduledAt?: Timestamp;        // 公開予約日時
  expiresAt?: Timestamp;          // 有効期限
  targetAudience: "all" | "free" | "premium";
  imageUrl?: string;              // サムネイル画像
  linkUrl?: string;               // 詳細リンク
  version: number;                // バージョン番号
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  deletedAt?: Timestamp;          // 論理削除日時
}
```

#### FAQ

```typescript
interface Faq {
  id: string;
  question: string;               // 質問
  answer: string;                 // 回答（Markdown対応）
  category: string;               // カテゴリID
  tags: string[];                 // 検索用タグ
  sortOrder: number;              // 表示順序
  status: "draft" | "published" | "archived";
  viewCount: number;              // 閲覧数
  helpfulCount: number;           // 「役に立った」数
  version: number;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  deletedAt?: Timestamp;
}

interface FaqCategory {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  icon?: string;
  status: "active" | "inactive";
}
```

#### マスタデータ

```typescript
interface ExerciseMaster {
  id: string;
  name: string;                   // 種目名
  nameEn: string;                 // 英語名
  description: string;            // 説明
  category: string;               // カテゴリ
  difficulty: "beginner" | "intermediate" | "advanced";
  targetMuscles: string[];        // 対象筋肉
  equipment: string[];            // 必要な器具
  thumbnailUrl: string;           // サムネイル
  videoUrl?: string;              // 解説動画URL
  instructions: string[];         // 手順
  tips: string[];                 // コツ
  cautions: string[];             // 注意点
  sortOrder: number;
  status: "active" | "inactive";
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface DifficultyMaster {
  id: string;
  level: number;                  // 1, 2, 3
  name: string;                   // 初級, 中級, 上級
  description: string;
  color: string;                  // 表示色
  sortOrder: number;
  status: "active" | "inactive";
}
```

### リクエスト/レスポンス形式

#### お知らせ作成

```typescript
// リクエスト
interface CreateAnnouncementRequest {
  title: string;
  body: string;
  category: "info" | "maintenance" | "update" | "campaign";
  priority: "low" | "normal" | "high" | "urgent";
  status: "draft" | "scheduled" | "published";
  scheduledAt?: string;           // ISO 8601形式（status=scheduledの場合）
  expiresAt?: string;
  targetAudience: "all" | "free" | "premium";
  imageUrl?: string;
  linkUrl?: string;
}

// レスポンス
interface CreateAnnouncementResponse {
  id: string;
  createdAt: string;
  version: number;
}
```

#### マスタデータ更新

```typescript
// リクエスト
interface UpdateMasterRequest {
  type: "exercises" | "difficulties" | "categories";
  items: {
    id: string;
    data: Record<string, unknown>;
    operation: "create" | "update" | "delete";
  }[];
}

// レスポンス
interface UpdateMasterResponse {
  success: boolean;
  updatedCount: number;
  createdCount: number;
  deletedCount: number;
  newVersion: number;
}
```

### 実装例

#### お知らせ作成API

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import { logAuditEvent } from "../utils/auditLog";
import * as admin from "firebase-admin";

/**
 * お知らせ作成API
 *
 * 新しいお知らせを作成します。
 * admin以上のロールが必要です。
 */
export const createAnnouncement = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          title,
          body,
          category,
          priority = "normal",
          status = "draft",
          scheduledAt,
          expiresAt,
          targetAudience = "all",
          imageUrl,
          linkUrl,
        } = req.body;

        // 入力チェック
        if (!title || title.trim().length === 0) {
          return res.status(400).json({
            error: "タイトルを入力してください",
            code: "TITLE_REQUIRED",
          });
        }
        if (!body || body.trim().length === 0) {
          return res.status(400).json({
            error: "本文を入力してください",
            code: "BODY_REQUIRED",
          });
        }

        // 公開予約の場合は日時が必要
        if (status === "scheduled" && !scheduledAt) {
          return res.status(400).json({
            error: "公開予約日時を指定してください",
            code: "SCHEDULED_AT_REQUIRED",
          });
        }

        const now = admin.firestore.Timestamp.now();
        const id = admin.firestore().collection("announcements").doc().id;

        const announcement = {
          id,
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
          status,
          publishedAt: status === "published" ? now : null,
          scheduledAt: scheduledAt
            ? admin.firestore.Timestamp.fromDate(new Date(scheduledAt))
            : null,
          expiresAt: expiresAt
            ? admin.firestore.Timestamp.fromDate(new Date(expiresAt))
            : null,
          targetAudience,
          imageUrl: imageUrl || null,
          linkUrl: linkUrl || null,
          version: 1,
          createdAt: now,
          createdBy: req.adminUser.uid,
          updatedAt: now,
          updatedBy: req.adminUser.uid,
          deletedAt: null,
        };

        // Firestoreに保存
        await admin.firestore()
          .collection("announcements")
          .doc(id)
          .set(announcement);

        // バージョン履歴を保存
        await admin.firestore()
          .collection("announcements")
          .doc(id)
          .collection("versions")
          .doc("v1")
          .set({
            ...announcement,
            versionCreatedAt: now,
            versionCreatedBy: req.adminUser.uid,
          });

        // 監査ログ
        await logAuditEvent({
          action: "ANNOUNCEMENT_CREATED",
          category: "CONTENT",
          performedBy: req.adminUser.uid,
          details: { announcementId: id, title, status },
          ipAddress: req.ip,
        });

        logger.info("お知らせを作成しました", { id, title });

        res.status(201).json({
          id,
          createdAt: now.toDate().toISOString(),
          version: 1,
        });
      } catch (error) {
        logger.error("お知らせ作成エラー", { error });
        res.status(500).json({
          error: "お知らせの作成に失敗しました",
          code: "CREATE_ANNOUNCEMENT_ERROR",
        });
      }
    });
  }
);
```

#### FAQ更新API

```typescript
/**
 * FAQ更新API
 *
 * 既存のFAQを更新します。
 * バージョン履歴を保存し、ロールバックを可能にします。
 */
export const updateFaq = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const { id } = req.params;
        const {
          question,
          answer,
          category,
          tags,
          sortOrder,
          status,
        } = req.body;

        // 既存のFAQを取得
        const faqRef = admin.firestore().collection("faqs").doc(id);
        const faqDoc = await faqRef.get();

        if (!faqDoc.exists) {
          return res.status(404).json({
            error: "FAQが見つかりません",
            code: "FAQ_NOT_FOUND",
          });
        }

        const currentData = faqDoc.data();
        const now = admin.firestore.Timestamp.now();
        const newVersion = currentData.version + 1;

        // 更新データを構築
        const updateData = {
          question: question !== undefined ? question : currentData.question,
          answer: answer !== undefined ? answer : currentData.answer,
          category: category !== undefined ? category : currentData.category,
          tags: tags !== undefined ? tags : currentData.tags,
          sortOrder: sortOrder !== undefined ? sortOrder : currentData.sortOrder,
          status: status !== undefined ? status : currentData.status,
          version: newVersion,
          updatedAt: now,
          updatedBy: req.adminUser.uid,
        };

        // トランザクションで更新
        await admin.firestore().runTransaction(async (transaction) => {
          // 現在の状態をバージョン履歴として保存
          const versionRef = faqRef.collection("versions").doc(`v${newVersion}`);
          transaction.set(versionRef, {
            ...currentData,
            versionCreatedAt: now,
            versionCreatedBy: req.adminUser.uid,
            changeReason: req.body.changeReason || null,
          });

          // FAQを更新
          transaction.update(faqRef, updateData);
        });

        // 監査ログ
        await logAuditEvent({
          action: "FAQ_UPDATED",
          category: "CONTENT",
          performedBy: req.adminUser.uid,
          details: { faqId: id, newVersion },
          previousState: currentData,
          newState: updateData,
          ipAddress: req.ip,
        });

        res.json({
          id,
          version: newVersion,
          updatedAt: now.toDate().toISOString(),
        });
      } catch (error) {
        logger.error("FAQ更新エラー", { error });
        res.status(500).json({
          error: "FAQの更新に失敗しました",
          code: "UPDATE_FAQ_ERROR",
        });
      }
    });
  }
);
```

#### マスタデータ更新API

```typescript
/**
 * マスタデータ更新API
 *
 * 複数のマスタデータを一括で更新します。
 * superAdminのみ実行可能です。
 */
export const updateMaster = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("superAdmin")(req, res, async () => {
      try {
        const { type } = req.params;
        const { items } = req.body;

        const validTypes = ["exercises", "difficulties", "categories"];
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            error: `無効なマスタタイプです: ${type}`,
            code: "INVALID_MASTER_TYPE",
          });
        }

        const collectionName = `master_${type}`;
        const now = admin.firestore.Timestamp.now();

        let createdCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;

        // バッチ処理で更新
        const batch = admin.firestore().batch();

        for (const item of items) {
          const ref = admin.firestore()
            .collection(collectionName)
            .doc(item.id);

          switch (item.operation) {
            case "create":
              batch.set(ref, {
                ...item.data,
                id: item.id,
                createdAt: now,
                updatedAt: now,
                createdBy: req.adminUser.uid,
                updatedBy: req.adminUser.uid,
              });
              createdCount++;
              break;

            case "update":
              batch.update(ref, {
                ...item.data,
                updatedAt: now,
                updatedBy: req.adminUser.uid,
              });
              updatedCount++;
              break;

            case "delete":
              // 論理削除
              batch.update(ref, {
                status: "inactive",
                deletedAt: now,
                deletedBy: req.adminUser.uid,
              });
              deletedCount++;
              break;
          }
        }

        await batch.commit();

        // マスタデータバージョンを更新
        const versionRef = admin.firestore()
          .collection("master_versions")
          .doc(type);
        const versionDoc = await versionRef.get();
        const newVersion = (versionDoc.data()?.version || 0) + 1;

        await versionRef.set({
          version: newVersion,
          updatedAt: now,
          updatedBy: req.adminUser.uid,
        });

        // 監査ログ
        await logAuditEvent({
          action: "MASTER_DATA_UPDATED",
          category: "CONTENT",
          severity: "warning",  // マスタデータ変更は影響が大きいため
          performedBy: req.adminUser.uid,
          details: {
            masterType: type,
            createdCount,
            updatedCount,
            deletedCount,
            newVersion,
          },
          ipAddress: req.ip,
        });

        res.json({
          success: true,
          createdCount,
          updatedCount,
          deletedCount,
          newVersion,
        });
      } catch (error) {
        logger.error("マスタデータ更新エラー", { error });
        res.status(500).json({
          error: "マスタデータの更新に失敗しました",
          code: "UPDATE_MASTER_ERROR",
        });
      }
    });
  }
);
```

#### ロールバックAPI

```typescript
/**
 * コンテンツを過去バージョンにロールバック
 */
export const rollbackContent = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const { contentType, contentId, targetVersion } = req.body;

        // コンテンツの取得
        const contentRef = admin.firestore()
          .collection(contentType)
          .doc(contentId);
        const currentDoc = await contentRef.get();

        if (!currentDoc.exists) {
          return res.status(404).json({
            error: "コンテンツが見つかりません",
            code: "CONTENT_NOT_FOUND",
          });
        }

        // 対象バージョンの取得
        const versionDoc = await contentRef
          .collection("versions")
          .doc(`v${targetVersion}`)
          .get();

        if (!versionDoc.exists) {
          return res.status(404).json({
            error: "指定されたバージョンが見つかりません",
            code: "VERSION_NOT_FOUND",
          });
        }

        const targetData = versionDoc.data();
        const currentData = currentDoc.data();
        const now = admin.firestore.Timestamp.now();
        const newVersion = currentData.version + 1;

        // 現在の状態を保存してからロールバック
        await admin.firestore().runTransaction(async (transaction) => {
          // 現在の状態をバージョン履歴に保存
          const newVersionRef = contentRef
            .collection("versions")
            .doc(`v${newVersion}`);
          transaction.set(newVersionRef, {
            ...currentData,
            versionCreatedAt: now,
            versionCreatedBy: req.adminUser.uid,
            changeReason: `v${targetVersion}へのロールバック`,
          });

          // ロールバック実行
          transaction.update(contentRef, {
            ...targetData,
            version: newVersion,
            updatedAt: now,
            updatedBy: req.adminUser.uid,
            rolledBackFrom: currentData.version,
            rolledBackTo: targetVersion,
          });
        });

        // 監査ログ
        await logAuditEvent({
          action: "CONTENT_ROLLBACK",
          category: "CONTENT",
          severity: "warning",
          performedBy: req.adminUser.uid,
          details: {
            contentType,
            contentId,
            fromVersion: currentData.version,
            toVersion: targetVersion,
          },
          ipAddress: req.ip,
        });

        res.json({
          success: true,
          newVersion,
          rolledBackTo: targetVersion,
        });
      } catch (error) {
        logger.error("ロールバックエラー", { error });
        res.status(500).json({
          error: "ロールバックに失敗しました",
          code: "ROLLBACK_ERROR",
        });
      }
    });
  }
);
```

## 見積もり

- 工数: 5日
- 難易度: 中

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- コンテンツの画像はFirebase Storageに保存し、URLを参照する
- 公開予約はCloud Schedulerで定期的にチェックして自動公開する
- マスタデータの変更はアプリ側でキャッシュしているため、バージョン管理が重要
- 将来的には多言語対応を見据えた設計にする

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
