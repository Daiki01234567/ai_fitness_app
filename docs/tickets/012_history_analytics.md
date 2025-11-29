# Ticket #012: 履歴・分析機能実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 7-8
**優先度**: 高
**ステータス**: なし
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (FR-028～FR-030)
- `docs/specs/04_BigQuery設計書_v3_3.md`
- `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md`

## 概要
トレーニング履歴の表示、進捗トラッキング、パフォーマンス分析機能を実装する。

## Todo リスト

### 履歴画面

#### HistoryScreen (`screens/history/history_screen.dart`)
- [x] カレンダービュー
  - [x] 月表示
  - [x] トレーニング実施日マーク
  - [x] 強度による色分け
  - [x] 日付タップで詳細表示
- [x] リストビュー
  - [x] 無限スクロール
  - [x] 日付グルーピング
  - [x] サムネイル表示
  - [x] クイック統計
- [x] フィルタリング
  - [x] 期間選択
  - [x] 種目フィルタ
  - [x] スコアレンジ
  - [ ] タグ検索 *(将来実装)*

#### SessionDetailScreen (`screens/history/session_detail_screen.dart`)
- [x] セッション情報
  - [x] 日時・時間
  - [x] 実施種目リスト
  - [x] 総レップ数/セット数
  - [x] 平均フォームスコア
- [x] 種目別詳細
  - [x] セット毎の結果
  - [x] フォームスコア推移
  - [x] 問題点リスト
  - [x] ベスト/ワーストレップ
- [x] メモ機能
  - [x] テキストメモ追加
  - [x] タグ付け
  - [x] 体調記録
  - [x] 編集/削除
- [ ] エクスポート *(将来実装)*
  - [ ] PDF生成
  - [ ] CSV出力
  - [ ] 画像保存

### 分析画面

#### AnalyticsScreen (`screens/analytics/analytics_screen.dart`)
- [x] 概要ダッシュボード
  - [x] 今週の実績
  - [x] 月間トレンド
  - [x] 目標達成率
  - [x] ストリーク表示
- [x] 期間選択
  - [x] 週/月/3ヶ月/年
  - [ ] カスタム期間 *(将来実装)*
  - [ ] 比較期間設定 *(将来実装)*

#### ProgressCharts (カスタム実装: `_ScoreProgressPainter`)
- [x] トレーニング頻度
  - [x] 週間ヒートマップ *(カレンダービューで実装)*
  - [x] 月間カレンダー
  - [ ] 時間帯分析 *(将来実装)*
- [x] ボリューム推移
  - [x] 総レップ数グラフ
  - [x] セット数グラフ
  - [x] 運動時間グラフ
- [x] フォームスコア推移
  - [x] 種目別ライングラフ
  - [ ] 移動平均表示 *(将来実装)*
  - [ ] 標準偏差バンド *(将来実装)*
- [x] パーソナルレコード
  - [x] 種目別ベストスコア
  - [x] 最長ストリーク
  - [x] 最多レップ数

#### ComparativeAnalysis *(将来実装)*
- [ ] 期間比較
  - [ ] 前週/前月比較
  - [ ] YoY比較
  - [ ] カスタム期間比較
- [ ] 種目間比較
  - [ ] レーダーチャート
  - [ ] 強み/弱み分析
  - [ ] バランススコア
- [ ] ベンチマーク比較
  - [ ] 年齢グループ平均
  - [ ] フィットネスレベル別
  - [ ] 目標との差異

### 詳細分析

#### FormAnalysisView (`screens/analytics/form_analysis_view.dart`)
- [x] フォーム改善トレンド
  - [x] 各評価項目の推移
  - [x] 改善速度分析
  - [x] プラトー検出
- [x] エラーパターン分析
  - [x] よくある間違いTop5
  - [x] 時間帯別傾向
  - [x] 疲労による劣化分析
- [x] 相関分析
  - [x] レップ数とフォームの関係
  - [ ] 速度とフォームの関係 *(将来実装)*
  - [x] セット間の劣化

