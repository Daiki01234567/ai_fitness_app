# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 重要な制約事項

### 必ず守るべき開発ルール

1. **ドキュメント優先の原則**
   - コード実装・設計・レビュー・タスク分解などを行う際は、**必ず `docs/specs` 配下のドキュメントを最優先で参照してください**
   - 推測ではなく、**要件定義書・各種設計書・ポリシー類を根拠に判断してください**

2. **推測を行う場合の明示**
   - ドキュメントに書かれていないことを実装する場合は、**「推測である」「暫定案である」ことを明示**してください
   - 必ず**選択肢とトレードオフを提示**してください

3. **仕様書の参照順序**
   ```
   1. まず要件定義書で機能要件を確認
   2. 該当する設計書で詳細設計を確認
   3. 実装に入る前に関連する全ドキュメントを確認
   ```

## 📁 仕様書ドキュメント一覧

### 要件・全体
- `docs/specs/00_要件定義書_v3_3.md` - 38機能要件 + 37非機能要件
- `docs/specs/09_開発タスク詳細_スケジュール_v3_3.md` - Phase 1-2の詳細タスクとスケジュール

### アーキテクチャ・データ
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md` - システム全体設計
- `docs/specs/02_Firestoreデータベース設計書_v3_3.md` - データ構造とセキュリティルール
- `docs/specs/03_API設計書_Firebase_Functions_v3_3.md` - Cloud Functions API仕様
- `docs/specs/04_BigQuery設計書_v3_3.md` - 分析基盤設計

### UI / ロジック
- `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md` - 15画面の遷移とUI設計
- `docs/specs/08_README_form_validation_logic_v3_3.md` - 5種目のフォーム評価ロジック詳細

### 法令・セキュリティ・プライバシー
- `docs/specs/06_データ処理記録_ROPA_v1_0.md` - GDPR準拠のデータ処理記録
- `docs/specs/07_セキュリティポリシー_v1_0.md` - セキュリティ要件
- `docs/specs/利用規約_v3_2.md` - サービス利用規約
- `docs/specs/プライバシーポリシー_v3.1.md` - 個人情報保護方針

## プロジェクト概要

AIを活用したフィットネスアプリ（MediaPipeによるオンデバイス姿勢検出）。日本市場向けでGDPR準拠、薬機法上の医療機器には該当しない。

- **Firebase Project ID**: `ai-fitness-c38f0`
- **開発フェーズ**: MVP Phase 1-2 (0-7ヶ月)
- **技術スタック**: Flutter + Firebase Functions (TypeScript/Node 24) + Firestore + BigQuery

## 開発コマンド

### Flutter開発
```bash
# flutter_app/ ディレクトリから実行
flutter pub get              # 依存関係インストール
flutter analyze              # 静的解析
flutter run                  # デバイス実行
flutter build apk           # Android ビルド
flutter build ios           # iOS ビルド
flutter test                # テスト実行（実装後）
```

### Firebase Functions
```bash
# functions/ ディレクトリから実行
npm install                 # 依存関係インストール
npm run lint                # ESLint (Google style, double quotes)
npm run build               # TypeScriptコンパイル
npm run build:watch         # ウォッチモード
npm run serve              # ローカルエミュレーション
npm run shell              # インタラクティブテスト
npm run deploy             # 本番デプロイ
npm run logs               # ログ確認
```

### Firebase操作
```bash
firebase emulators:start                    # エミュレータ起動
firebase deploy                             # 全体デプロイ
firebase deploy --only functions            # Functions のみ
firebase deploy --only firestore:rules     # セキュリティルールのみ
firebase functions:log                     # Functions ログ確認
```

## アーキテクチャ

### 仕様書の依存関係

実装には以下の順序で仕様書を参照する必要があります：

**基本フロー**:
1. `00_要件定義書_v3_3.md` → 何を作るか（38機能要件 + 37非機能要件）
2. `01_システムアーキテクチャ設計書_v3_2.md` → どのように実装するか
3. `02_Firestoreデータベース設計書_v3_3.md` → データ構造とセキュリティルール
4. `03_API設計書_Firebase_Functions_v3_3.md` → API エンドポイント仕様
5. `04_BigQuery設計書_v3_3.md` → 分析データウェアハウス

**実装詳細**:
- `05_画面遷移図_ワイヤーフレーム_v3_3.md` → 15画面（4タブナビゲーション）
- `08_README_form_validation_logic_v3_3.md` → MediaPipe 33点姿勢推定による5種目の評価アルゴリズム
- `09_開発タスク詳細_スケジュール_v3_3.md` → Phase 1と Phase 2の機能分割

### データフローアーキテクチャ

```
モバイルアプリ (Flutter)
    ↓ MediaPipe でローカル処理（プライバシー優先）
    ↓ スケルトンデータのみ送信（33関節×4値）
