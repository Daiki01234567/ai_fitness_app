# 007 ユーザーAPI

## 概要

ユーザーの情報（プロフィール）を取得・更新するAPIを実装するチケットです。

例えば、ユーザーが自分の身長や体重、運動経験レベルを変更したい時にこのAPIを使います。また、アプリがユーザー情報を表示する時にもこのAPIで情報を取得します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002（Firestore Security Rules実装）
- 003（Cloud Functions基盤）

## 要件

### 機能要件

- FR-002: プロフィール管理 - 運動経験、性別、目標、生年月日、身長・体重などの登録・編集

### 非機能要件

- NFR-003: APIレスポンス時間 - 200ms以内
- NFR-004: データベースクエリ - 100ms以内

## 受け入れ条件（Todo）

- [x] user_getProfile API を実装
  - [x] ユーザー情報を取得
  - [x] 存在しないユーザーのエラーハンドリング
  - [x] 削除予定ユーザーでも取得可能（読み取り専用）
- [x] user_updateProfile API を実装
  - [x] プロフィール情報の更新
  - [x] 部分更新に対応（指定したフィールドのみ更新）
  - [x] バリデーション（身長・体重の範囲チェック等）
  - [x] 削除予定ユーザーは更新不可
- [x] プロフィール画像URL管理を実装
  - [x] photoURLの更新
  - [x] Storage連携（画像アップロードはクライアント側）
- [x] アカウント削除API実装
  - [x] requestAccountDeletion - 30日猶予のアカウント削除リクエスト
  - [x] cancelAccountDeletion - アカウント削除のキャンセル
- [x] ユニットテストを作成
  - [x] getProfile.test.ts (9テスト)
  - [x] updateProfile.test.ts (21テスト)
  - [x] deleteAccount.test.ts (13テスト)
- [ ] エミュレータでテストが通ることを確認

## 参照ドキュメント

- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - user_updateProfileの仕様
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクションのスキーマ

## 技術詳細

### user_getProfile API

```typescript
// functions/src/api/users/getProfile.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";

const logger = createLogger("user_getProfile");

export const user_getProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;

  logger.info("プロフィール取得リクエスト", { uid });

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "ユーザーが見つかりません");
  }

  const userData = userDoc.data();

  return {
    success: true,
    data: {
      userId: userData?.userId,
      email: userData?.email,
      displayName: userData?.displayName,
      photoURL: userData?.photoURL,
      profile: userData?.profile,
      subscriptionStatus: userData?.subscriptionStatus,
      createdAt: userData?.createdAt?.toDate?.()?.toISOString(),
      updatedAt: userData?.updatedAt?.toDate?.()?.toISOString(),
      // 削除予定フラグも返す（クライアントで表示に使用）
      deletionScheduled: userData?.deletionScheduled || false,
      scheduledDeletionDate: userData?.scheduledDeletionDate?.toDate?.()?.toISOString() || null,
    },
  };
});
```

### user_updateProfile API

```typescript
// functions/src/api/users/updateProfile.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createLogger } from "../../utils/logger";
import { validateProfile, ProfileInput } from "../../utils/validation";

const logger = createLogger("user_updateProfile");

interface UpdateProfileRequest {
  displayName?: string | null;
  photoURL?: string | null;
  profile?: Partial<ProfileInput>;
}

export const user_updateProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const uid = request.auth.uid;
  const data = request.data as UpdateProfileRequest;

  logger.info("プロフィール更新リクエスト", { uid });

  const db = getFirestore();

  // 削除予定ユーザーチェック
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "ユーザーが見つかりません");
  }

  const userData = userDoc.data();
  if (userData?.deletionScheduled) {
    throw new HttpsError(
      "permission-denied",
      "アカウント削除が予定されているため、データを変更できません"
    );
  }

  // バリデーション
  if (data.profile) {
    const validationResult = validateProfile(data.profile);
    if (!validationResult.valid) {
      throw new HttpsError("invalid-argument", validationResult.message);
    }
  }

  // 更新データを構築
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName;
  }

  if (data.photoURL !== undefined) {
    updateData.photoURL = data.photoURL;
  }

  if (data.profile) {
    // プロフィールの部分更新
    const currentProfile = userData?.profile || {};
    updateData.profile = {
      ...currentProfile,
      ...data.profile,
    };
  }

  // 更新実行
  await db.collection("users").doc(uid).update(updateData);

  logger.info("プロフィール更新完了", { uid });

  return {
    success: true,
    message: "プロフィールを更新しました",
    data: {
      userId: uid,
      displayName: updateData.displayName ?? userData?.displayName,
      profile: updateData.profile ?? userData?.profile,
      updatedAt: new Date().toISOString(),
    },
  };
});
```

