# Ticket #011: トレーニングセッション画面実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 6-7
**優先度**: 最高
**ステータス**: MVP機能完了 ✅
**関連仕様書**:
- `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md`
- `docs/specs/00_要件定義書_v3_3.md` (FR-019～FR-023)

## 概要
トレーニングセッションの開始、実行、結果表示までの一連の画面を実装する。

## 実装済みファイル

### 画面
| ファイル | 概要 |
|---------|------|
| `lib/screens/session/exercise_selection_screen.dart` | 種目選択画面（5種目カード表示） |
| `lib/screens/session/pre_session_screen.dart` | セッション準備画面（カメラ設定、チェックリスト） |
| `lib/screens/session/active_session_screen.dart` | トレーニング実行画面（カメラ、スケルトン、フィードバック） |
| `lib/screens/session/session_result_screen.dart` | 結果画面（サマリ、セット別詳細） |

### 状態管理
| ファイル | 概要 |
|---------|------|
| `lib/core/session/session_state.dart` | セッション状態管理（Riverpod StateNotifier） |
| `lib/core/session/session_state.freezed.dart` | Freezed生成ファイル |

### ルーティング
| ファイル | 変更内容 |
|---------|----------|
| `lib/core/router/app_router.dart` | 4つの新しいルートを追加（/training, /training/setup, /training/active, /training/result） |

## Todo リスト

### セッション準備画面

#### ExerciseSelectionScreen (`screens/session/exercise_selection_screen.dart`)
- [x] 種目選択UI
  - [x] 5種目カード表示
  - [x] 種目説明テキスト
  - [x] 推奨レベル表示（初級/中級）
  - [ ] プレビュー動画/画像 (MVP後)
- [ ] カスタムワークアウト (MVP後)
  - [ ] 複数種目選択
  - [ ] 順序変更
  - [ ] セット数設定
  - [ ] レスト時間設定
- [ ] プリセットワークアウト (MVP後)
  - [ ] 初心者向け
  - [ ] 中級者向け
  - [ ] 上級者向け
  - [ ] 時短メニュー

#### PreSessionScreen (`screens/session/pre_session_screen.dart`)
- [x] 準備確認
  - [x] カメラプレビュー表示
  - [x] スケルトンオーバーレイ
  - [x] 4項目チェックリスト（明るさ/服装/スペース/カメラ位置）
  - [x] 自動カウントダウン開始
- [ ] キャリブレーション (MVP後)
  - [ ] Tポーズ取得
  - [ ] 身長推定
  - [ ] カメラ距離調整
- [x] 目標設定
  - [x] レップ数入力（SessionConfigで管理）
  - [x] セット数入力（SessionConfigで管理）
  - [ ] 目標フォームスコア (MVP後)

### トレーニング実行画面

#### ActiveSessionScreen (`screens/session/active_session_screen.dart`)
- [x] カメラビュー
  - [x] リアルタイム映像表示
  - [x] ミラーリング対応（フロントカメラ）
  - [ ] ズーム調整 (MVP後)
  - [ ] 明るさ自動調整 (MVP後)
- [x] スケルトンオーバーレイ
  - [x] 33ランドマーク描画（PosePainter）
  - [x] 信頼度による透明度
  - [x] カラーコーディング
  - [x] 問題箇所ハイライト（フィードバック表示）
- [x] リアルタイム情報表示
  - [x] 現在のレップ数
  - [x] 現在のセット数
  - [x] フォームスコア
  - [x] タイマー（経過時間）
  - [ ] 心拍数（オプション、MVP後）

#### SessionControlPanel (ActiveSessionScreen内に統合)
- [x] セッションコントロール
  - [x] 一時停止/再開
  - [x] 停止（確認ダイアログ付き）
  - [ ] スキップ（次の種目へ）(MVP後)
  - [x] 音声ON/OFF
  - [ ] フィードバックレベル調整 (MVP後)
- [x] 緊急停止
  - [x] 即座停止ボタン（×ボタン）
  - [x] データ保存確認

#### RestDialog (ActiveSessionScreen内のRestDialog)
- [x] レスト時間表示
  - [x] カウントダウンタイマー
  - [x] プログレスバー
  - [x] スキップオプション
- [ ] 前セット結果表示 (MVP後)
  - [ ] レップ数
  - [ ] フォームスコア
  - [ ] 改善ポイント
- [ ] 次セット準備 (MVP後)
  - [ ] 目標調整オプション
  - [ ] モチベーションメッセージ

### フィードバック表示