Cloud Function (HTTPS トリガー)
    ↓ バリデーション後 Firestore 保存
    ↓ Cloud Task で非同期処理
BigQuery（匿名化された分析データ）
    ↓ 2年保存（GDPR準拠）
```

### 重要なパターン

**プライバシー優先処理**:
- カメラ映像はデバイスから出ない
- MediaPipe はオンデバイス実行（目標30fps、最低15fps）
- 骨格関節データのみ送信

**GDPR準拠**:
- 削除30日間猶予期間（`deletionScheduled` フラグ）
- Firestore ルールでフィールドレベルアクセス制御
- 同意追跡は別の不変コレクション
- `tosAccepted`、`ppAccepted` フィールドはユーザー読み取り専用

**セキュリティ層**:
1. TLS 1.3 による通信暗号化
2. Firebase Auth とカスタムクレーム
3. Firestore フィールドレベルセキュリティルール
4. 保存時暗号化（Google管理）

**イベント駆動バックエンド**:
- Firestore トリガーによるビジネスロジック
- Cloud Tasks によるリトライ（指数バックオフ）
- Dead Letter Queue による失敗処理
- スケジュール関数によるメンテナンス

### Firestore主要コレクション

`02_Firestoreデータベース設計書_v3_3.md` より：

- **Users**: プロファイル、同意フラグ、`deletionScheduled` 状態
- **Sessions**: `poseData` と `sessionMetadata` を含むトレーニングデータ
- **Consents**: 同意変更の不変監査ログ
- **DataDeletionRequests**: 30日猶予期間管理
- **BigQuerySyncFailures**: 分析パイプラインのDLQ

### フォーム評価ロジック

`08_README_form_validation_logic_v3_3.md` による MediaPipe Pose 検出を使用した5種目：

1. **スクワット**: 膝角度 90-110°、膝がつま先を越えないかチェック
2. **アームカール**: 肘角度 30-160°、反動検出
3. **サイドレイズ**: 腕の挙上角度 70-90°、左右対称性チェック
4. **ショルダープレス**: 肘の軌道、腰の反りチェック
5. **プッシュアップ**: 体のライン維持、肘角度 90°

各種目は状態マシンによるレップカウントと0-100点のスコアリングを実装。

## 現在の実装状況

**完了済み**:
- 包括的な仕様書（v3.3）
- プロジェクト構造とFirebaseセットアップ
- ドキュメントフレームワーク

**未着手**（スケルトンのみ）:
- Flutter UI（main.dart のボイラープレートのみ）
- Cloud Functions（空のディレクトリ）
- Firestore セキュリティルール
- BigQuery スキーマ
- フォーム評価アルゴリズム

## タスク管理とチケット運用

### チケットの進捗管理

開発タスクは `/docs/tickets/` ディレクトリに番号付きマークダークファイルとして管理されています。

**進捗の記録方法**:
各チケットのTodoアイテムは、完了したら `[ ]` を `[x]` に変更して進捗を管理します：

```markdown
- [ ] 未完了タスク
- [x] 完了タスク
```

**チケット管理のルール**:
1. タスク開始時に該当チケットを確認
2. 作業完了後、即座にチェックボックスを更新
3. 全てのTodoが完了したらチケットをクローズ
4. ブロッカーがある場合は、チケット内にメモを追記

**例**:
```markdown
## Todo リスト

