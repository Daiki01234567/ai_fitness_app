# 003 Riverpod状態管理基盤

## 概要

Riverpodを使った状態管理の基盤を構築するチケットです。認証状態を管理する`authStateProvider`を実装し、アプリ全体で状態を共有できるようにします。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- flutter/002（Flutter開発環境セットアップ）

## 要件

### 機能要件

- FR-001: ユーザー登録 - 認証状態の管理が必要
- FR-002: ログイン - 認証状態の管理が必要

### 非機能要件

- NFR-026: コード品質 - 型安全な状態管理

## 受け入れ条件（Todo）

- [x] `flutter_riverpod`パッケージがpubspec.yamlに追加されていることを確認
- [x] `main.dart`で`ProviderScope`がアプリ全体をラップしていることを確認
- [x] `authStateProvider`が実装され、Firebase認証状態を監視していることを確認
- [x] 認証状態が変化したときに自動で画面が更新されることを確認
- [x] ProviderScopeでDI（依存性注入）ができることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - Riverpod状態管理の説明
- `docs/flutter/specs/02_開発計画_v1_0.md` - Phase 1 Riverpod実装詳細

## 技術詳細

### パッケージ追加

`pubspec.yaml`:

```yaml
dependencies:
  flutter_riverpod: ^2.4.9
  freezed_annotation: ^2.4.1

dev_dependencies:
  build_runner: ^2.4.13
  freezed: ^2.5.7
  riverpod_generator: ^2.6.3
```

### main.dartでProviderScopeをラップ

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(
    // アプリ全体をProviderScopeでラップ
    const ProviderScope(
      child: MyApp(),
    ),
  );
}
```

### 認証状態管理Providerの実装

`lib/core/auth/auth_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';

// Firebase Authインスタンス
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

// 認証状態の監視（StreamProvider）
final authStateProvider = StreamProvider<User?>((ref) {
  final auth = ref.watch(firebaseAuthProvider);
  return auth.authStateChanges();
});

// 認証サービスProvider
final authServiceProvider = Provider<AuthService>((ref) {
  final auth = ref.watch(firebaseAuthProvider);
  return AuthService(auth);
});

// 認証操作を行うサービスクラス
class AuthService {
  final FirebaseAuth _auth;

  AuthService(this._auth);

  // メール/パスワードでログイン
  Future<UserCredential> signInWithEmailAndPassword(
    String email,
    String password,
  ) async {
    return await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  // メール/パスワードで新規登録
  Future<UserCredential> createUserWithEmailAndPassword(
    String email,
    String password,
  ) async {
    return await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  // ログアウト
  Future<void> signOut() async {
    await _auth.signOut();
  }

  // 現在のユーザーを取得
  User? get currentUser => _auth.currentUser;
}
```

### Providerの使い方（ConsumerWidget）

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 認証状態を監視
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (user) {
        if (user == null) {
          return const Text('ログインしていません');
        }
        return Text('ユーザーID: ${user.uid}');
      },
      loading: () => const CircularProgressIndicator(),
      error: (error, stack) => Text('エラー: $error'),
    );
  }
}
```

### Providerの使い方（StatefulWidget + ConsumerStatefulWidget）

```dart
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  Future<void> _login() async {
    final authService = ref.read(authServiceProvider);
    try {
      await authService.signInWithEmailAndPassword('email@example.com', 'password');
    } catch (e) {
      print('ログインエラー: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: _login,
      child: const Text('ログイン'),
    );
  }
}
```

## Riverpodの主要な概念

| 概念 | 説明 | 使用例 |
|-----|------|--------|
| **Provider** | 変更されない値を提供 | サービスクラスのインスタンス |
| **StateProvider** | 変更可能な単純な値を提供 | カウンター、フラグ |
| **StreamProvider** | Streamを監視 | Firebase認証状態 |
| **FutureProvider** | Futureを監視 | API呼び出し |
| **StateNotifierProvider** | 複雑な状態管理 | ログインフォーム状態 |

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025年12月8日

## 備考

- Riverpodは型安全な状態管理ライブラリ
- `ref.watch`は値が変化したときに再ビルド
- `ref.read`は一度だけ値を取得（ボタン押下時など）
- ConsumerWidgetまたはConsumerStatefulWidgetを使用

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
