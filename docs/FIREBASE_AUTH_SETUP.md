# Firebase Authentication Setup Guide

**Version**: 1.0.0
**Date**: 2025-11-24
**Status**: Implemented

## 概要

このドキュメントでは、AI Fitness AppのFirebase Authentication実装と設定手順を説明します。

## 実装済み機能

### Cloud Functions (Backend)

1. **認証トリガー関数**
   - `onUserCreate`: 新規ユーザー作成時にUsersコレクションを初期化
   - `onUserDelete`: アカウント削除時の関連データクリーンアップ
   - `processScheduledDeletions`: 30日猶予期間後の削除処理（スケジュール実行）

2. **カスタムクレーム管理**
   - `setCustomClaims`: カスタムクレーム設定（管理者のみ）
   - `removeCustomClaims`: カスタムクレーム削除（管理者のみ）
   - `getCustomClaims`: カスタムクレーム取得
   - `onConsentWithdrawn`: 同意撤回時の強制ログアウト

3. **実装ファイル**
   ```
   functions/src/auth/
   ├── onCreate.ts       # ユーザー作成トリガー
   ├── onDelete.ts       # ユーザー削除トリガー
   ├── customClaims.ts   # カスタムクレーム管理
   └── index.ts          # エクスポート
   ```

### Flutter (Frontend)

1. **認証状態管理**
   - `AuthStateNotifier`: Riverpodベースの状態管理
   - 認証状態の監視とリアルタイム更新
   - トークン自動リフレッシュ（50分ごと）
   - 強制ログアウト検知

2. **認証サービス**
   - メール/パスワード認証
   - 電話番号認証（SMS）
   - Google Sign In（準備済み）
   - Apple Sign In（準備済み）
   - メールリンク認証

3. **実装ファイル**
   ```
   flutter_app/lib/core/auth/
   ├── auth_state_notifier.dart  # 認証状態管理
   └── auth_service.dart          # 認証サービス
   ```

## Firebase Console設定

### 必要な設定

#### 1. 認証プロバイダーの有効化

Firebase Console > Authentication > Sign-in method で以下を有効化：

- ✅ **メール/パスワード**
  - メールリンク（パスワードなしでログイン）も有効化可能

- ✅ **電話番号**
  - テスト電話番号を追加可能（開発用）
  - 例: `+81 90-1234-5678` / コード: `123456`

- ⏸️ **Google** （SHA証明書が必要）
  - OAuth同意画面の設定が必要
  - SHA-1/SHA-256フィンガープリントの登録が必要

- ⏸️ **Apple** （iOS設定が必要）
  - Apple Developer Programへの登録が必要
  - App ID、Service IDの設定が必要

#### 2. テンプレート設定

Firebase Console > Authentication > Templates で日本語テンプレートを設定：

- **パスワードリセット**
- **メールアドレス確認**
- **メールアドレス変更**
- **SMSメッセージ**

#### 3. Authorized domains

Firebase Console > Authentication > Settings > Authorized domains：

- `localhost` (開発用)
- プロダクションドメイン（本番用）

## SHA証明書の取得方法

### Android SHA-1/SHA-256 フィンガープリント

#### デバッグ証明書（開発用）

Windows (PowerShell):
```powershell
keytool -list -v -alias androiddebugkey -keystore $env:USERPROFILE\.android\debug.keystore
# パスワード: android
```

Mac/Linux:
```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore
# パスワード: android
```

#### リリース証明書（本番用）

1. キーストアファイルを作成:
```bash
keytool -genkey -v -keystore release-key.keystore -alias key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. SHA証明書を取得:
```bash
keytool -list -v -keystore release-key.keystore -alias key-alias
```

3. Firebase Consoleに登録:
   - Project Settings > Your apps > Android app
   - "SHA certificate fingerprints"に追加

## エミュレータでのテスト

### 1. エミュレータ起動

```bash
# Firebase エミュレータを起動
firebase emulators:start --only auth,firestore,functions

# または個別に起動
firebase emulators:start --only auth
firebase emulators:start --only firestore
firebase emulators:start --only functions
```

### 2. エミュレータ設定

`firebase.json`:
```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### 3. Flutter アプリでエミュレータを使用

`main.dart` に追加:
```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // エミュレータを使用（開発環境のみ）
  if (kDebugMode) {
    // Auth エミュレータ
    await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);

    // Firestore エミュレータ
    FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);

    // Functions エミュレータ
    FirebaseFunctions.instanceFor(region: 'asia-northeast1')
      .useFunctionsEmulator('localhost', 5001);
  }

  runApp(MyApp());
}
```