### Firebase プロジェクト設定
- [x] Firebase コンソールでプロジェクト作成
- [x] Firestore データベース作成
- [ ] Cloud Functions 初期設定
- [ ] 環境変数設定
```

## 開発上の制約

### 法的要件

**薬機法**:
- 医療機器ではない
- 「治療」「診断」「治す」といった用語は使用禁止
- 使用可能：「フィットネス」「運動」「トレーニング」「健康維持」

**GDPR**:
- 72時間以内の違反通知
- データ最小化原則
- ユーザー権利（アクセス、削除、ポータビリティ）
- 詳細は `docs/specs/06_データ処理記録_ROPA_v1_0.md` 参照

**利用規約・プライバシーポリシー**:
- `docs/specs/利用規約_v3_2.md` で全文確認
- `docs/specs/プライバシーポリシー_v3.1.md` で全文確認

### パフォーマンス要件

**MediaPipe**:
- 対象デバイスで最低30fps（NFR-024、NFR-025）
- 低スペックデバイスでのフォールバック実装

**Cloud Functions**:
- 最大インスタンス数：10（コスト制御）
- コールドスタート対策（NFR-037）

**BigQuery**:
- ストリーミングインサート使用（バッチ処理ではない）
- データ保存期間：2年（GDPR準拠）

### コードスタイル

**TypeScript**:
- ESLint Google スタイル
- ダブルクォート使用
- strict モード有効

**Flutter**:
- flutter_lints パッケージのルール適用

**言語**:
- コメント：英語（保守性のため）
- UI テキスト：日本語（ターゲット市場）

## コーディングベストプラクティス

### TypeScript (Firebase Functions)

**型安全性**:
- `any` 型の使用を避ける。必要な場合は `unknown` を使用して型ガードを実装
- 関数の引数と戻り値には必ず型を明示
- インターフェースで明確なデータ構造を定義

```typescript
// Good
interface SessionRequest {
  userId: string;
  exerciseType: string;
  poseData: PoseData[];
}

async function createSession(req: SessionRequest): Promise<SessionResponse> {
  // ...
}

// Bad
async function createSession(req: any) {
  // ...
}
```

**非同期処理**:
- `async/await` を使用（Promise チェーンより読みやすい）
- エラーハンドリングは `try/catch` で確実に実施
- 並列実行可能な処理は `Promise.all()` を使用

```typescript
// Good
try {
  const [user, session] = await Promise.all([
    getUserById(userId),
    getSessionById(sessionId)
  ]);
} catch (error) {
  logger.error("Failed to fetch data", { error });
  throw new functions.https.HttpsError("internal", "データ取得に失敗しました");
}
```

**関数設計**:
- 単一責任の原則（1関数1役割）
- 純粋関数を優先（副作用を最小化）
- Cloud Functions は冪等性を保つ（同じ入力で何度実行しても同じ結果）

**エラーハンドリング**:
- `functions.https.HttpsError` でクライアントに適切なエラーを返す
- ログには十分なコンテキストを含める
- センシティブ情報をログに出力しない

```typescript
// Good
catch (error) {
  logger.error("Session creation failed", {
    userId: req.userId,
    exerciseType: req.exerciseType,
    error: error instanceof Error ? error.message : String(error)
  });
  throw new functions.https.HttpsError(
    "internal",
    "セッションの作成に失敗しました"
  );
}
```

**パフォーマンス**:
- Firestore の読み取りを最小化（キャッシュ活用）
- バッチ処理は適切なサイズに分割（500件以下推奨）
- 不要な依存関係をインポートしない（コールドスタート時間増加）

### Dart/Flutter

**Null Safety**:
- Null Safety を完全に活用（`?` と `!` を適切に使用）
- `late` キーワードは初期化が保証される場合のみ使用
- Null チェックは `?.` や `??` を活用

```dart
// Good
String? getUserName(User? user) {
  return user?.name ?? "ゲスト";
}

