● テストを分割して実行する方法をご説明します。

  Jestでテストを分割実行する方法

  1. フォルダ指定で実行

  # 特定フォルダのみ
  npm test -- tests/services
  npm test -- tests/middleware
  npm test -- tests/utils
  npm test -- tests/api
  npm test -- tests/compliance
  npm test -- tests/gdpr

  # カバレッジ付きで特定フォルダ
  npm test -- --coverage tests/services
  npm test -- --coverage tests/middleware
  npm test -- --coverage tests/utils

  2. ファイルパターン指定

  # 特定のテストファイル
  npm test -- tests/services/bigquery.test.ts
  npm test -- tests/services/gdpr/*.test.ts

  # パターンマッチ
  npm test -- --testPathPattern="services/gdpr"
  npm test -- --testPathPattern="middleware"

  3. タイムアウト値を変更

  # タイムアウトを延長（ミリ秒）
  npm test -- --testTimeout=60000
  npm test -- --coverage --testTimeout=120000

  4. 推奨：段階的カバレッジ取得

  テストを以下の順序で分割実行することをお勧めします：

  cd functions

  # Step 1: utils（軽量）
  npm test -- --coverage tests/utils

  # Step 2: middleware
  npm test -- --coverage tests/middleware

  # Step 3: services (最も重い)
  npm test -- --coverage tests/services

  # Step 4: api
  npm test -- --coverage tests/api

  # Step 5: compliance & gdpr
  npm test -- --coverage tests/compliance tests/gdpr

  5. package.jsonにスクリプト追加（オプション）

  よく使うパターンをスクリプトとして追加できます：

  "scripts": {
    "test:utils": "jest tests/utils",
    "test:services": "jest tests/services",
    "test:middleware": "jest tests/middleware",
    "test:coverage:utils": "jest --coverage tests/utils",
    "test:coverage:services": "jest --coverage tests/services"
  }