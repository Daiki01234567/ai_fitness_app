# Ticket #018: パフォーマンス最適化

**Phase**: Phase 3 (最適化)
**期間**: Week 12
**優先度**: 高
**ステータス**: なし
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (NFR-013～NFR-017)
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
アプリケーション全体のパフォーマンスを最適化し、ユーザー体験を向上させる。

## Todo リスト

### Flutter アプリ最適化

#### 起動時間短縮

##### スプラッシュスクリーン最適化
- [ ] ネイティブスプラッシュ実装
  - [ ] iOS: LaunchScreen.storyboard
  - [ ] Android: launch_background.xml
- [ ] 初期化処理の最適化
  ```dart
  void main() async {
    // 必須の初期化のみ実行
    WidgetsFlutterBinding.ensureInitialized();
    await Firebase.initializeApp();

    // その他の初期化は遅延実行
    runApp(MyApp());

    // バックグラウンドで追加初期化
    Future.microtask(() async {
      await initializeOptionalServices();
    });
  }
  ```
- [ ] 遅延初期化
- [ ] コード分割

##### アプリサイズ削減
- [ ] 不要な依存関係削除
- [ ] アセット最適化
  - [ ] 画像圧縮
  - [ ] WebP形式採用
  - [ ] 解像度別アセット
- [ ] ProGuard/R8設定（Android）
- [ ] App Thinning（iOS）

#### レンダリング最適化

##### Widget最適化
- [ ] const コンストラクタ活用
  ```dart
  // Good
  const Text('静的テキスト');
  const SizedBox(height: 16);

  // Bad
  Text('静的テキスト');
  SizedBox(height: 16);
  ```
- [ ] キー活用による再構築防止
- [ ] RepaintBoundary使用
- [ ] CustomPainter最適化

##### リスト最適化
- [ ] ListView.builder使用
  ```dart
  ListView.builder(
    itemCount: items.length,
    itemBuilder: (context, index) {
      return ListTile(
        title: Text(items[index]),
      );
    },
    // パフォーマンス向上設定
    addAutomaticKeepAlives: false,
    addRepaintBoundaries: false,
  );
  ```
- [ ] 画像の遅延読み込み
- [ ] ビューポート外Widget破棄
- [ ] AutomaticKeepAlive制御

#### 状態管理最適化

##### Riverpod最適化
- [ ] Provider分割による再構築最小化
  ```dart
  // Bad: 大きな状態オブジェクト
  final userProvider = StateProvider((ref) => User());

  // Good: 細分化
  final userNameProvider = Provider((ref) => ref.watch(userProvider).name);
  final userEmailProvider = Provider((ref) => ref.watch(userProvider).email);
  ```
- [ ] select使用による部分監視
- [ ] family/autoDisposeの適切な使用
- [ ] AsyncValue最適化

##### メモリ管理
- [ ] dispose適切な実装
- [ ] StreamSubscriptionのキャンセル
- [ ] タイマーのキャンセル
- [ ] 画像キャッシュ管理

### MediaPipe最適化

#### フレーム処理最適化
- [ ] フレームスキップ戦略
  ```dart
  int frameCount = 0;
  void processFrame(CameraImage image) {
    frameCount++;
    // 3フレームに1回処理
    if (frameCount % 3 != 0) return;

    // MediaPipe処理
    processPose(image);
  }
  ```
- [ ] 解像度動的調整
- [ ] ROI（Region of Interest）処理
- [ ] バックグラウンドスレッド活用

#### モデル最適化
- [ ] TensorFlow Lite最適化
  - [ ] 量子化
  - [ ] プルーニング
  - [ ] GPU Delegate使用
- [ ] モデルキャッシング
- [ ] ウォームアップ実行

### ネットワーク最適化

#### API呼び出し最適化
- [ ] バッチリクエスト
  ```typescript
  // Bad: 個別リクエスト
  for (const id of userIds) {
    await fetchUser(id);
  }

  // Good: バッチリクエスト
  await fetchUsers(userIds);
  ```
- [ ] GraphQL採用検討
- [ ] レスポンス圧縮
- [ ] CDN活用

#### Firestore最適化
- [ ] 複合クエリ使用
- [ ] インデックス最適化
- [ ] オフラインキャッシュ活用
  ```dart
  FirebaseFirestore.instance.settings = Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );
  ```