### バリデーションユーティリティ

```typescript
// functions/src/utils/validation.ts

export interface ProfileInput {
  height?: number | null;
  weight?: number | null;
  birthday?: string | null;
  gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | null;
  goals?: string[];
}

interface ValidationResult {
  valid: boolean;
  message: string;
}

export function validateProfile(profile: Partial<ProfileInput>): ValidationResult {
  // 身長のバリデーション（50cm〜300cm）
  if (profile.height !== undefined && profile.height !== null) {
    if (typeof profile.height !== "number" || profile.height < 50 || profile.height > 300) {
      return { valid: false, message: "身長は50cm〜300cmの範囲で入力してください" };
    }
  }

  // 体重のバリデーション（10kg〜500kg）
  if (profile.weight !== undefined && profile.weight !== null) {
    if (typeof profile.weight !== "number" || profile.weight < 10 || profile.weight > 500) {
      return { valid: false, message: "体重は10kg〜500kgの範囲で入力してください" };
    }
  }

  // 生年月日のバリデーション
  if (profile.birthday !== undefined && profile.birthday !== null) {
    const birthDate = new Date(profile.birthday);
    const now = new Date();
    const minDate = new Date("1900-01-01");

    if (isNaN(birthDate.getTime())) {
      return { valid: false, message: "生年月日の形式が正しくありません" };
    }

    if (birthDate < minDate || birthDate > now) {
      return { valid: false, message: "生年月日が有効な範囲外です" };
    }
  }

  // 性別のバリデーション
  if (profile.gender !== undefined && profile.gender !== null) {
    const validGenders = ["male", "female", "other", "prefer_not_to_say"];
    if (!validGenders.includes(profile.gender)) {
      return { valid: false, message: "性別の値が不正です" };
    }
  }

  // フィットネスレベルのバリデーション
  if (profile.fitnessLevel !== undefined && profile.fitnessLevel !== null) {
    const validLevels = ["beginner", "intermediate", "advanced"];
    if (!validLevels.includes(profile.fitnessLevel)) {
      return { valid: false, message: "フィットネスレベルの値が不正です" };
    }
  }

  // 目標のバリデーション
  if (profile.goals !== undefined) {
    if (!Array.isArray(profile.goals)) {
      return { valid: false, message: "目標は配列で指定してください" };
    }
    if (profile.goals.length > 10) {
      return { valid: false, message: "目標は10個以内で設定してください" };
    }
    for (const goal of profile.goals) {
      if (typeof goal !== "string" || goal.length > 200) {
        return { valid: false, message: "各目標は200文字以内の文字列で指定してください" };
      }
    }
  }

  return { valid: true, message: "" };
}
```

### レート制限

| API | 制限 | 時間窓 |
|-----|------|--------|
| user_getProfile | 100回 | 1時間/ユーザー |
| user_updateProfile | 50回 | 1時間/ユーザー |

## 見積もり

- 工数: 1.5日
- 難易度: 中

## 進捗

- [x] APIエンドポイント実装完了
- [x] ユニットテスト作成完了（42テストすべてパス）
- [ ] エミュレータ統合テスト

## 備考

- プロフィール画像のアップロードはクライアント側でFirebase Storageに直接アップロードし、URLのみをこのAPIで更新する
- displayNameの変更頻度が高い場合は、レート制限を調整する
- 削除予定ユーザーは読み取りのみ可能

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | ユーザーAPI実装完了（updateProfile、バリデーション含む） |
| 2025-12-10 | getProfile API実装、deleteAccount API実装、ユニットテスト42件作成 |
