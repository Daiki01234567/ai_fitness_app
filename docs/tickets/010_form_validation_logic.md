# Ticket #010: 5種目フォーム確認ロジック実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 5-6
**優先度**: 最高
**ステータス**: 実装完了（90%）- 実機テスト待ち
**最終更新**: 2025-12-01
**関連仕様書**:
- `docs/specs/08_README_form_validation_logic_v3_3.md`
- `docs/specs/00_要件定義書_v3_3.md` (FR-010～FR-018)
- `docs/specs/06_データ処理記録_ROPA_v1_0.md` (750 - 854)

## 概要
スクワット、アームカール、サイドレイズ、ショルダープレス、プッシュアップの5種目について、MediaPipeで取得した姿勢データを基にフォームを評価するロジックを実装する。

## Todo リスト

### 共通基盤実装

#### FormAnalyzer基底クラス (`lib/core/form_analyzer/base/base_analyzer.dart`)
- [x] 抽象基底クラス定義
  - [x] 角度計算メソッド（3点から角度算出）
  - [x] 速度計算メソッド
  - [x] 可動域チェック
  - [x] 対称性評価
- [x] 共通ユーティリティ (`lib/core/form_analyzer/utils/math_utils.dart`)
  - [x] ベクトル演算 (Vector2D, Vector3D)
  - [x] 移動平均フィルタ (MovingAverageFilter)
  - [x] 外れ値除去 (OutlierRemover)
  - [ ] カルマンフィルタ（オプション - 将来実装）

#### フィードバック管理 (`lib/core/form_analyzer/models/form_feedback.dart`)
- [x] フィードバックレベル定義
  - [x] Excellent (90-100%)
  - [x] Good (70-89%)
  - [x] Fair (50-69%)
  - [x] NeedsImprovement (<50%)
- [x] フィードバックタイプ
  - [x] リアルタイムアラート
  - [x] セット完了時サマリ
  - [x] セッション終了時詳細

### スクワット実装

#### SquatAnalyzer (`lib/core/form_analyzer/analyzers/squat_analyzer.dart`)
- [x] キーポイント取得
  - [x] 腰 (Hip)
  - [x] 膝 (Knee)
  - [x] 足首 (Ankle)
  - [x] 肩 (Shoulder)
- [x] 深さ評価
  - [x] 膝角度計算（目標: 90度）
  - [x] 腰の位置追跡
  - [x] パラレル判定
- [x] 膝の位置チェック
  - [x] 膝が爪先より前に出ていないか
  - [x] 内側に入っていないか（knee valgus）
  - [x] 左右の対称性
- [x] 背中の角度
  - [x] 前傾角度（適正: 15-30度）
  - [x] 腰椎の過伸展チェック
- [x] レップカウント
  - [x] 下降フェーズ検出
  - [x] 上昇フェーズ検出
  - [x] 完全なレップ判定

### アームカール実装

#### BicepCurlAnalyzer (`lib/core/form_analyzer/analyzers/bicep_curl_analyzer.dart`)
- [x] キーポイント取得
  - [x] 肩 (Shoulder)
  - [x] 肘 (Elbow)
  - [x] 手首 (Wrist)
- [x] 可動域評価
  - [x] 開始位置（フル伸展）
  - [x] 終了位置（フル収縮）
  - [x] 肘角度追跡（30-160度）
- [x] フォームチェック
  - [x] 肘の固定（スイング防止）
  - [x] 手首の角度維持
  - [x] 肩の上昇チェック
- [x] テンポ分析
  - [x] コンセントリック速度
  - [x] エキセントリック速度
  - [x] 一定速度の維持

### サイドレイズ実装

#### LateralRaiseAnalyzer (`lib/core/form_analyzer/analyzers/lateral_raise_analyzer.dart`)
- [x] キーポイント取得
  - [x] 肩 (Shoulder)
  - [x] 肘 (Elbow)
  - [x] 手首 (Wrist)
  - [x] 腰 (Hip)
- [x] 挙上角度評価
  - [x] 目標角度（70-90度）
  - [x] 左右対称性
  - [x] 平行維持
- [x] 姿勢チェック
  - [x] 体幹の安定性
  - [x] 反動使用検出
  - [x] 肩すくめ防止
- [x] 動作スムーズネス
  - [x] 加速度分析
  - [x] ジャーク（急激な動き）検出

### ショルダープレス実装

#### ShoulderPressAnalyzer (`lib/core/form_analyzer/analyzers/shoulder_press_analyzer.dart`)
- [x] キーポイント取得
  - [x] 肩 (Shoulder)
  - [x] 肘 (Elbow)
  - [x] 手首 (Wrist)
  - [x] 頭 (Head)
- [x] プレス経路分析
  - [x] 垂直性評価
  - [x] 左右バランス
  - [x] フルレンジ確認
- [x] 安全性チェック
  - [x] 肘の過伸展防止
  - [x] 腰椎過伸展チェック
  - [x] 首の位置確認
- [x] 負荷バランス
  - [x] 左右均等性
  - [x] 速度一貫性

### プッシュアップ実装

#### PushUpAnalyzer (`lib/core/form_analyzer/analyzers/pushup_analyzer.dart`)
- [x] キーポイント取得
  - [x] 肩 (Shoulder)
  - [x] 肘 (Elbow)
  - [x] 手首 (Wrist)
  - [x] 腰 (Hip)
  - [x] 膝 (Knee)
  - [x] 足首 (Ankle)
