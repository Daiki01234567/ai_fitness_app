● flutter_appのテストコマンドをまとめます。

  Flutter テストコマンド一覧

  単体テスト（Unit Tests）

  # 全テスト実行
  cd C:\Users\katos\Desktop\ai_fitness_app\flutter_app
  flutter test

  # 特定ディレクトリのテスト
  flutter test test/core/auth/              # 認証関連
  flutter test test/core/consent/           # 同意管理関連
  flutter test test/screens/                # 画面テスト

  # 特定ファイルのテスト
  flutter test test/core/auth/auth_state_notifier_test.dart
  flutter test test/core/consent/consent_state_notifier_test.dart

  # カバレッジ付きで実行
  flutter test --coverage

  # 詳細出力
  flutter test --reporter expanded

  統合テスト（Integration Tests）

  # 統合テスト実行（デバイス/エミュレータ必要）
  flutter test integration_test/

  # 特定の統合テストファイル
  flutter test test/integration/pose_session_integration_test.dart

  # ヘッドレスモードで実行（Chrome）
  flutter test integration_test/ -d chrome

  よく使う組み合わせ

  # 全テスト + カバレッジ + 詳細出力
  flutter test --coverage --reporter expanded

  # 失敗時に停止
  flutter test --fail-fast

  # 特定のテスト名にマッチするもののみ
  flutter test --name "auth"

  # 並列実行数を指定
  flutter test --concurrency=4

  ワンライナー（PowerShell）

  # プロジェクトルートから全テスト
  cd C:\Users\katos\Desktop\ai_fitness_app\flutter_app; flutter test

  # 静的解析 + テスト
  cd C:\Users\katos\Desktop\ai_fitness_app\flutter_app; flutter analyze; flutter test