#### RecommendationEngine (`core/history/recommendation_engine.dart`)
- [x] トレーニング推奨
  - [x] 次回メニュー提案
  - [x] 負荷調整アドバイス
  - [x] 休息日提案
- [x] フォーム改善提案
  - [x] 重点改善ポイント
  - [x] 補助エクササイズ
  - [x] ストレッチ推奨
- [x] 目標設定支援
  - [x] 現実的な目標提案
  - [x] マイルストーン設定
  - [ ] 達成予測 *(将来実装)*

### データ同期

#### HistorySyncService (`core/history/history_sync_service.dart`)
- [x] ローカルキャッシュ
  - [x] SharedPreferences実装 *(MVPでSQLiteの代わり)*
  - [x] 最近30日分保持
  - [x] オフライン対応
- [x] Firestore同期
  - [x] バックグラウンド同期
  - [x] 競合解決 (キューイング)
  - [x] 差分同期 (キャッシュ有効期限)
- [ ] BigQuery連携 *(将来実装)*
  - [ ] 日次バッチ準備
  - [ ] 集計データ取得
  - [ ] 分析結果キャッシュ

### レポート生成

#### ReportGenerator (`core/history/report_generator.dart`)
- [x] 週次レポート
  - [x] 実績サマリ
  - [x] 改善ポイント
  - [x] 翌週目標
- [x] 月次レポート
  - [x] 詳細分析
  - [x] 進捗評価
  - [x] トレンド分析
- [ ] カスタムレポート *(将来実装)*
  - [ ] テンプレート選択
  - [ ] 項目カスタマイズ
  - [ ] PDF/HTML出力

### ウィジェット

#### StatsCard (`widgets/stats_card.dart`)
- [x] 数値表示
- [x] トレンド矢印
- [x] ミニグラフ
- [x] タップで詳細

#### ProgressBar (`widgets/progress_bar.dart`)
- [ ] 目標達成率 *(将来実装)*
- [ ] アニメーション
- [ ] カラーコーディング

#### AchievementBadge (`widgets/achievement_badge.dart`)
- [ ] バッジアイコン *(将来実装)*
- [ ] 獲得条件表示
- [ ] シェア機能

### 実績システム

#### AchievementManager (`services/achievement_manager.dart`)
- [ ] バッジ定義
  - [ ] 初心者（初回完了）
  - [ ] 継続者（7日連続）
  - [ ] マスター（全種目90点以上）
- [ ] 実績チェック
  - [ ] セッション完了時
  - [ ] 日次/週次集計時
- [ ] 通知
  - [ ] 獲得時ポップアップ
  - [ ] プッシュ通知

### テスト実装

#### 単体テスト
- [x] 統計計算ロジック (`test/core/history/history_service_test.dart` - 32テスト)
- [x] フィルタリング処理 (`test/core/history/history_models_test.dart` - 46テスト)
- [x] データ集計処理 (`test/core/history/history_state_test.dart` - 45テスト)

#### 統合テスト
- [x] 履歴画面表示フロー (`test/integration/history_screen_integration_test.dart` - 28テスト)
- [x] 分析画面表示フロー (`test/integration/analytics_screen_integration_test.dart` - 34テスト)
- [x] セッション詳細画面 (`test/integration/session_detail_integration_test.dart` - 47テスト)
- [ ] レポート生成 *(将来: PDF/CSVエクスポート実装時)*
- [ ] オフラインキャッシュ動作 *(将来: SQLite実装時)*

#### UIテスト
- [x] グラフ描画 *(統合テストでカバー)*
- [x] スクロールパフォーマンス *(統合テストでカバー)*
- [ ] レスポンシブ対応 *(将来実装)*

## 受け入れ条件
- [x] 履歴が正しく表示される
- [x] グラフがスムーズに描画される（カスタムペインター使用）
- [x] フィルタリングが高速に動作
- [ ] オフラインでも基本機能が使える *(将来: SQLiteキャッシュ実装時)*
- [ ] レポートが正しく生成される *(将来: PDF/CSVエクスポート実装時)*

