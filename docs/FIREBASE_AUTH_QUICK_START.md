# Firebase 認証設定 - クイックスタート

**Firebase Project ID**: `tokyo-list-478804-e5`
**所要時間**: 10分
**対象**: 開発チーム

---

## 実行チェックリスト

このリストを上から順に実行してください。

### 1. Firebase Console を開く

```
URL: https://console.firebase.google.com/project/tokyo-list-478804-e5/authentication
```

### 2. Email/Password 認証を有効化

1. **Sign-in method タブ** をクリック
2. **Email/Password** をクリック
3. **Enable** を選択
4. **Save** をクリック

```
確認: "Email/Password authentication has been enabled."
```

### 3. パスワードポリシーを確認

Sign-in method タブで下にスクロール、**Password Policy** を確認:

```
✓ Minimum password length: 8文字
✓ Require uppercase and lowercase: ☑ (チェック)
✓ Require numbers: ☑ (チェック)
```

### 4. Authorized domains に localhost を追加

1. **Settings タブ** をクリック
2. **Authorized domains** をクリック
3. `localhost` がリストに含まれているか確認
4. なければ入力フィールドに `localhost` と入力して **Add domain** をクリック

```
確認: localhost がリストに表示される
```

### 5. パスワードリセット メール を日本語化

1. **Settings > Templates** をクリック
2. **Password reset email** をクリック
3. **Subject** フィールドを編集:
   ```
   Reset your password
   ↓
   パスワードリセット
   ```
4. **Save** をクリック

```
確認: "Template saved successfully"
```

### 6. エミュレータでテスト

```bash
firebase emulators:start
```

ブラウザで `http://localhost:4000` を開き、
Firestore / Authentication エミュレータが起動していることを確認

---

## トラブルシューティング

| 問題 | 解決方法 |
|------|--------|
| Email/Password が見つからない | ページ再読み込み (F5) |
| localhost がない | Settings > Authorized domains で手動追加 |
| メール日本語化されない | テンプレート保存を再度確認 |
| エミュレータ起動エラー | `npm install` を実行後、再度 `firebase emulators:start` |

---

## 次のステップ

- Flutter アプリ側の認証機能テスト
- Firestore セキュリティルール設定

---

## 詳細ガイド

詳しい説明は こちらを参照:
```
docs/FIREBASE_AUTH_SETUP_GUIDE.md
```

---

**完了時刻**: __________ (実施者)
