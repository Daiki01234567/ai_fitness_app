# Ticket #017: ソーシャル機能実装

**Phase**: Phase 3 (追加機能)
**期間**: Week 11-12
**優先度**: 低
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (将来的な拡張機能)
- `docs/specs/05_画面遷移図_ワイヤーフレーム_v3_3.md`

## 概要
ユーザー間のつながりとモチベーション向上を目的としたソーシャル機能を実装する。

## Todo リスト

### プロフィール機能拡張

#### PublicProfileScreen (`screens/social/public_profile_screen.dart`)
- [ ] 公開プロフィール設定
  - [ ] 表示名
  - [ ] アバター画像
  - [ ] 自己紹介文
  - [ ] フィットネス目標
  - [ ] 実績バッジ表示
- [ ] プライバシー設定
  - [ ] 公開/非公開切り替え
  - [ ] 項目別公開設定
  - [ ] フォロワー限定公開
- [ ] 統計表示
  - [ ] 総トレーニング時間
  - [ ] 連続日数
  - [ ] 平均フォームスコア

#### ProfileCustomization
- [ ] アバター選択/アップロード
- [ ] バナー画像設定
- [ ] テーマカラー選択
- [ ] バッジ配置カスタマイズ

### フォロー機能

#### FollowManager (`services/follow_manager.dart`)
- [ ] フォロー/アンフォロー処理
  ```dart
  Future<void> followUser(String targetUserId) async {
    // Following コレクションに追加
    await firestore
        .collection('following')
        .doc(currentUserId)
        .collection('users')
        .doc(targetUserId)
        .set({
      'followedAt': FieldValue.serverTimestamp(),
    });

    // Followers コレクションに追加
    await firestore
        .collection('followers')
        .doc(targetUserId)
        .collection('users')
        .doc(currentUserId)
        .set({
      'followedAt': FieldValue.serverTimestamp(),
    });
  }
  ```
- [ ] フォロー状態管理
- [ ] 相互フォロー検出
- [ ] ブロック機能

#### FollowListScreen (`screens/social/follow_list_screen.dart`)
- [ ] フォロワー一覧
- [ ] フォロー中一覧
- [ ] 相互フォロー表示
- [ ] ユーザー検索
- [ ] おすすめユーザー

### フィード機能

#### SocialFeedScreen (`screens/social/feed_screen.dart`)
- [ ] タイムライン表示
  - [ ] フォロー中ユーザーの活動
  - [ ] 無限スクロール
  - [ ] プルリフレッシュ
- [ ] 投稿タイプ
  - [ ] ワークアウト完了
  - [ ] 目標達成
  - [ ] パーソナルベスト
  - [ ] バッジ獲得
- [ ] インタラクション
  - [ ] いいね
  - [ ] コメント
  - [ ] シェア

#### PostCreation (`widgets/social/post_creation.dart`)
- [ ] ワークアウト結果の共有
  - [ ] セッションサマリー
  - [ ] ハイライト動画（オプション）
  - [ ] コメント追加
- [ ] プライバシー設定
  - [ ] 公開範囲選択
  - [ ] 詳細情報の表示/非表示
- [ ] ハッシュタグ

### チャレンジ機能

#### ChallengesScreen (`screens/social/challenges_screen.dart`)
- [ ] チャレンジ一覧
  - [ ] 公式チャレンジ
  - [ ] コミュニティチャレンジ
  - [ ] 期間限定イベント
- [ ] チャレンジ詳細
  - [ ] ルール説明
  - [ ] 参加者数
  - [ ] ランキング
  - [ ] 報酬
- [ ] 参加管理
  - [ ] 参加/辞退
  - [ ] 進捗トラッキング
  - [ ] 完了通知

#### ChallengeCreation (`screens/social/challenge_creation_screen.dart`)
- [ ] カスタムチャレンジ作成
  - [ ] チャレンジ名
  - [ ] 期間設定
  - [ ] 目標設定
  - [ ] 参加条件
- [ ] 招待機能
  - [ ] フォロワー招待
  - [ ] リンク共有
  - [ ] QRコード

### ランキング機能

#### LeaderboardScreen (`screens/social/leaderboard_screen.dart`)
- [ ] グローバルランキング
  - [ ] 週間/月間/総合
  - [ ] 種目別
  - [ ] 地域別
- [ ] フレンドランキング
  - [ ] フォロー中ユーザーのみ
  - [ ] 相互フォローのみ
- [ ] 自分の順位表示
  - [ ] ハイライト表示
  - [ ] 順位変動
  - [ ] パーセンタイル

