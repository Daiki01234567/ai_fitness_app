# 049 マスタデータ管理API

## 概要

アプリで使用するマスタデータ（種目情報、プラン情報、お知らせなど）を管理するAPIを実装するチケットです。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-026: マスタデータ管理

### 非機能要件

- NFR-038: 管理者認証

## 受け入れ条件（Todo）

### 種目マスタAPI

- [x] 種目一覧取得APIを実装
- [x] 種目情報の作成・更新・削除APIを実装
- [x] 種目の有効/無効切り替えAPIを実装

### プランマスタAPI

- [x] プラン一覧取得APIを実装
- [x] プラン情報の作成・更新APIを実装
- [x] プラン価格更新APIを実装

### お知らせマスタAPI

- [x] お知らせ一覧取得APIを実装
- [x] お知らせ作成・更新・削除APIを実装
- [x] お知らせ公開スケジュール設定APIを実装

### アプリ設定API

- [x] アプリ設定一覧取得APIを実装
- [x] アプリ設定更新APIを実装
- [x] メンテナンスモード切り替えAPIを実装

### テスト

- [x] 種目マスタAPIのユニットテストを作成
- [x] プランマスタAPIのユニットテストを作成
- [x] お知らせマスタAPIのユニットテストを作成
- [x] アプリ設定APIのユニットテストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-026
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - マスタデータ構造

## 技術詳細

### API一覧

| API名 | HTTPメソッド | エンドポイント | 権限 |
|-------|------------|---------------|------|
| 種目一覧取得 | GET | /admin/master/exercises | admin以上 |
| 種目作成 | POST | /admin/master/exercises | superAdmin |
| 種目更新 | PUT | /admin/master/exercises/:id | superAdmin |
| プラン一覧取得 | GET | /admin/master/plans | admin以上 |
| プラン更新 | PUT | /admin/master/plans/:id | superAdmin |
| お知らせ一覧取得 | GET | /admin/master/announcements | admin以上 |
| お知らせ作成 | POST | /admin/master/announcements | admin以上 |
| お知らせ更新 | PUT | /admin/master/announcements/:id | admin以上 |
| お知らせ削除 | DELETE | /admin/master/announcements/:id | admin以上 |
| アプリ設定取得 | GET | /admin/master/settings | admin以上 |
| アプリ設定更新 | PUT | /admin/master/settings | superAdmin |

### データ構造

```typescript
interface ExerciseMaster {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  category: string;
  targetMuscles: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  enabled: boolean;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PlanMaster {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  trialDays: number;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "maintenance" | "update";
  priority: number;
  targetAudience: "all" | "free" | "premium";
  startDate: Timestamp;
  endDate?: Timestamp;
  enabled: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

interface AppSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  minAppVersion: {
    ios: string;
    android: string;
  };
  featureFlags: Record<string, boolean>;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

## 見積もり

- 工数: 3日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025-12-12

## 備考

- マスタデータの変更は監査ログに記録
- キャッシュを活用してパフォーマンス向上

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-12 | 初版作成 |
| 2025-12-12 | 実装完了: API関数、テスト作成 |
