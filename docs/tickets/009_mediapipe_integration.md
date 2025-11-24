# Ticket #009: MediaPipe統合実装

**Phase**: Phase 2 (機能実装)
**期間**: Week 4-5
**優先度**: 最高
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (NFR-024, NFR-025)
- `docs/specs/08_README_form_validation_logic_v3_3.md`
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
MediaPipe Pose を Flutter アプリに統合し、リアルタイム姿勢検出機能を実装する。

## Todo リスト

### MediaPipe セットアップ

#### 依存関係追加
- [ ] `google_mlkit_pose_detection` パッケージ追加
- [ ] カメラパッケージ追加 (`camera`)
- [ ] 画像処理パッケージ追加 (`image`)
- [ ] パーミッション管理 (`permission_handler`)

#### プラットフォーム設定
- [ ] Android
  - [ ] minSdkVersion 21以上
  - [ ] カメラパーミッション追加
  - [ ] ML Kit依存関係
- [ ] iOS
  - [ ] iOS 10.0以上
  - [ ] Info.plist カメラ使用説明
  - [ ] ML Kit Pod設定

### カメラ管理実装

#### CameraService (`services/camera_service.dart`)
- [ ] カメラ初期化
  - [ ] 利用可能カメラ取得
  - [ ] フロントカメラ選択
  - [ ] 解像度設定（720p推奨）
- [ ] カメラ制御
  - [ ] 開始/停止
  - [ ] フリップ（前面/背面）
  - [ ] フォーカス制御
  - [ ] 露出制御
- [ ] フレーム処理
  - [ ] フレーム取得（30fps目標）
  - [ ] 画像フォーマット変換
  - [ ] フレームスキップ制御

#### パーミッション管理
- [ ] カメラパーミッション要求
- [ ] パーミッション拒否時の処理
- [ ] 設定画面への誘導

### MediaPipe Pose 実装

#### PoseDetectorService (`services/pose_detector_service.dart`)
- [ ] Pose Detector 初期化
  - [ ] モデル選択（Base/Accurate）
  - [ ] 検出モード（Stream）
  - [ ] パフォーマンスモード設定
- [ ] 姿勢検出処理
  - [ ] 画像入力
  - [ ] ランドマーク取得（33点）
  - [ ] 信頼度スコア取得
  - [ ] 3D座標変換
- [ ] データ構造定義
  ```dart
  class PoseLandmark {
    final int type; // 0-32
    final double x; // 0.0-1.0
    final double y; // 0.0-1.0
    final double z; // relative depth
    final double likelihood; // 0.0-1.0
  }
  ```

#### パフォーマンス最適化
- [ ] フレームスキップ実装
  - [ ] FPS モニタリング
  - [ ] 動的フレームレート調整
  - [ ] 低スペック端末検出
- [ ] メモリ管理
  - [ ] 画像バッファ管理
  - [ ] リソース解放
  - [ ] メモリリーク対策
- [ ] バッテリー最適化
  - [ ] バックグラウンド時の停止
  - [ ] 省電力モード対応

### 座標系変換

#### CoordinateTransformer (`utils/coordinate_transformer.dart`)
- [ ] カメラ座標→画面座標変換
- [ ] ミラーリング処理（フロントカメラ）
- [ ] アスペクト比調整
- [ ] 回転補正（デバイス向き）

### ビジュアライゼーション

#### PoseOverlay (`widgets/pose_overlay.dart`)
- [ ] スケルトン描画
  - [ ] 関節点描画
  - [ ] 骨格線描画
  - [ ] 信頼度による色分け
- [ ] リアルタイム更新
  - [ ] 60fps描画対応
  - [ ] ちらつき防止
  - [ ] スムージング
- [ ] デバッグ情報表示
  - [ ] FPS表示
  - [ ] 検出信頼度
  - [ ] 処理時間

### エラーハンドリング

#### 検出エラー処理
- [ ] カメラ利用不可
- [ ] MediaPipe初期化失敗
- [ ] 低照度環境
- [ ] 人物未検出
- [ ] 複数人検出

#### フォールバック処理
- [ ] 低精度モードへの切り替え
- [ ] 手動モードの提供
- [ ] エラーメッセージ表示

### データ収集

#### SessionRecorder (`services/session_recorder.dart`)
- [ ] フレームデータ記録
  - [ ] タイムスタンプ
  - [ ] ランドマーク座標
  - [ ] 信頼度スコア
- [ ] メタデータ記録
  - [ ] デバイス情報
  - [ ] カメラ設定
  - [ ] 平均FPS
  - [ ] フレームドロップ数
- [ ] 一時保存（メモリ/ローカル）
- [ ] バッチアップロード準備

### パフォーマンス監視

#### PerformanceMonitor
- [ ] FPS計測
- [ ] CPU使用率
- [ ] メモリ使用量
- [ ] バッテリー消費
- [ ] 温度監視
- [ ] 閾値アラート

### テスト実装

#### 単体テスト
- [ ] 座標変換ロジック
- [ ] FPS計算
- [ ] エラーハンドリング

#### 統合テスト
- [ ] カメラ→MediaPipe連携
- [ ] データ記録フロー
- [ ] パフォーマンス計測

#### デバイステスト
- [ ] 各種Android端末
- [ ] 各種iOS端末
- [ ] 低スペック端末
- [ ] タブレット対応

## 受け入れ条件
- [ ] カメラ映像からリアルタイムで姿勢検出できる
- [ ] 30fps以上で安定動作（目標端末）
- [ ] 15fps以上で動作（最低要件）
- [ ] スケルトンが正しく描画される
- [ ] エラーが適切に処理される
- [ ] データが正しく記録される

## 注意事項
- プライバシー優先（映像はローカル処理のみ）
- バッテリー消費への配慮
- 熱暴走対策
- メモリリークの防止
- 各種画面サイズ対応

## 参考リンク
- [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose.html)
- [ML Kit Pose Detection](https://developers.google.com/ml-kit/vision/pose-detection)
- [Flutter Camera Plugin](https://pub.dev/packages/camera)