- [ ] リアルタイムリスナー最小化

#### 画像最適化
- [ ] 遅延ロード実装
- [ ] プログレッシブJPEG
- [ ] サムネイル生成
- [ ] CDNキャッシュ活用

### Cloud Functions最適化

#### コールドスタート対策
- [ ] 最小インスタンス設定
  ```javascript
  exports.api = functions
    .runWith({
      minInstances: 1,
      memory: '512MB'
    })
    .https.onRequest(app);
  ```
- [ ] 依存関係最小化
- [ ] グローバル変数活用
- [ ] ウォームアップ関数

#### 実行時間短縮
- [ ] 並列処理活用
  ```typescript
  // Bad: 順次処理
  const user = await getUser();
  const sessions = await getSessions();

  // Good: 並列処理
  const [user, sessions] = await Promise.all([
    getUser(),
    getSessions()
  ]);
  ```
- [ ] キャッシュ活用
- [ ] 不要な処理削除
- [ ] データベースクエリ最適化

### キャッシュ戦略

#### メモリキャッシュ
- [ ] LRUキャッシュ実装
  ```dart
  class LRUCache<K, V> {
    final int maxSize;
    final Map<K, V> _cache = {};
    final List<K> _keys = [];

    V? get(K key) {
      if (_cache.containsKey(key)) {
        _keys.remove(key);
        _keys.add(key);
        return _cache[key];
      }
      return null;
    }
  }
  ```
- [ ] 画像キャッシュ設定
- [ ] APIレスポンスキャッシュ
- [ ] 計算結果キャッシュ

#### ディスクキャッシュ
- [ ] SharedPreferences活用
- [ ] SQLiteキャッシュ
- [ ] ファイルキャッシュ
- [ ] キャッシュ有効期限管理

### バッテリー最適化

#### 電力消費削減
- [ ] GPS使用最小化
- [ ] バックグラウンド処理制限
- [ ] ネットワーク呼び出し集約
- [ ] 画面輝度調整提案

#### センサー使用最適化
- [ ] カメラ使用時間短縮
- [ ] 適切なフレームレート
- [ ] 自動スリープ機能
- [ ] 低電力モード対応

### 分析・監視

#### パフォーマンス計測
- [ ] Firebase Performance設定
  ```dart
  final trace = FirebasePerformance.instance.newTrace('session_processing');
  await trace.start();

  // 処理実行
  await processSession();

  trace.putAttribute('frame_count', frameCount.toString());
  await trace.stop();
  ```
- [ ] カスタムトレース
- [ ] ネットワーク監視
- [ ] 画面レンダリング時間

#### メトリクス収集
- [ ] 起動時間
- [ ] 画面遷移時間
- [ ] API応答時間
- [ ] フレームレート
- [ ] メモリ使用量
- [ ] バッテリー消費

### ビルド最適化

#### Flutter ビルド
- [ ] AOT コンパイル最適化
- [ ] Tree shaking有効化
- [ ] Deferred loading
- [ ] Split APK（Android）

#### Web ビルド最適化
- [ ] コード分割
- [ ] 圧縮設定
- [ ] Service Worker
- [ ] PWA最適化

### テスト実装

#### パフォーマンステスト
- [ ] 起動時間測定
- [ ] メモリリーク検出
- [ ] UI自動テスト
- [ ] 負荷テスト

#### プロファイリング
- [ ] Flutter DevTools使用
- [ ] Timeline分析
- [ ] Memory分析
- [ ] Network分析

#### ベンチマーク
- [ ] 各機能の実行時間
- [ ] バッテリー消費測定
- [ ] データ通信量測定
- [ ] 競合アプリ比較

## 受け入れ条件
- [ ] 起動時間 < 3秒
- [ ] 画面遷移 < 300ms
- [ ] MediaPipe処理 > 30fps
- [ ] メモリリークなし
- [ ] バッテリー消費適正

## 注意事項
- 最適化による機能劣化防止
- 過度な最適化の回避
- テスト網羅性の維持
- ユーザー体験優先

## 参考リンク
- [Flutter Performance Best Practices](https://flutter.dev/docs/perf/best-practices)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [TensorFlow Lite Optimization](https://www.tensorflow.org/lite/performance/best_practices)