### グループ機能

#### GroupsScreen (`screens/social/groups_screen.dart`)
- [ ] グループ一覧
  - [ ] 参加中グループ
  - [ ] おすすめグループ
  - [ ] 検索機能
- [ ] グループ作成
  - [ ] グループ名
  - [ ] 説明
  - [ ] プライバシー設定
  - [ ] 参加承認設定
- [ ] グループ管理
  - [ ] メンバー管理
  - [ ] お知らせ投稿
  - [ ] イベント作成

#### GroupDetailScreen
- [ ] グループフィード
- [ ] メンバーリスト
- [ ] グループ統計
- [ ] グループチャレンジ

### メッセージ機能

#### MessagesScreen (`screens/social/messages_screen.dart`)
- [ ] メッセージ一覧
  - [ ] 未読表示
  - [ ] 最終メッセージプレビュー
  - [ ] オンライン状態
- [ ] チャット画面
  - [ ] テキストメッセージ
  - [ ] 画像送信
  - [ ] ワークアウト結果共有
  - [ ] 既読表示
- [ ] 通知設定
  - [ ] メッセージ通知
  - [ ] メンション通知

### Cloud Functions 実装

#### ソーシャルAPI

##### フィード生成 (`api/social/feed.ts`)
- [ ] タイムライン構築
  ```typescript
  export async function generateFeed(userId: string) {
    // フォロー中ユーザーの投稿取得
    const following = await getFollowingUsers(userId);
    const posts = await firestore
      .collectionGroup('posts')
      .where('userId', 'in', following)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return posts.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isLiked: await checkIfLiked(userId, doc.id)
    }));
  }
  ```
- [ ] パーソナライズ
- [ ] キャッシング

##### 通知処理 (`api/social/notifications.ts`)
- [ ] フォロー通知
- [ ] いいね通知
- [ ] コメント通知
- [ ] チャレンジ招待通知

### Firestore設計

#### Social コレクション構造
```typescript
// Following/Followers
interface Follow {
  userId: string;
  targetUserId: string;
  followedAt: Timestamp;
}

// Posts
interface Post {
  userId: string;
  type: 'workout' | 'achievement' | 'challenge';
  content: string;
  mediaUrls?: string[];
  workoutData?: WorkoutSummary;
  likes: number;
  comments: number;
  visibility: 'public' | 'followers' | 'private';
  createdAt: Timestamp;
}

// Groups
interface Group {
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: Timestamp;
}
```

### プライバシー・安全性

#### コンテンツモデレーション
- [ ] 不適切コンテンツ検出
  - [ ] 画像フィルタリング
  - [ ] テキストフィルタリング
  - [ ] スパム検出
- [ ] 報告機能
  - [ ] ユーザー報告
  - [ ] コンテンツ報告
  - [ ] 自動処理

#### ブロック・ミュート
- [ ] ユーザーブロック
- [ ] コンテンツフィルタリング
- [ ] キーワードミュート
- [ ] 一時的ミュート

### パフォーマンス最適化

#### データ取得最適化
- [ ] ページネーション
- [ ] 遅延ローディング
- [ ] キャッシュ戦略
- [ ] CDN活用

#### リアルタイム更新
- [ ] Firestore リアルタイムリスナー
- [ ] WebSocket（必要に応じて）
- [ ] 最適な更新頻度

### テスト実装

#### 単体テスト
- [ ] フォロー機能
- [ ] フィード生成
- [ ] プライバシー設定

#### 統合テスト
- [ ] ソーシャルフロー全体
- [ ] 通知連携
- [ ] リアルタイム更新

#### 負荷テスト
- [ ] 大量フォロワー
- [ ] 高頻度投稿
- [ ] 同時アクセス

## 受け入れ条件
- [ ] ユーザー間でフォローできる
- [ ] フィードが正しく表示される
- [ ] チャレンジに参加できる
- [ ] プライバシー設定が機能する
- [ ] 不適切コンテンツがフィルタリングされる

## 注意事項
- スケーラビリティの考慮（フォロワー数制限など）
- 不適切コンテンツ対策
- いじめ・ハラスメント防止
- COPPA準拠（13歳未満）

## 参考リンク
- [Building Social Features](https://firebase.google.com/docs/firestore/solutions/social-activity-feed)
- [Content Moderation](https://cloud.google.com/vision/docs/detecting-safe-search)
- [Community Guidelines Best Practices](https://transparency.fb.com/policies/community-standards/)