### 4. エミュレータUIアクセス

ブラウザで `http://localhost:4000` にアクセスして：

- **Authentication**: テストユーザーの作成・管理
- **Firestore**: データの確認・編集
- **Functions**: 関数ログの確認

## テストシナリオ

### 1. 新規ユーザー登録

```dart
// Flutter コード例
final authNotifier = ref.read(authStateProvider.notifier);

await authNotifier.signUpWithEmailAndPassword(
  email: 'test@example.com',
  password: 'Test1234!',
  displayName: 'テストユーザー',
);
```

期待される動作:
1. Firebase Authにユーザーが作成される
2. `onUserCreate`トリガーが実行される
3. Firestoreに`users/{uid}`ドキュメントが作成される
4. 設定、同意ログが初期化される

### 2. メール確認

```dart
await authNotifier.sendEmailVerification();
```

### 3. ログイン/ログアウト

```dart
// ログイン
await authNotifier.signInWithEmailAndPassword(
  email: 'test@example.com',
  password: 'Test1234!',
);

// ログアウト
await authNotifier.signOut();
```

### 4. カスタムクレーム設定（管理者のみ）

```dart
final authService = AuthService();

// 管理者権限を付与
await authService.setCustomClaims(
  targetUserId: 'target-user-id',
  claims: {'admin': true},
);

// 強制ログアウトを設定
await authService.setCustomClaims(
  targetUserId: 'target-user-id',
  claims: {'forceLogout': true},
);
```

### 5. アカウント削除リクエスト

```dart
await authNotifier.requestAccountDeletion();
```

期待される動作:
1. `dataDeletionRequests`コレクションにリクエスト作成
2. ユーザードキュメントに`deletionScheduled: true`設定
3. 30日後に自動削除（スケジュール関数）

### 6. 電話番号認証

```dart
final authService = AuthService();

// SMS送信
await authService.signInWithPhoneNumber(
  phoneNumber: '090-1234-5678',
  onCodeSent: (verificationId) {
    // 確認コード入力画面を表示
  },
  onError: (error) {
    // エラー処理
  },
);

// 確認コードで認証
await authService.verifyPhoneCode('123456');
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. "PERMISSION_DENIED" エラー

**原因**: Firestoreセキュリティルールが厳しすぎる
**解決**: エミュレータモードでテストするか、一時的にルールを緩和

#### 2. Google Sign Inが動作しない

**原因**: SHA証明書が登録されていない
**解決**:
1. SHA-1/SHA-256フィンガープリントを取得
2. Firebase Consoleに登録
3. `google-services.json`を再ダウンロード
4. アプリを再ビルド

#### 3. 電話番号認証でSMSが届かない

**原因**:
- テスト環境での制限
- 電話番号形式の問題

**解決**:
- エミュレータでテスト電話番号を使用
- 本番環境では`+81`形式を使用

#### 4. カスタムクレームが反映されない

**原因**: トークンのキャッシュ
**解決**:
```dart
// トークンを強制リフレッシュ
final idTokenResult = await user.getIdTokenResult(true);
```

## セキュリティベストプラクティス

1. **パスワードポリシー**
   - 最小8文字
   - 大文字・小文字・数字・特殊文字を含む
   - 定期的な変更を推奨

2. **セッション管理**
   - IDトークンの有効期限: 1時間
   - リフレッシュトークン: 適切に管理
   - 強制ログアウト機能の実装

3. **カスタムクレーム**
   - 管理者権限は慎重に付与
   - 定期的な権限レビュー
   - 監査ログの記録

4. **データ保護**
   - GDPR準拠の削除処理
   - 個人情報の最小化
   - 暗号化通信（HTTPS）

## 次のステップ

### 実装が必要な項目

1. **UI実装**
   - ログイン画面
   - 新規登録画面
   - パスワードリセット画面
   - プロフィール編集画面

2. **追加認証プロバイダー**
   - Google Sign In（SHA証明書登録後）
   - Apple Sign In（iOS設定後）
   - その他のソーシャル認証

3. **セキュリティ強化**
   - 多要素認証（MFA）
   - reCAPTCHA統合
   - App Check有効化

4. **監視・分析**
   - 認証イベントのログ記録
   - 異常検知アラート
   - 使用状況分析

## 参考リンク

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [FlutterFire Authentication](https://firebase.flutter.dev/docs/auth/overview)
- [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Custom Claims Best Practices](https://firebase.google.com/docs/auth/admin/custom-claims#best_practices)