// Bad
String getUserName(User user) {
  return user.name; // user が null の可能性を無視
}
```

**Widget 設計**:
- StatelessWidget を優先（状態がない場合）
- Widget は小さく分割（再利用可能にする）
- `const` コンストラクタを可能な限り使用（パフォーマンス向上）

```dart
// Good
class ExerciseCard extends StatelessWidget {
  const ExerciseCard({
    Key? key,
    required this.exerciseName,
    required this.onTap,
  }) : super(key: key);

  final String exerciseName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(exerciseName),
        onTap: onTap,
      ),
    );
  }
}
```

**状態管理 (Riverpod)**:
- Provider は機能ごとに分割
- 状態の変更は Notifier 内で完結
- UI と状態ロジックを分離

```dart
// Good
@riverpod
class SessionNotifier extends _$SessionNotifier {
  @override
  SessionState build() => const SessionState.initial();

  Future<void> startSession(String exerciseType) async {
    state = const SessionState.loading();
    try {
      final session = await ref.read(sessionRepositoryProvider).create(exerciseType);
      state = SessionState.loaded(session);
    } catch (e) {
      state = SessionState.error(e.toString());
    }
  }
}
```

**非同期処理**:
- `async/await` を使用
- FutureBuilder や StreamBuilder より Riverpod の AsyncValue を優先
- 長時間処理は Isolate で実行（UI スレッドをブロックしない）

**パフォーマンス最適化**:
- リスト表示は `ListView.builder` を使用（遅延読み込み）
- 画像は適切なサイズにリサイズ
- 不要な再ビルドを避ける（`const` 使用、Provider の細分化）
- MediaPipe 処理はフレームスキップを考慮（30fps 維持）

```dart
// Good - 大量のアイテムを効率的に表示
ListView.builder(
  itemCount: sessions.length,
  itemBuilder: (context, index) {
    return SessionListItem(session: sessions[index]);
  },
)

// Bad - 全アイテムを一度に生成
ListView(
  children: sessions.map((s) => SessionListItem(session: s)).toList(),
)
```

**エラーハンドリング**:
- すべての非同期処理に try-catch
- ユーザーにわかりやすいエラーメッセージを表示
- エラー時の代替 UI を提供（ErrorWidget）

### Flutter UI/UX ベストプラクティス

**アクセシビリティ**:
- すべてのインタラクティブ要素に Semantics を提供
- 十分なタップ領域（最小 48x48 dp）
- コントラスト比を確保（WCAG AA 準拠）

**レスポンシブデザイン**:
- ハードコードされたサイズを避ける
- MediaQuery でデバイスサイズに応じた調整
- LayoutBuilder で柔軟なレイアウト

**国際化対応**:
- ハードコードされたテキストを避ける
- intl パッケージ使用（将来の多言語対応のため）
- 日付・数値フォーマットは locale に応じて変換

### Firebase Functions ベストプラクティス

**セキュリティ**:
- すべてのエンドポイントで認証確認
- カスタムクレームで認可制御
- 入力値は必ずバリデーション

```typescript
// Good
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  // 認証チェック
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "認証が必要です");
  }

  // 入力バリデーション
  if (!data.displayName || data.displayName.length > 50) {
    throw new functions.https.HttpsError("invalid-argument", "表示名が無効です");
  }

  // 認可チェック
  if (context.auth.uid !== data.userId) {
    throw new functions.https.HttpsError("permission-denied", "権限がありません");
  }

  // 処理実行
  // ...
});
```

**Firestore トランザクション**:
- 複数ドキュメントの更新は transaction を使用
- 書き込みは最大500件まで（バッチ制限）
- 楽観的ロックで競合を防ぐ

**ログとモニタリング**:
- 構造化ログを使用（JSON形式）
- 適切なログレベル（debug, info, warn, error）
- パフォーマンスメトリクスを記録

```typescript
logger.info("Session created", {
  userId: userId,
  sessionId: sessionId,
  exerciseType: exerciseType,
  duration: performance.now() - startTime
});
```

### Firebase Security Rules

参考: https://firebase.google.com/docs/rules

**基本原則**:
- デフォルトは全拒否（明示的に許可したもののみアクセス可能）
- 認証済みユーザーのみアクセス許可
- フィールドレベルでのアクセス制御を実装
- `request.auth.uid` で本人確認を徹底

**Firestore Security Rules ベストプラクティス**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function hasValidData() {
      return request.resource.data.keys().hasAll(['requiredField1', 'requiredField2']);
    }

    // Users コレクション
    match /users/{userId} {
      // 自分のドキュメントのみ読み取り可能
      allow read: if isOwner(userId);

      // 作成は認証済みで自分のuidの場合のみ
      allow create: if isAuthenticated()
                    && request.auth.uid == userId
                    && hasValidData();

      // 更新は自分のドキュメントで、特定フィールドのみ
      allow update: if isOwner(userId)
                    && !request.resource.data.diff(resource.data)
                         .affectedKeys().hasAny(['tosAccepted', 'ppAccepted', 'deletionScheduled']);

      // 削除は禁止（Cloud Functionsから実行）
      allow delete: if false;

      // サブコレクション
      match /sessions/{sessionId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId) && hasValidData();
        allow update, delete: if false; // 不変データ
      }
    }

    // 削除予定ユーザーのアクセス制限
    match /users/{userId} {
      allow write: if isOwner(userId)
                   && !resource.data.deletionScheduled;
    }
  }
}
```