- [x] 体のアライメント
  - [x] プランクポジション維持
  - [x] 腰の落ち込み検出
  - [x] 臀部の上昇検出
- [x] 深さ評価
  - [x] 肘角度（目標: 90度）
  - [x] 胸と床の距離
- [x] 手の位置
  - [x] 肩幅チェック
  - [x] 前後位置の適正性

### リアルタイムフィードバック

#### FeedbackManager (`lib/core/form_analyzer/services/feedback_manager.dart`)
- [x] 音声フィードバック
  - [x] Text-to-Speech実装（TtsService interface）
  - [x] タイミング制御（3秒間隔）
  - [x] 優先度管理
  - [x] 「参考:」プレフィックス（法的要件）
- [x] 視覚フィードバック
  - [x] 問題箇所ハイライト（onVisualFeedbackUpdate callback）
  - [x] 現在の問題リスト管理
- [ ] 触覚フィードバック（将来実装）
  - [ ] バイブレーション
  - [ ] パターン設定

### データ記録

#### SessionDataRecorder (`lib/core/form_analyzer/services/session_data_recorder.dart`)
- [x] フォーム評価データ
  - [x] 各レップのスコア
  - [x] 問題点の記録
  - [x] 改善傾向分析
- [x] 統計情報
  - [x] 平均スコア
  - [x] 最高/最低スコア
  - [x] 一貫性評価（scoreDistribution）
- [x] Firestore連携
  - [x] toFirestoreDocument()
  - [x] toJson()
- [ ] ビデオハイライト（将来実装）
  - [ ] ベストレップ
  - [ ] 要改善レップ
  - [ ] タイムスタンプ記録

### テスト実装

#### 単体テスト (`test/core/form_analyzer/`)
- [x] math_utils_test.dart: 角度計算精度、速度計算精度
- [x] squat_analyzer_test.dart: スクワット評価ロジック
- [x] feedback_manager_test.dart: フィードバック管理
- [x] session_data_recorder_test.dart: データ記録

#### 統合テスト (`test/integration/`)
- [x] MediaPipe→Analyzer連携 (form_analyzer_integration_test.dart)
- [x] リアルタイムパフォーマンス (form_analyzer_performance_test.dart)
- [x] フィードバック遅延測定 (form_analyzer_performance_test.dart)

#### 検証データセット
- [x] 正しいフォームサンプル (テストヘルパー関数で生成)
- [x] 一般的なエラーパターン (knee_over_toe, elbow_swing)
- [x] エッジケース (low_confidence, empty_frame)

### パフォーマンス最適化
- [x] 計算量削減
  - [x] 必要最小限のランドマーク使用
  - [x] フレームスキップ戦略（RecorderConfig.sampleRate）
- [x] メモリ最適化
  - [x] 循環バッファ使用（maxFramesInMemory）
  - [x] autoFlush機能
- [ ] レイテンシ最小化
  - [ ] 予測アルゴリズム
  - [ ] キャッシング戦略

## 実装完了ファイル一覧

### Core Models & Base
- `lib/core/form_analyzer/models/form_feedback.dart` - フィードバックモデル
- `lib/core/form_analyzer/base/base_analyzer.dart` - 基底クラス
- `lib/core/form_analyzer/utils/math_utils.dart` - 数学ユーティリティ

### Analyzers (5種目)
- `lib/core/form_analyzer/analyzers/squat_analyzer.dart` - スクワット
- `lib/core/form_analyzer/analyzers/bicep_curl_analyzer.dart` - アームカール
- `lib/core/form_analyzer/analyzers/lateral_raise_analyzer.dart` - サイドレイズ
- `lib/core/form_analyzer/analyzers/shoulder_press_analyzer.dart` - ショルダープレス
- `lib/core/form_analyzer/analyzers/pushup_analyzer.dart` - プッシュアップ

### Services
- `lib/core/form_analyzer/services/feedback_manager.dart` - フィードバック管理
- `lib/core/form_analyzer/services/session_data_recorder.dart` - データ記録

### Factory & Exports
- `lib/core/form_analyzer/analyzer_factory.dart` - ファクトリー
- `lib/core/form_analyzer/form_analyzer.dart` - モジュールエクスポート

### Tests (85 tests passing)
- `test/core/form_analyzer/math_utils_test.dart`
- `test/core/form_analyzer/squat_analyzer_test.dart`
- `test/core/form_analyzer/feedback_manager_test.dart`
- `test/core/form_analyzer/session_data_recorder_test.dart`

## 受け入れ条件
- [x] 5種目すべてでフォーム評価が機能する
- [ ] リアルタイムフィードバック遅延 < 100ms（要統合テスト）
- [ ] 評価精度 > 85%（要専門家評価）
- [ ] レップカウント精度 > 95%（要実機テスト）
- [ ] 30fps以上で安定動作（要実機テスト）

## 注意事項
- 医療機器ではないことの明示（薬機法対応）→ 全ファイルに法的注意事項記載済み
- 個人差を考慮した柔軟な評価基準 → 各AnalyzerにConfig設定可能
- 初心者にも分かりやすいフィードバック → 日本語メッセージ対応
- プライバシー配慮（映像データは保存しない）→ PoseFrameのみ記録

## 参考リンク
- [MediaPipe Pose Landmarks](https://google.github.io/mediapipe/solutions/pose.html#pose-landmark-model)
- [Biomechanics of Exercise](https://www.nsca.com/education/articles/)
- [Computer Vision for Sports](https://arxiv.org/abs/2301.07835)
