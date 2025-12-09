# 025 設定保存API

## 概要

ユーザーの設定（音声、表示、プライバシーなど）を保存・取得するAPIを実装するチケットです。設定はFirestoreのUsersコレクションに保存され、クライアント側から読み書きできるようにします。

## Phase

Phase 2（API・データパイプライン実装）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 002: Firestore セキュリティルール実装
- 004: ユーザープロフィール API

## 要件

### 機能要件

- FR-012: 音声設定
- FR-016: 設定管理機能

### 非機能要件

- NFR-002: データ整合性の保証
- NFR-020: 可用性（99.5%以上）

## 受け入れ条件（Todo）

- [ ] 設定保存APIを実装（`settings_updateSettings`）
- [ ] 設定取得APIを実装（`settings_getSettings`）
- [ ] 音声設定の保存・取得機能（音量、速度、ON/OFF）
- [ ] 表示設定の保存・取得機能（テーマ、カメラガイド表示）
- [ ] 設定値のバリデーション（音量0-100、速度0.5-2.0など）
- [ ] 設定の初期値を定義
- [ ] レート制限の実装（50回/時）
- [ ] ユニットテストを作成（カバレッジ80%以上）
- [ ] エミュレータでの動作確認

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-012, FR-016
- `docs/common/specs/04_API設計書_Firebase_Functions_v1_0.md` - ユーザー管理API
- `docs/common/specs/03_Firestoreデータベース設計書_v1_0.md` - Usersコレクション

## 技術詳細

### データモデル

Usersコレクション（設定追加）:

```typescript
interface User {
  userId: string;
  settings: {
    audio: {
      enabled: boolean;
      volume: number;  // 0-100
      speed: number;  // 0.5-2.0
    };
    display: {
      theme: 'light' | 'dark' | 'auto';
      showCameraGuide: boolean;
      showProgressBar: boolean;
    };
    privacy: {
      dataSharingForAnalytics: boolean;
      dataSharingForML: boolean;
    };
  };
  // 他のフィールド...
}
```

### 設定の初期値

```typescript
const DEFAULT_SETTINGS = {
  audio: {
    enabled: true,
    volume: 70,
    speed: 1.0
  },
  display: {
    theme: 'auto',
    showCameraGuide: true,
    showProgressBar: true
  },
  privacy: {
    dataSharingForAnalytics: false,
    dataSharingForML: false
  }
};
```

### 実装例: 設定保存API

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

interface UpdateSettingsRequest {
  audio?: {
    enabled?: boolean;
    volume?: number;
    speed?: number;
  };
  display?: {
    theme?: 'light' | 'dark' | 'auto';
    showCameraGuide?: boolean;
    showProgressBar?: boolean;
  };
  privacy?: {
    dataSharingForAnalytics?: boolean;
    dataSharingForML?: boolean;
  };
}

export const settings_updateSettings = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;
  const settings = request.data as UpdateSettingsRequest;

  // バリデーション
  if (settings.audio) {
    if (settings.audio.volume !== undefined) {
      if (settings.audio.volume < 0 || settings.audio.volume > 100) {
        throw new HttpsError('invalid-argument', '音量は0〜100の範囲で指定してください');
      }
    }

    if (settings.audio.speed !== undefined) {
      if (settings.audio.speed < 0.5 || settings.audio.speed > 2.0) {
        throw new HttpsError('invalid-argument', '速度は0.5〜2.0の範囲で指定してください');
      }
    }
  }

  if (settings.display?.theme) {
    const validThemes = ['light', 'dark', 'auto'];
    if (!validThemes.includes(settings.display.theme)) {
      throw new HttpsError('invalid-argument', 'テーマが無効です');
    }
  }

  // 削除予定ユーザーチェック
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (userDoc.data()?.deletionScheduled === true) {
    throw new HttpsError(
      'permission-denied',
      'アカウント削除が予定されているため、設定を変更できません。'
    );
  }

  // 設定を更新（ネストされたフィールドを更新）
  const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (settings.audio) {
    if (settings.audio.enabled !== undefined) {
      updateData['settings.audio.enabled'] = settings.audio.enabled;
    }
    if (settings.audio.volume !== undefined) {
      updateData['settings.audio.volume'] = settings.audio.volume;
    }
    if (settings.audio.speed !== undefined) {
      updateData['settings.audio.speed'] = settings.audio.speed;
    }
  }

  if (settings.display) {
    if (settings.display.theme !== undefined) {
      updateData['settings.display.theme'] = settings.display.theme;
    }
    if (settings.display.showCameraGuide !== undefined) {
      updateData['settings.display.showCameraGuide'] = settings.display.showCameraGuide;
    }
    if (settings.display.showProgressBar !== undefined) {
      updateData['settings.display.showProgressBar'] = settings.display.showProgressBar;
    }
  }

  if (settings.privacy) {
    if (settings.privacy.dataSharingForAnalytics !== undefined) {
      updateData['settings.privacy.dataSharingForAnalytics'] = settings.privacy.dataSharingForAnalytics;
    }
    if (settings.privacy.dataSharingForML !== undefined) {
      updateData['settings.privacy.dataSharingForML'] = settings.privacy.dataSharingForML;
    }
  }

  await admin.firestore().collection('users').doc(uid).update(updateData);

  logger.info('設定更新完了', { userId: uid, updatedFields: Object.keys(updateData) });

  return {
    success: true,
    message: '設定を更新しました'
  };
});
```

### 実装例: 設定取得API

```typescript
export const settings_getSettings = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }

  const uid = request.auth.uid;

  const userDoc = await admin.firestore().collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data();
  const settings = userData?.settings || DEFAULT_SETTINGS;

  return {
    success: true,
    data: settings
  };
});
```

### Firestoreセキュリティルール

```javascript
match /users/{userId} {
  // ユーザーは自分の設定を読み書き可能
  allow read: if request.auth.uid == userId;

  // 削除予定ユーザーは書き込み不可
  allow update: if request.auth.uid == userId
    && !resource.data.deletionScheduled;
}
```

## テスト観点

- 認証されていないユーザーは設定を更新できないこと
- 音量が範囲外の場合、エラーが返ること
- 速度が範囲外の場合、エラーが返ること
- 削除予定ユーザーは設定を更新できないこと
- 設定が正しくFirestoreに保存されること
- 設定が正しく取得できること
- デフォルト設定が正しく返されること

## 見積もり

- 工数: 1.5日
- 難易度: 低

## 進捗

- [ ] 未着手

## 完了日

未完了

## 備考

- この機能はExpo版・Flutter版の両方で使用されます
- 通知設定は、チケット026（通知設定API）で別途実装します
- テーマ設定（ダークモード）はクライアント側で実装します

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
