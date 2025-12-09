# 005 Material 3 UI基盤

## 概要

Material 3デザインシステムを使ったUI基盤を構築するチケットです。アプリ全体のテーマ（カラー、タイポグラフィ、コンポーネント）を設定し、統一感のあるUIを実現します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- flutter/002（Flutter開発環境セットアップ）

## 要件

### 機能要件

- なし（UI基盤のため）

### 非機能要件

- NFR-027: UIデザイン - Material 3に準拠したUIデザイン

## 受け入れ条件（Todo）

- [ ] `ThemeData`でMaterial 3が有効化されていることを確認
- [ ] アプリ全体のカラースキームが設定されていることを確認
- [ ] 共通ウィジェット（AppButton、AppTextField等）が実装されていることを確認
- [ ] ダークモード対応していることを確認
- [ ] 全画面で統一されたテーマが適用されていることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - Material 3の説明
- Material Design 3公式: https://m3.material.io/

## 技術詳細

### ThemeDataの設定

`lib/core/theme/app_theme.dart`:

```dart
import 'package:flutter/material.dart';

class AppTheme {
  // ライトテーマ
  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF4CAF50), // メインカラー（緑）
        brightness: Brightness.light,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        filled: true,
      ),
    );
  }

  // ダークテーマ
  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF4CAF50),
        brightness: Brightness.dark,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        filled: true,
      ),
    );
  }
}
```

### main.dartでの適用

```dart
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'AIフィットネスアプリ',
      theme: AppTheme.light(),      // ライトテーマ
      darkTheme: AppTheme.dark(),   // ダークテーマ
      themeMode: ThemeMode.system,  // システム設定に従う
      routerConfig: router,
    );
  }
}
```

### 共通ウィジェット

`lib/core/widgets/app_button.dart`:

```dart
import 'package:flutter/material.dart';

class AppButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;

  const AppButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      child: isLoading
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(text),
    );
  }
}
```

`lib/core/widgets/app_text_field.dart`:

```dart
import 'package:flutter/material.dart';

class AppTextField extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final bool obscureText;
  final TextInputType? keyboardType;

  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.validator,
    this.obscureText = false,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      obscureText: obscureText,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
      ),
    );
  }
}
```

## Material 3の主要コンポーネント

| コンポーネント | 用途 | 例 |
|-------------|------|---|
| ElevatedButton | 主要なアクション | ログインボタン |
| FilledButton | 強調したいアクション | トレーニング開始 |
| TextButton | 副次的なアクション | キャンセル |
| Card | コンテンツのグループ化 | トレーニングカード |
| NavigationBar | ボトムナビゲーション | ホーム/履歴/設定 |
| AppBar | アプリバー | 画面タイトル |

## 見積もり

- 工数: 1日
- 難易度: 低

## 進捗

- [ ] 未着手

## 完了日

未定

## 備考

- Material 3はFlutter 3.10以降でサポート
- `useMaterial3: true`で有効化
- `ColorScheme.fromSeed`で統一されたカラーパレットを自動生成
- ダークモード対応は簡単（ThemeDataを2つ用意するだけ）

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
