# 036 セッション管理

## 概要

トレーニングセッションとフレームデータをFirestoreで管理するための機能を実装します。セッションの開始から終了まで、および各フレームの骨格データの保存を効率的に行えるようにします。また、デバイス情報の取得機能も含みます。

## Phase

Phase 2（機能実装）

## 依存チケット

- 035: トレーニング記録保存API

## 要件

### 1. sessionsコレクションの管理

ユーザーごとのトレーニングセッションを管理します。

**Firestoreパス**: `/users/{userId}/sessions/{sessionId}`

**ドキュメント構造**:

```typescript
interface SessionDocument {
  sessionId: string;           // セッションID
  userId: string;              // ユーザーID
  exerciseType: ExerciseType;  // 運動の種類
  status: SessionStatus;       // セッション状態
  repCount: number;            // レップ数
  setCount: number;            // セット数
  averageScore: number;        // 平均スコア
  duration: number;            // 運動時間（秒）
  calories?: number;           // 消費カロリー
  startedAt: Timestamp;        // 開始日時
  endedAt?: Timestamp;         // 終了日時
  deviceInfo: DeviceInfo;      // デバイス情報
  metadata?: SessionMetadata;  // メタデータ
  createdAt: Timestamp;        // 作成日時
  updatedAt: Timestamp;        // 更新日時
}

type ExerciseType = 'squat' | 'pushup' | 'armcurl' | 'sideraise' | 'shoulderpress';
type SessionStatus = 'in_progress' | 'completed' | 'cancelled';
```

### 2. framesコレクションの管理

セッション中の各フレームの骨格データを保存します。

**Firestoreパス**: `/users/{userId}/sessions/{sessionId}/frames/{frameId}`

**ドキュメント構造**:

```typescript
interface FrameDocument {
  frameId: string;             // フレームID
  frameNumber: number;         // フレーム番号
  timestamp: Timestamp;        // タイムスタンプ
  landmarks: Landmark[];       // 33個の関節位置データ
  score: number;               // このフレームのスコア
  repNumber?: number;          // レップ番号
  phase?: RepPhase;            // レップのフェーズ
}

interface Landmark {
  x: number;          // X座標（0-1の正規化値）
  y: number;          // Y座標（0-1の正規化値）
  z: number;          // Z座標（奥行き）
  visibility: number; // 可視性（0-1）
}

type RepPhase = 'start' | 'down' | 'bottom' | 'up' | 'end';
```

### 3. デバイス情報取得

トレーニング時のデバイス情報を取得します。

```typescript
interface DeviceInfo {
  model: string;         // デバイスモデル（例: "iPhone 14"）
  os: string;            // OS種類（"iOS" | "Android"）
  osVersion: string;     // OSバージョン（例: "17.0"）
  appVersion: string;    // アプリバージョン
  screenWidth: number;   // 画面幅
  screenHeight: number;  // 画面高さ
}
```

### 4. セッション状態管理

```
[開始] → in_progress → [完了] → completed
                    ↘ [キャンセル] → cancelled
```

## 受け入れ条件

- [ ] セッションの作成・更新・取得が正常に動作する
- [ ] フレームデータのバッチ保存が正常に動作する
- [ ] デバイス情報が正しく取得・保存される
- [ ] セッション状態の遷移が正しく動作する
- [ ] Firestoreセキュリティルールが適用されている
- [ ] フレームデータの容量最適化が実装されている
- [ ] オフライン時のデータ永続化が動作する
- [ ] 単体テストが作成されている

## 参照ドキュメント

- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - 1.3.2 sessions コレクション
- `docs/expo/specs/05_要件定義書_Expo版_v1_Part5.md` - 1.3.3 frames コレクション
- `docs/specs/02_Firestoreデータベース設計書_v3_3.md` - Sessions/Frames設計

## 技術詳細

### ファイル構成（アプリ側）

```
src/
├── services/
│   └── session/
│       ├── sessionService.ts       # セッション管理サービス
│       ├── frameService.ts         # フレーム管理サービス
│       └── deviceInfoService.ts    # デバイス情報取得
├── stores/
│   └── sessionStore.ts             # セッション状態管理（Zustand）
├── types/
│   └── session.ts                  # 型定義
└── hooks/
    └── useSession.ts               # セッション用フック
```

### フレームデータの最適化

フレームデータは容量が大きくなりがちなため、以下の最適化を行います：

1. **間引き保存**: 30fpsの場合、10フレームごとに1フレーム保存（3fps相当）
2. **座標の丸め**: 小数点以下4桁に丸める
3. **バッチ書き込み**: 複数フレームをまとめてFirestoreに書き込み

```typescript
// フレーム間引きの例
const shouldSaveFrame = (frameNumber: number): boolean => {
  return frameNumber % 10 === 0; // 10フレームごと
};

// 座標の丸め
const roundCoordinate = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};
```

### デバイス情報取得（Expo）

```typescript
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Dimensions } from 'react-native';

const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const { width, height } = Dimensions.get('window');

  return {
    model: Device.modelName ?? 'Unknown',
    os: Device.osName ?? 'Unknown',
    osVersion: Device.osVersion ?? 'Unknown',
    appVersion: Application.nativeApplicationVersion ?? '1.0.0',
    screenWidth: width,
    screenHeight: height,
  };
};
```

### Zustand状態管理

```typescript
interface SessionState {
  currentSession: Session | null;
  isRecording: boolean;
  frames: Frame[];

  startSession: (exerciseType: ExerciseType) => void;
  addFrame: (frame: Frame) => void;
  endSession: () => Promise<void>;
  cancelSession: () => void;
}
```

## 注意事項

- フレームデータは本人のみ読み取り可能（書き込みはシステムのみ）
- セッションは削除予約中のユーザーでは作成不可
- オフライン時はローカルに保存し、オンライン復帰時に同期
- フレームの保存数には上限を設ける（1セッション最大10,000フレーム）

## 見積もり

- 実装: 4日
- テスト: 2日
- レビュー・修正: 1日
- **合計: 7日**

## 進捗

- [ ] 型定義の作成
- [ ] sessionServiceの実装
- [ ] frameServiceの実装
- [ ] deviceInfoServiceの実装
- [ ] Zustand storeの実装
- [ ] フレームデータ最適化の実装
- [ ] オフライン対応の実装
- [ ] セキュリティルールの更新
- [ ] 単体テストの作成
- [ ] 統合テストの作成
- [ ] コードレビュー
