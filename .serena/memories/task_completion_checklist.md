# タスク完了時チェックリスト

## コード変更後

### 1. Lint チェック
```powershell
cd expo_app && npm run lint
# または
cd functions && npm run lint
```

### 2. 型チェック
```powershell
cd expo_app && npm run typecheck
```

### 3. フォーマット
```powershell
cd expo_app && npm run format
# または
cd functions && npm run format
```

### 4. テスト実行（該当する場合）
```powershell
cd functions && npm test
```

## ドキュメント更新

- 関連チケットの更新（`docs/expo/tickets/` または `docs/common/tickets/`）
- Todoアイテムのチェック: `[ ]` → `[x]`

## 仕様書の確認

実装前に必ず確認:
1. `docs/common/specs/` - 共通仕様書
2. `docs/expo/specs/` - Expo固有仕様書
3. 関連チケット - 詳細要件

## コミット前

```powershell
git status
git diff
```

## 注意事項

- `CLAUDE.md` のルールを遵守
- 推測で実装する場合は「推測である」と明示
- Phase 3以降の機能をPhase 1-2で実装しない
- 薬機法・GDPR・個人情報保護法を遵守