**重要なポイント**:

1. **フィールドレベルアクセス制御**:
   - `tosAccepted`, `ppAccepted`, `deletionScheduled` などの重要フィールドは読み取り専用
   - `diff()` を使用して変更されたフィールドを検証

2. **データバリデーション**:
   - 必須フィールドの存在確認
   - 型とフォーマットの検証
   - 値の範囲チェック

```javascript
// データ型検証の例
function isValidSession() {
  let data = request.resource.data;
  return data.exerciseType is string
      && data.exerciseType in ['squat', 'armcurl', 'sideraise', 'shoulderpress', 'pushup']
      && data.startTime is timestamp
      && data.poseData is list
      && data.poseData.size() <= 10000; // 最大フレーム数
}
```

3. **削除猶予期間の実装**:
   - `deletionScheduled` フラグが true の場合は書き込み禁止
   - 読み取りのみ許可（データエクスポート用）

4. **カスタムクレームの活用**:
```javascript
function isAdmin() {
  return request.auth.token.admin == true;
}

function shouldForceLogout() {
  return request.auth.token.forceLogout == true;
}
```

**テスト**:
- Firebase エミュレータで必ずテスト
- 単体テスト作成（`@firebase/rules-unit-testing`）
- 本番デプロイ前に必ず動作確認

```bash
# セキュリティルールのテスト
firebase emulators:start --only firestore
npm test -- --testPathPattern=firestore.rules.test.ts
```

### Cloud IAM (Identity and Access Management)

参考: https://docs.cloud.google.com/iam/docs/overview

**基本原則**:
- 最小権限の原則（必要最小限の権限のみ付与）
- サービスアカウントごとに役割を分離
- カスタムロールで細かい権限制御
- 定期的な権限監査

**サービスアカウントの設計**:

このプロジェクトでは以下のサービスアカウントを使用：

1. **Cloud Functions サービスアカウント**:
   - Firestore 読み取り/書き込み
   - BigQuery データ編集者
   - Cloud Tasks エンキューア
   - Cloud Logging 書き込み

```bash
# 必要な権限の付与例
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${FUNCTION_SA}" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${FUNCTION_SA}" \
  --role="roles/bigquery.dataEditor"
```

2. **BigQuery データ処理サービスアカウント**:
   - BigQuery ジョブユーザー
   - BigQuery データ閲覧者（特定データセットのみ）

3. **デプロイ用サービスアカウント** (CI/CD):
   - Cloud Functions デプロイヤー
   - Firestore ルールデプロイヤー
   - サービスアカウントユーザー

**IAM ポリシーのベストプラクティス**:

