# 003 Firestoreセキュリティルール実装

## 概要

Firestoreのセキュリティルールを実装し、ユーザーのデータを適切に保護する。自分のデータは自分だけがアクセスでき、他人のデータには絶対にアクセスできないようにする。

## 関連する機能要件

- NFR-034: Firestoreセキュリティルール詳細（完全実装）
- NFR-012: アクセス制御（Cloud IAM）
- FR-024: 同意管理
- FR-025: データ削除権

## 依存関係

- 前提: 002-firebase-foundation
- 後続: 004-email-password-auth, 010-terms-agreement-screen

## 作業内容

### Todo

- [ ] usersコレクションのセキュリティルール作成
- [ ] sessionsコレクションのセキュリティルール作成
- [ ] consentsコレクションのセキュリティルール作成
- [ ] フィールドレベルアクセス制御の実装（tosAccepted, ppAccepted, deletionScheduled）
- [ ] 削除予定ユーザーの書き込み禁止ルール
- [ ] ヘルパー関数の作成（isOwner, isAdmin等）
- [ ] セキュリティルールのテスト作成
- [ ] Firebase Emulatorでのテスト実行
- [ ] firestore.rulesファイルの作成/更新

## 技術仕様

### コレクション構造

| コレクション | 説明 | アクセス権限 |
|-------------|------|------------|
| users | ユーザープロフィール | 本人のみ読み書き可能 |
| sessions | トレーニング記録 | 本人のみ読み書き可能 |
| consents | 同意履歴（監査ログ） | 本人のみ読み取り可能、書き込みは追加のみ |

### セキュリティルール

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

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    // ユーザーが削除予定かどうかをチェック
    function isNotScheduledForDeletion() {
      return !resource.data.deletionScheduled;
    }

    // 保護されたフィールドが変更されていないかチェック
    function protectedFieldsUnchanged() {
      return !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['tosAccepted', 'ppAccepted', 'deletionScheduled', 'createdAt']);
    }

    // usersコレクション
    match /users/{userId} {
      // 読み取り: 本人のみ
      allow read: if isOwner(userId);

      // 作成: 認証済みで自分のドキュメントのみ
      allow create: if isOwner(userId);

      // 更新: 本人のみ、ただし保護フィールドは変更不可
      allow update: if isOwner(userId)
        && protectedFieldsUnchanged()
        && isNotScheduledForDeletion();

      // 削除: Cloud Functionsからのみ（直接削除不可）
      allow delete: if false;
    }

    // sessionsコレクション
    match /sessions/{sessionId} {
      // 読み取り: 本人のみ
      allow read: if isAuthenticated()
        && resource.data.userId == request.auth.uid;

      // 作成: 認証済みで自分のデータのみ
      allow create: if isAuthenticated()
        && request.resource.data.userId == request.auth.uid;

      // 更新: 本人のみ
      allow update: if isAuthenticated()
        && resource.data.userId == request.auth.uid;

      // 削除: 不可（Cloud Functionsからのみ）
      allow delete: if false;
    }

    // consentsコレクション（同意履歴）
    match /consents/{consentId} {
      // 読み取り: 本人のみ
      allow read: if isAuthenticated()
        && resource.data.userId == request.auth.uid;

      // 作成: 認証済みで自分のデータのみ（追記のみ）
      allow create: if isAuthenticated()
        && request.resource.data.userId == request.auth.uid;

      // 更新・削除: 不可（監査ログは不変）
      allow update: if false;
      allow delete: if false;
    }

    // デフォルト: すべて拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### フィールドレベルアクセス制御

| フィールド | 読み取り | 書き込み | 説明 |
|-----------|---------|---------|------|
| tosAccepted | 本人 | Cloud Functionsのみ | 利用規約同意フラグ |
| ppAccepted | 本人 | Cloud Functionsのみ | プライバシーポリシー同意フラグ |
| deletionScheduled | 本人 | Cloud Functionsのみ | 削除予定フラグ |
| createdAt | 本人 | 作成時のみ | 作成日時 |

### テスト方法

```bash
# Firebaseエミュレータを起動
firebase emulators:start --only firestore

# テストを実行
npm run test:rules
```

### テストケース

1. **本人がusersを読み取れる**
2. **他人のusersを読み取れない**
3. **本人がsessionsを作成できる**
4. **他人のsessionsを作成できない**
5. **保護フィールド（tosAccepted等）を変更できない**
6. **削除予定ユーザーが書き込みできない**
7. **consentsが更新できない（追記のみ）**
8. **未認証ユーザーがアクセスできない**

## 受け入れ条件

- [ ] firestore.rulesファイルが作成されている
- [ ] 本人のデータのみ読み書きできる
- [ ] 他人のデータにアクセスできない
- [ ] 保護フィールド（tosAccepted, ppAccepted, deletionScheduled）が直接変更できない
- [ ] 削除予定ユーザー（deletionScheduled=true）が書き込みできない
- [ ] consentsコレクションが追記のみで更新・削除不可
- [ ] Firebase Emulatorでテストが全て通る
- [ ] 本番環境にデプロイ可能

## 参照ドキュメント

- docs/expo/specs/02_要件定義書_Expo版_v1_Part2.md（NFR-034）
- docs/specs/02_Firestoreデータベース設計書_v3_3.md
- docs/specs/07_セキュリティポリシー_v1_0.md
- CLAUDE.md（Firebase Security Rules セクション）

## 備考

- 開発中は一時的に緩いルールを使用してもよいが、本番前に必ず厳格なルールに置き換えること
- 管理者機能（isAdmin）はPhase 4で使用予定
- 削除処理は30日間の猶予期間を設けるため、deletionScheduledフラグを使用
