# Ticket #008: 同意管理機能実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 3-4
**優先度**: 最高
**ステータス**: 完了（統合テスト作成済み）
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-002, FR-024)
- `docs/specs/利用規約_v3_2.md`
- `docs/specs/プライバシーポリシー_v3.1.md`
- `docs/specs/06_データ処理記録_ROPA_v1_0.md`

## 概要
GDPR準拠の同意管理機能を実装し、利用規約・プライバシーポリシーへの同意を適切に管理する。

## Todo リスト

### Flutter側実装

#### 同意画面 (`screens/legal/consent_screen.dart`)
- [x] 初回ログイン時の同意画面
  - [x] 利用規約全文表示（スクロール可能）
  - [x] プライバシーポリシー全文表示
  - [x] 個別同意チェックボックス
  - [x] 「すべてに同意」ボタン
  - [x] 「同意しない」オプション
- [x] 同意状態の表示
  - [x] 現在の同意状況
  - [x] 同意日時
  - [x] バージョン情報

#### 同意更新画面
- [x] 規約更新時の再同意画面（consent_screen.dartで対応）
- [ ] 変更点のハイライト表示（Phase 3検討）
- [x] 部分同意オプション（個別チェックボックス）
- [x] 同意撤回の影響説明

#### 同意撤回機能
- [x] 同意撤回ボタン
- [x] 撤回確認ダイアログ
  - [x] 影響の説明
  - [x] データ削除オプション
  - [x] 最終確認
- [x] 撤回後の処理
  - [x] 強制ログアウト
  - [x] アプリ機能制限（ルーターリダイレクト）

#### プロフィール画面統合
- [x] 同意管理セクション追加（consent_management_section.dart）
- [x] 同意状態の表示
- [x] 同意履歴へのリンク
- [x] 規約へのリンク

### Cloud Functions 実装

#### 同意記録API (`api/consent/record.ts`)
- [x] エンドポイント実装
- [x] 同意タイプバリデーション
  - [x] 利用規約 (ToS)
  - [x] プライバシーポリシー (PP)
  - [ ] マーケティング（オプション）- Phase 3検討
- [x] Consents コレクション記録
- [x] Users コレクション更新
  - [x] `tosAccepted` フラグ
  - [x] `ppAccepted` フラグ
  - [x] `tosVersion`
  - [x] `ppVersion`
- [x] タイムスタンプ記録

#### 同意撤回API (`api/consent/revoke.ts`)
- [x] エンドポイント実装
- [x] 撤回タイプ処理
- [x] カスタムクレーム設定
  - [x] `forceLogout: true`
- [x] セッション無効化
- [x] 監査ログ記録
- [x] データ削除リクエスト作成（該当する場合）

#### 同意状態確認API (`api/consent/status.ts`)
- [x] 現在の同意状態取得
- [x] 同意履歴取得
- [x] 必要な再同意チェック（バージョン比較）

#### 同意バージョン管理
- [x] 規約バージョン管理（ToS v3.2, PP v3.1）
- [x] 変更履歴管理（Consentsコレクション）
- [x] 自動再同意要求トリガー（ルーターリダイレクト）

### Firestore 実装

#### Consents コレクション設計
```typescript
interface ConsentRecord {
  userId: string;
  type: 'tos' | 'privacy' | 'marketing';
  version: string;
  accepted: boolean;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
  method: 'explicit' | 'implicit';
  parentalConsent?: boolean;
}
```

#### セキュリティルール
- [x] Consents コレクションは読み取りのみ（ユーザー本人）
- [x] 作成は Cloud Functions 経由のみ
- [x] 不変性の保証（更新・削除不可）

### 強制ログアウト機能

#### クライアント側
- [x] アプリ起動時のクレームチェック（auth_state_notifier.dart）
- [x] バックグラウンド復帰時のチェック
- [x] forceLogout 検知時の処理
  - [x] ローカルデータクリア
  - [x] ログイン画面への遷移
  - [x] 説明メッセージ表示

#### サーバー側
- [x] IDトークン更新時のチェック
- [x] API呼び出し時の検証
- [x] 自動クレーム伝播

### GDPR準拠機能

#### 同意の記録
- [x] 明示的同意の証跡
- [x] タイムスタンプ
- [x] IPアドレス（匿名化）
- [x] 同意取得方法

