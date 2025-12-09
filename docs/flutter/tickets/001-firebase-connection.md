# 001 Firebase接続設定（FlutterFire CLI）

## 概要

FlutterアプリとFirebaseを接続するための設定を行うチケットです。FlutterFire CLIを使用して、iOS・Android両方のFirebase設定ファイルを自動生成し、`firebase_options.dart`を作成します。

## Phase

Phase 1（基盤構築）

## プラットフォーム

Flutter（フロントエンド）

## 依存チケット

- common/001（Firebase環境確認）

## 要件

### 機能要件

- なし（環境構築チケットのため）

### 非機能要件

- NFR-009: 通信暗号化 - TLS 1.3による通信の暗号化

## 受け入れ条件（Todo）

- [x] FlutterFire CLIがインストールされていることを確認
- [x] `flutterfire configure`コマンドでFirebaseプロジェクト（tokyo-list-478804-e5）に接続
- [x] `lib/firebase_options.dart`が自動生成されることを確認
- [x] `main.dart`でFirebaseを初期化するコードを追加
- [x] `firebase_core`パッケージがpubspec.yamlに追加されていることを確認
- [x] iOS・Androidそれぞれでアプリが起動することを確認
- [x] Firebase Consoleでアプリが登録されていることを確認

## 参照ドキュメント

- `docs/flutter/specs/01_技術スタック_v1_0.md` - Firebase接続方法
- `docs/common/specs/01_プロジェクト概要_v1_0.md` - プロジェクトID確認

## 技術詳細

### FlutterFire CLIのインストール

```bash
# FlutterFire CLIをグローバルにインストール
dart pub global activate flutterfire_cli

# バージョン確認
flutterfire --version
```

### Firebase接続設定コマンド

```bash
# プロジェクトルートで実行
cd flutter_app

# Firebaseプロジェクトに接続（対話式）
flutterfire configure --project=tokyo-list-478804-e5

# 以下を選択:
# - iOS: Yes
# - Android: Yes
# - プラットフォームごとのアプリIDを自動生成
```

### 生成されるファイル

実行後、以下のファイルが自動生成されます:

```
flutter_app/
├── lib/
│   └── firebase_options.dart        # 自動生成（編集禁止）
├── ios/
│   └── Runner/
│       └── GoogleService-Info.plist # iOS用設定ファイル
└── android/
    └── app/
        └── google-services.json     # Android用設定ファイル
```

### main.dartでの初期化

`lib/main.dart`に以下のコードを追加:

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  // Flutterバインディングを初期化
  WidgetsFlutterBinding.ensureInitialized();

  // Firebaseを初期化
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AIフィットネスアプリ',
      home: const HomeScreen(),
    );
  }
}
```

### pubspec.yaml

`firebase_core`パッケージを追加:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.8.0
```

### 確認方法

```bash
# 依存関係をインストール
flutter pub get

# iOS実行（macOSのみ）
flutter run -d ios

# Android実行
flutter run -d android

# エラーなく起動すればOK
```

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|-----|------|------|
| `flutterfire: command not found` | CLIがインストールされていない | `dart pub global activate flutterfire_cli`を実行 |
| `GoogleService-Info.plist not found` | iOS設定が未生成 | `flutterfire configure`を再実行 |
| `google-services.json not found` | Android設定が未生成 | `flutterfire configure`を再実行 |
| ビルドエラー（iOS） | CocoaPods未インストール | `sudo gem install cocoapods && pod install` |
| ビルドエラー（Android） | Gradleキャッシュ破損 | `flutter clean && flutter pub get` |

## 見積もり

- 工数: 0.5日
- 難易度: 低（FlutterFire CLIが自動化してくれる）

## 進捗

- [x] 完了

## 完了日

2025年12月8日

## 備考

- FlutterFire CLIは設定ファイルを自動生成するため、手作業でのエラーが減る
- `firebase_options.dart`は自動生成ファイルなので編集禁止（.gitignoreに追加しない）
- Firebaseプロジェクトは共通バックエンドと同じ`tokyo-list-478804-e5`を使用
- iOS/Androidのバンドル識別子は自動生成される

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
| 2025-12-10 | 既存実装を反映、ステータスを完了に更新 |