#### RealTimeFeedbackOverlay (ActiveSessionScreen内に統合)
- [x] 視覚的フィードバック
  - [x] スケルトンオーバーレイでの問題箇所表示
  - [ ] 改善矢印 (MVP後)
  - [ ] 角度表示 (MVP後)
  - [ ] 速度インジケーター (MVP後)
  - [ ] 深さゲージ (MVP後)
- [x] テキストフィードバック
  - [x] 現在の問題点（最優先のIssue表示）
  - [x] 改善方法（FormFeedbackのmessage）
  - [x] 励ましメッセージ（良いフォームです表示）
- [ ] 音声フィードバック制御 (MVP後)
  - [ ] 音量調整
  - [ ] 頻度設定
  - [ ] 言語選択

#### FormScoreWidget (ActiveSessionScreen内に統合)
- [x] スコア表示
  - [x] 数値表示（0-100点）
  - [x] 色分け（緑/黄/赤）
  - [ ] 円グラフ/ゲージ (MVP後)
  - [ ] トレンド矢印 (MVP後)
- [ ] 詳細スコア (MVP後)
  - [ ] 各評価項目
  - [ ] レーダーチャート
  - [ ] 時系列グラフ

### 結果画面

#### SessionResultScreen (`screens/session/session_result_screen.dart`)
- [x] セッションサマリ
  - [x] 総運動時間
  - [x] 総レップ数
  - [x] 平均フォームスコア
  - [x] セット完了数
  - [ ] 消費カロリー（推定）(MVP後)
  - [ ] 達成率 (MVP後)
- [x] 詳細結果
  - [x] セット別結果（レップ数、スコア、時間）
  - [ ] 種目別結果 (MVP後)
  - [ ] ベストレップ (MVP後)
  - [ ] 要改善ポイント (MVP後)
- [ ] 進捗トラッキング (MVP後)
  - [ ] 前回との比較
  - [ ] 週間目標達成度
  - [ ] パーソナルベスト更新
- [ ] シェア機能 (MVP後)
  - [ ] 結果画像生成
  - [ ] SNSシェア
  - [ ] 友達に送信

#### ImprovementSuggestions (MVP後)
- [ ] AI分析結果
  - [ ] 主な改善点（Top3）
  - [ ] 具体的なアドバイス
  - [ ] 参考動画リンク
- [ ] 次回推奨メニュー
  - [ ] 難易度調整
  - [ ] 重点改善種目
  - [ ] 補助エクササイズ

### データ管理

#### SessionStateManager (Riverpod) - `lib/core/session/session_state.dart`
- [x] セッション状態管理
  - [x] 開始/実行中/休憩/終了（SessionPhase enum）
  - [x] 現在の種目/セット/レップ
  - [x] 累計データ（completedSets）
- [x] リアルタイムデータ同期
  - [x] MediaPipeデータ受信（poseSessionControllerProvider連携）
  - [x] フォーム評価結果（currentScore, currentIssues）
  - [x] フィードバック履歴
- [ ] セッションリカバリ (MVP後)
  - [ ] 中断時の自動保存
  - [ ] 復帰オプション

### アニメーション

#### TransitionAnimations
- [x] カウントダウンアニメーション（TweenAnimationBuilder）
- [ ] 画面遷移アニメーション (MVP後)
- [ ] 達成アニメーション (MVP後)
- [ ] フィードバックアニメーション (MVP後)

### アクセシビリティ

#### AccessibilityFeatures (MVP後)
- [ ] VoiceOver/TalkBack対応
- [x] 大きなタップ領域（48dp以上、FilledButton/IconButtonで実現）
- [ ] 高コントラストモード
- [ ] フォントサイズ調整

### テスト実装

#### Widget テスト (MVP後に拡充)
- [ ] 各画面のレンダリング
- [ ] ユーザーインタラクション
- [ ] 状態遷移

#### 統合テスト
- [x] セッション完全フロー（pose_session_integration_test.dart）
- [ ] エラーリカバリー
- [ ] データ永続化

#### パフォーマンステスト (MVP後)
- [ ] 60fps維持確認
- [ ] メモリリーク検出
- [ ] バッテリー消費測定

## 受け入れ条件
- [x] スムーズな画面遷移
- [x] リアルタイムフィードバックが表示される
- [x] セッション中断・再開が可能
- [x] 結果が正しく集計・表示される
- [x] すべての種目で動作する（5種目対応）

## 注意事項
- カメラ使用時のバッテリー消費に配慮
- プライバシー保護（録画オプションは明示的同意）
- ネットワーク切断時もローカルで動作継続
- 画面回転ロック推奨

## 参考リンク
- [Flutter Camera Best Practices](https://flutter.dev/docs/cookbook/plugins/picture-using-camera)
- [Material Design Motion](https://material.io/design/motion)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)