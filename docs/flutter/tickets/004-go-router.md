# 004 GoRouter設定

## 概要

GoRouterを使った画面遷移（ルーティング）の基盤を構築するチケットです。認証状態に応じた自動リダイレクト機能を実装し、ログイン前後で適切な画面に遷移できるようにします。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- flutter/003（Riverpod状態管理基盤）

## 要件

### 機能要件

- FR-001: ユーザー登録 - 登録後にホーム画面へ遷移
- FR-002: ログイン - ログイン後にホーム画面へ遷移
- FR-008: ログアウト - ログアウト後にログイン画面へ遷移

### 非機能要件

- NFR-026: コード品質 - 型安全なルーティング

## 受け入れ条件（Todo）

- [x] `go_router`パッケージがpubspec.yamlに追加されていることを確認
- [x] `appRouterProvider`が実装され、全画面のルートが定義されていることを確認
- [x] 認証状態に応じてリダイレクトが動作することを確認
- [x] ログイン前は`/auth/login`にリダイレクトされることを確認
- [x] ログイン後は`/home`にリダイレクトされることを確認
- [x] 画面遷移が型安全に行えることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - GoRouter設定方法
- `docs/flutter/specs/02_開発計画_v1_0.md` - Phase 1ルーティング実装

## 技術詳細

### パッケージ追加

`pubspec.yaml`:

```yaml
dependencies:
  go_router: ^14.6.2
  flutter_riverpod: ^2.4.9
```

### GoRouterの実装

`lib/core/router/app_router.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/home/home_screen.dart';

// GoRouterのProvider
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      // 認証状態をチェック
      final isLoggedIn = authState.value != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      // 未ログイン かつ 認証画面以外 → ログイン画面へ
      if (!isLoggedIn && !isAuthRoute) {
        return '/auth/login';
      }

      // ログイン済み かつ 認証画面 → ホーム画面へ
      if (isLoggedIn && isAuthRoute) {
        return '/home';
      }

      // リダイレクトなし
      return null;
    },
    routes: [
      // スプラッシュ画面
      GoRoute(
        path: '/',
        builder: (context, state) => const SplashScreen(),
      ),

      // 認証画面
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        builder: (context, state) => const RegisterScreen(),
      ),

      // ホーム画面（ログイン後）
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
    ],
  );
});
```

### main.dartでの使用

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'AIフィットネスアプリ',
      routerConfig: router,
    );
  }
}
```

### 画面遷移の使い方

```dart
import 'package:go_router/go_router.dart';

// ログイン画面へ遷移
context.go('/auth/login');

// 登録画面へ遷移（スタックに追加）
context.push('/auth/register');

// 前の画面に戻る
context.pop();

// ホーム画面へ遷移（スタックをクリア）
context.go('/home');
```

## GoRouterの主要メソッド

| メソッド | 説明 | 使用例 |
|---------|------|--------|
| `context.go(path)` | 画面を置き換える | ログイン後のホーム遷移 |
| `context.push(path)` | 画面を追加 | モーダル画面 |
| `context.pop()` | 前の画面に戻る | 戻るボタン |
| `context.replace(path)` | 現在の画面を置き換え | 登録完了後のログイン画面 |

## 見積もり

- 工数: 1日
- 難易度: 中

## 進捗

- [x] 完了

## 完了日

2025年12月8日

## 備考

- GoRouterはFlutterの推奨ルーティングライブラリ
- `redirect`で認証状態に応じた自動リダイレクトを実装
- Riverpodと組み合わせることで型安全なルーティングが可能
- ディープリンク対応も容易

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
