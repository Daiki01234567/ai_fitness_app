# クイックスタートテストガイド

**最終更新日**: 2025-11-26
**対象者**: 開発者、QAテスター
**所要時間**: 約15分

---

## 1. 環境準備（5分）

### 1.1 前提条件
- Flutter SDK がインストール済み
- Node.js 24+ がインストール済み
- Firebase CLI がインストール済み

### 1.2 セットアップコマンド

```bash
# 1. リポジトリのクローン（初回のみ）
git clone <repository-url>
cd ai_fitness_app

# 2. Flutter依存関係のインストール
cd flutter_app
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs

# 3. Cloud Functions依存関係のインストール
cd ../functions
npm install

# 4. Firebaseエミュレータの起動
cd ..
firebase emulators:start
```

---

## 2. Flutter テスト実行（5分）

### 2.1 全テスト実行
```bash
cd flutter_app
flutter test
```

### 2.2 認証関連テストのみ
```bash
# AuthNotifierテスト
flutter test test/core/auth/auth_state_notifier_test.dart

# ログイン画面テスト
flutter test test/screens/auth/login_screen_test.dart
```

### 2.3 期待される結果
```
✓ All tests passed!
```

---

## 3. Cloud Functions テスト実行（5分）

### 3.1 全テスト実行
```bash
cd functions
npm test
```

### 3.2 特定テストのみ
```bash
# 認証トリガーテスト
npm test -- --testPathPattern=auth

# APIテスト
npm test -- --testPathPattern=api
```

### 3.3 期待される結果
```
Test Suites: X passed, X total
Tests:       X passed, X total
```

---

## 4. 手動テストチェックリスト

### 4.1 ログインテスト（必須）
- [ ] 正常なメール/パスワードでログイン成功
- [ ] 不正なパスワードでエラー表示
- [ ] 存在しないメールでエラー表示

### 4.2 新規登録テスト（必須）
- [ ] 有効な情報で登録成功
- [ ] 重複メールでエラー表示
- [ ] パスワード不一致でエラー表示

### 4.3 パスワードリセットテスト（必須）
- [ ] 登録済みメールでリセットメール送信成功
- [ ] 成功メッセージ表示

---

## 5. トラブルシューティング

| 問題 | 解決策 |
|------|--------|
| `flutter pub get` 失敗 | `flutter clean` 後に再実行 |
| エミュレータ起動失敗 | ポート競合確認 (8080, 9099, 5001) |
| テスト失敗 | `build_runner build` を再実行 |
| npm test 失敗 | `npm run build` を先に実行 |

---

## 6. 次のステップ

詳細なテスト手順は以下を参照：
- [USER_AUTHENTICATION_TEST_GUIDE.md](./USER_AUTHENTICATION_TEST_GUIDE.md)

テスト結果の報告：
- [TEST_REPORT_TEMPLATE.md](./TEST_REPORT_TEMPLATE.md)

---

## 連絡先

テストに関する質問：
- Slack: #dev-testing
- メール: dev-team@example.com