1. **プロジェクトレベルの権限は最小限に**:
```bash
# Bad - プロジェクト全体へのオーナー権限
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA}" \
  --role="roles/owner"

# Good - 必要なリソースのみに限定
gcloud functions add-iam-policy-binding ${FUNCTION_NAME} \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudfunctions.invoker" \
  --region=${REGION}
```

2. **条件付きIAMポリシー**:
```bash
# 特定のリソースタグがある場合のみアクセス許可
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA}" \
  --role="roles/bigquery.dataEditor" \
  --condition='expression=resource.matchTag("env", "production"),title=production-only'
```

3. **定期的な権限監査**:
```bash
# 現在のIAMポリシーを確認
gcloud projects get-iam-policy ${PROJECT_ID} \
  --format=json > iam-policy.json

# サービスアカウントの権限を確認
gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SA}"
```

**Firebase Admin SDK の権限**:

Cloud Functions内でFirebase Admin SDKを使用する場合：

```typescript
import * as admin from "firebase-admin";

// デフォルト認証情報を使用（推奨）
admin.initializeApp();

// 特定のサービスアカウントを使用する場合
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.PROJECT_ID
});
```

**セキュリティのチェックリスト**:

- [ ] すべてのサービスアカウントに最小権限のみ付与
- [ ] プロダクション環境ではカスタムサービスアカウント使用
- [ ] サービスアカウントキーはSecure Managerで管理
- [ ] 不要になったサービスアカウントは削除
- [ ] IAMポリシーの変更はバージョン管理
- [ ] 定期的な権限監査（月次推奨）
- [ ] アラート設定（不正なアクセス検知）

**環境分離**:

開発・ステージング・本番で異なるFirebaseプロジェクトを使用：

```bash
# 開発環境
firebase use dev
firebase deploy --only functions

# 本番環境
firebase use production
firebase deploy --only functions
```

**監査ログ**:

Cloud Audit Logsを有効化してすべてのIAM変更を記録：

```bash
# 監査ログの有効化
gcloud logging read "protoPayload.methodName=SetIamPolicy" \
  --limit 50 \
  --format json
```

## フェーズ計画

`09_開発タスク詳細_スケジュール_v3_3.md` より：

### Phase 1 (0-2ヶ月): インフラ構築
- Firebase セットアップ、認証
- 基本的な Firestore コレクション
- セキュリティルール実装

### Phase 2 (2-7ヶ月): 機能実装
- 5種目のフォーム評価
- MediaPipe 統合
- 決済機能（RevenueCat）
- BigQuery 分析パイプライン

### Phase 3+ (将来): MVP外
- カスタムMLモデル（MediaPipe置き換え）
- ソーシャル機能
- 多言語対応

**実装前に必ず機能のフェーズを確認してください。**

## 実装時の確認事項

新機能を実装する前に、以下のドキュメントを確認：

1. **要件確認**: `00_要件定義書_v3_3.md` で該当する機能要件番号（FR-xxx）を確認
2. **アーキテクチャ確認**: `01_システムアーキテクチャ設計書_v3_2.md` でコンポーネント間の関係を確認
3. **データ設計確認**: `02_Firestoreデータベース設計書_v3_3.md` で必要なコレクションとフィールドを確認
4. **API仕様確認**: `03_API設計書_Firebase_Functions_v3_3.md` でエンドポイントとリクエスト/レスポンス形式を確認
5. **UI設計確認**: `05_画面遷移図_ワイヤーフレーム_v3_3.md` で画面レイアウトと遷移を確認
6. **法的制約確認**: 利用規約・プライバシーポリシーで制約事項を確認
7. **フェーズ確認**: `09_開発タスク詳細_スケジュール_v3_3.md` で実装タイミングを確認

## 重要な注意事項

- **推測禁止**: ドキュメントにない実装は必ず「推測」と明記
- **仕様書優先**: コード実装より仕様書の内容を優先
- **フェーズ厳守**: Phase 3の機能をPhase 1-2で実装しない
- **法令遵守**: 薬機法・GDPR・個人情報保護法を必ず確認