#### データポータビリティ
- [ ] 同意履歴のエクスポート（Phase 3検討）
- [ ] JSON/CSV形式（Phase 3検討）
- [ ] 暗号化（Phase 3検討）

#### 同意管理ダッシュボード（管理者用）
- [ ] ユーザー同意状態一覧（Phase 3検討）
- [ ] 統計情報（Phase 3検討）
- [ ] コンプライアンスレポート（Phase 3検討）

### テスト実装

#### 単体テスト
- [x] 同意記録ロジック（テストファイル作成済み）
- [x] 撤回処理（テストファイル作成済み）
- [x] バージョン比較（テストファイル作成済み）

**作成済みテストファイル**:
- `functions/tests/api/consent/record.test.ts`
- `functions/tests/api/consent/revoke.test.ts`
- `functions/tests/api/consent/status.test.ts`
- `flutter_app/test/core/consent/consent_state_notifier_test.dart`

#### 統合テスト
- [x] 同意フロー全体（Firebaseエミュレータ必要）
- [x] 強制ログアウト（Firebaseエミュレータ必要）
- [x] 再同意フロー（Firebaseエミュレータ必要）

**作成済み統合テストファイル**:
- `functions/tests/integration/setup.ts` - エミュレータ接続セットアップ
- `functions/tests/integration/consent-flow.test.ts` - 同意フロー全体テスト (16テスト)
- `functions/tests/integration/force-logout.test.ts` - 強制ログアウトテスト (14テスト)
- `functions/tests/integration/re-consent-flow.test.ts` - 再同意フローテスト (15テスト)

**実行方法**:
```bash
# エミュレータ起動（別ターミナル）
firebase emulators:start

# 統合テスト実行
cd functions
npm run test:integration
```

#### コンプライアンステスト
- [x] GDPR要件チェック
- [x] 監査ログ確認
- [x] データ保護確認

**作成済みコンプライアンステストファイル**:
- `functions/tests/compliance/gdpr.test.ts` - GDPR Article 7, 15, 17準拠テスト (21テスト)
- `functions/tests/compliance/audit-log.test.ts` - 監査ログ検証テスト (24テスト)
- `functions/tests/compliance/data-protection.test.ts` - データ保護テスト (36テスト)

## 受け入れ条件
- [x] 初回ログイン時に同意画面が表示される
- [x] 同意が正しく記録される
- [x] 同意撤回で強制ログアウトされる
- [x] 同意履歴が確認できる
- [x] GDPR要件を満たす
- [x] 監査証跡が残る

## 技術的詳細

### 同意フロー
1. ユーザーがログイン
2. `authStateProvider`が認証状態を検知
3. `consentStateProvider`が同意状態をFirestoreから取得
4. `app_router.dart`のリダイレクトロジックが`needsConsent`をチェック
5. 未同意の場合、`/consent`へリダイレクト
6. ユーザーが規約を下までスクロール→チェックボックス有効化
7. 両方にチェック後「同意して続ける」ボタン有効化
8. Cloud Functions `recordConsent`を呼び出し
9. Firestore `consents`コレクションに記録、`users`ドキュメント更新
10. 同意完了後、`/home`へリダイレクト

### 強制ログアウトフロー
1. ユーザーが「同意を解除」を選択
2. 確認ダイアログでデータ削除オプション表示
3. Cloud Functions `revokeConsent`を呼び出し
4. カスタムクレーム`forceLogout: true`を設定
5. Firestore `users`ドキュメントに`forceLogout: true`を設定
6. クライアント側で検知、自動ログアウト
7. ログイン画面へリダイレクト

## 注意事項
- 同意は明示的でなければならない（デフォルトチェック禁止）✓
- 未成年者（13歳未満）の対応検討 → 利用規約で13歳以上を明記
- 同意文書のバージョン管理 ✓
- 法的要件の定期的な確認

## 次のステップ
1. ~~プロフィール画面への`ConsentManagementSection`ウィジェット組み込み~~ ✓ 完了
2. ~~Firebaseエミュレータでの統合テスト作成~~ ✓ 完了
3. 統合テストの実行（`firebase emulators:start` + `npm run test:integration`）
4. 本番デプロイ

## 参考リンク
- [GDPR同意要件](https://gdpr-info.eu/art-7-gdpr/)
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Flutter Legal Compliance](https://flutter.dev/docs/development/data-and-backend/state-mgmt/simple#legal)