## 注意事項
- 大量データでのパフォーマンス考慮
- グラフライブラリの選定（fl_chart推奨）
- データプライバシー（共有時の配慮）
- アクセシビリティ（グラフの代替テキスト）

## 参考リンク
- [fl_chart](https://pub.dev/packages/fl_chart)
- [SQLite Flutter](https://pub.dev/packages/sqflite)
- [PDF Generation](https://pub.dev/packages/pdf)

---

## 実装状況サマリー

**最終更新**: 2025-11-29

### 完了した機能
1. **履歴画面 (HistoryScreen)**: 4タブ構成（概要/日/週/月）、カレンダービュー、セッションリスト
2. **履歴詳細画面 (SessionDetailScreen)**: セット詳細、メモ・タグ編集、体調記録表示
3. **分析画面 (AnalyticsScreen)**: 概要ダッシュボード、週/月/3ヶ月/年の期間選択、種目別統計
4. **統計ウィジェット (StatsCard)**: 数値表示、トレンド矢印、カード形式
5. **履歴サービス (HistoryService)**: Firestore連携、フィルタリング、統計計算
6. **カスタムグラフ (_ScoreProgressPainter, _SimpleChartPainter)**: fl_chart不要のCustomPainter実装
7. **フォーム分析ビュー (FormAnalysisView)**: トレンド分析、エラーパターン、疲労分析、相関分析
8. **推奨エンジン (RecommendationEngine)**: トレーニング提案、負荷調整、休息日提案、目標設定
9. **同期サービス (HistorySyncService)**: オフラインキャッシュ、Firestore同期、操作キューイング
10. **レポート生成 (ReportGenerator)**: 週次/月次レポート、テキスト出力、JSON構造

### 実装ファイル一覧
```
flutter_app/lib/
├── core/
│   ├── history/
│   │   ├── history_models.dart         # HistorySession, HistorySetRecord, etc.
│   │   ├── history_service.dart        # Firestore連携サービス
│   │   ├── history_state.dart          # Riverpod状態管理
│   │   ├── recommendation_engine.dart  # 推奨エンジン (NEW)
│   │   ├── history_sync_service.dart   # オフライン同期 (NEW)
│   │   └── report_generator.dart       # レポート生成 (NEW)
│   └── theme/
│       └── app_theme.dart              # AppColors追加
├── screens/
│   ├── history/
│   │   ├── history_screen.dart         # 履歴画面
│   │   └── session_detail_screen.dart  # 詳細画面
│   ├── analytics/
│   │   ├── analytics_screen.dart       # 分析画面
│   │   └── form_analysis_view.dart     # 詳細フォーム分析 (NEW)
│   └── widgets/
│       ├── stats_card.dart             # 統計カードウィジェット
│       └── bottom_nav_bar.dart         # 下部ナビゲーション
└── core/router/
    └── app_router.dart                 # /history, /analytics ルート追加
```

### 新規追加した依存関係 (pubspec.yaml)
- `connectivity_plus: ^6.0.5` - ネットワーク接続監視
- `shared_preferences: ^2.3.2` - ローカルキャッシュ

### 将来の実装予定
- タグ検索機能
- PDF/CSVエクスポート
- カスタム期間選択
- 比較分析機能
- SQLiteへの移行（大量データ対応）
- 実績システム（バッジ）
- BigQuery連携

### テストファイル一覧
```
flutter_app/test/
├── core/history/
│   ├── history_models_test.dart     # 46テスト - モデル・シリアライズ
│   ├── history_service_test.dart    # 32テスト - Firestoreサービス
│   └── history_state_test.dart      # 45テスト - 状態管理
└── integration/
    ├── history_screen_integration_test.dart    # 28テスト - 履歴画面
    ├── analytics_screen_integration_test.dart  # 34テスト - 分析画面
    └── session_detail_integration_test.dart    # 47テスト - セッション詳細

合計: 232テスト
```
