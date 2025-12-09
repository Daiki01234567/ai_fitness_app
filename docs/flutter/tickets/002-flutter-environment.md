# 002 Flutter開発環境セットアップ

## 概要

Flutterアプリの開発に必要な環境を整備し、チーム全員が開発できる状態にするチケットです。Flutter SDK、開発ツール、静的解析ルールをセットアップします。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- flutter/001（Firebase接続設定）

## 要件

### 機能要件

- なし（環境構築チケットのため）

### 非機能要件

- NFR-026: コード品質 - 静的解析ツールによるコード品質の維持

## 受け入れ条件（Todo）

- [x] Flutter SDK 3.10+がインストールされていることを確認
- [x] `flutter doctor`で環境に問題がないことを確認
- [x] `flutter_lints`パッケージが追加されていることを確認
- [x] `analysis_options.yaml`で静的解析ルールが設定されていることを確認
- [x] `flutter analyze`でエラーがないことを確認
- [x] VS CodeまたはAndroid Studioで開発環境が整っていることを確認
- [x] チーム全員が環境構築完了していることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - 開発環境セットアップ手順
- `docs/flutter/specs/02_開発計画_v1_0.md` - Phase 1のタスク詳細

## 技術詳細

### Flutter SDKのインストール確認

```bash
# Flutterバージョン確認
flutter --version

# 必要なバージョン: 3.10以上
# Dart: 3.10以上

# 環境診断
flutter doctor

# 問題がある場合は指示に従って修正
```

### pubspec.yamlの設定

```yaml
name: flutter_app
description: "AIフィットネスアプリ"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.10.1

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0  # 静的解析ルール
```

### analysis_options.yamlの設定

プロジェクトルートに`analysis_options.yaml`を作成:

```yaml
# Flutter Lintsの推奨ルールを使用
include: package:flutter_lints/flutter.yaml

# 追加の解析ルール
linter:
  rules:
    - avoid_print
    - prefer_const_constructors
    - prefer_final_locals
    - always_declare_return_types

analyzer:
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
```

### 開発コマンド

```bash
# 依存関係インストール
flutter pub get

# 静的解析実行
flutter analyze

# テスト実行
flutter test

# アプリ実行
flutter run
```

### VS Code推奨拡張機能

- Dart（公式）
- Flutter（公式）
- Flutter Riverpod Snippets
- Error Lens

## 見積もり

- 工数: 0.5日
- 難易度: 低

## 進捗

- [x] 完了

## 完了日

2025年12月8日

## 備考

- Flutter SDKは公式サイトからインストール
- `flutter doctor`で環境に問題がないか確認
- 静的解析ルールはチーム全体で統一

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
