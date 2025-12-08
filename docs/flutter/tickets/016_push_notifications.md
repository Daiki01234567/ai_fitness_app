# Ticket #016: プッシュ通知機能実装

**Phase**: Phase 3 (追加機能)
**期間**: Week 11
**優先度**: 中
**ステータス**: なし
**関連仕様書**:
- `docs/specs/00_要件定義書_v3_3.md` (NFR-021～NFR-023)
- `docs/specs/01_システムアーキテクチャ設計書_v3_2.md`

## 概要
Firebase Cloud Messaging (FCM) を使用してプッシュ通知機能を実装し、ユーザーエンゲージメント向上を図る。

## Todo リスト

### FCM セットアップ

#### Firebase設定
- [ ] FCM有効化
- [ ] APNs証明書設定（iOS）
  - [ ] Apple Developer Consoleで証明書作成
  - [ ] Firebase Consoleにアップロード
  - [ ] プッシュ通知権限設定
- [ ] Android設定
  - [ ] google-services.json更新
  - [ ] マニフェスト設定

#### Flutter統合
- [ ] firebase_messaging パッケージ追加
- [ ] プラットフォーム別設定
  - [ ] iOS: Info.plist設定
  - [ ] Android: AndroidManifest.xml設定
- [ ] 初期化処理

### 通知権限管理

#### PermissionManager (`services/permission_manager.dart`)
- [ ] 通知権限リクエスト
  ```dart
  Future<bool> requestNotificationPermission() async {
    final settings = await FirebaseMessaging.instance
        .requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus ==
           AuthorizationStatus.authorized;
  }
  ```
- [ ] 権限状態管理
- [ ] 設定画面への誘導
- [ ] 権限変更検知

#### NotificationPreferences (`screens/settings/notification_preferences.dart`)
- [ ] 通知設定画面
  - [ ] マスタースイッチ
  - [ ] カテゴリ別ON/OFF
  - [ ] 時間帯設定
  - [ ] 曜日設定
- [ ] 通知カテゴリ
  - [ ] トレーニングリマインダー
  - [ ] 達成通知
  - [ ] モチベーション
  - [ ] システム通知
  - [ ] プロモーション

### トークン管理

#### FCMTokenManager (`services/fcm_token_manager.dart`)
- [ ] トークン取得
  ```dart
  final token = await FirebaseMessaging.instance.getToken();
  ```
- [ ] トークン更新処理
  ```dart
  FirebaseMessaging.instance.onTokenRefresh.listen((token) {
    await updateTokenInFirestore(token);
  });
  ```
- [ ] Firestoreへの保存
- [ ] デバイス情報管理
  - [ ] OS種別
  - [ ] OSバージョン
  - [ ] アプリバージョン
  - [ ] 言語設定

### 通知処理実装

#### NotificationHandler (`services/notification_handler.dart`)
- [ ] フォアグラウンド処理
  ```dart
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    // アプリ内通知表示
    showInAppNotification(message);
  });
  ```
- [ ] バックグラウンド処理
  ```dart
  FirebaseMessaging.onBackgroundMessage(
    _firebaseMessagingBackgroundHandler
  );
  ```
- [ ] 通知タップ処理
  ```dart
  FirebaseMessaging.onMessageOpenedApp.listen((message) {
    navigateToScreen(message.data);
  });
  ```
- [ ] ディープリンク処理

#### LocalNotificationService
- [ ] flutter_local_notifications 設定
- [ ] チャンネル作成（Android）
  - [ ] 重要度別チャンネル
  - [ ] サウンド設定
  - [ ] バイブレーション設定
- [ ] カスタム通知UI
  - [ ] 大きい画像表示
  - [ ] アクションボタン
  - [ ] プログレス表示

### Cloud Functions 実装

#### 通知送信API

##### 個別送信 (`api/notifications/send.ts`)
- [ ] エンドポイント実装
  ```typescript
  export async function sendNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
      imageUrl?: string;
    }
  ) {
    const tokens = await getUserTokens(userId);
    await admin.messaging().sendMulticast({
      tokens,
      notification,
      data: notification.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default'
          }
        }
      }
    });
  }
  ```
- [ ] トークン検証
- [ ] 送信ログ記録
- [ ] エラーハンドリング

##### 一括送信 (`api/notifications/broadcast.ts`)
- [ ] セグメント送信
  - [ ] アクティブユーザー
  - [ ] 非アクティブユーザー
  - [ ] プレミアムユーザー
- [ ] トピック送信
  ```typescript
  await admin.messaging().sendToTopic('all_users', {
    notification: {
      title: 'お知らせ',
      body: 'メンテナンスのお知らせ'
    }
  });
  ```
- [ ] 条件付き送信
- [ ] バッチ処理（500件単位）

### スケジュール通知

#### ReminderScheduler (`functions/schedulers/reminders.ts`)
- [ ] トレーニングリマインダー
  - [ ] ユーザー設定時間に送信
  - [ ] 最後のセッションから計算
  - [ ] 曜日別カスタマイズ
- [ ] 目標リマインダー
  - [ ] 週間目標進捗
  - [ ] 月間サマリー
- [ ] モチベーション通知
  - [ ] 連続記録お知らせ
  - [ ] 励ましメッセージ
  - [ ] Tips配信

#### Cloud Scheduler設定
- [ ] 定期実行ジョブ
  - [ ] 朝のリマインダー（7:00）
  - [ ] 昼のリマインダー（12:00）
  - [ ] 夜のリマインダー（19:00）
- [ ] タイムゾーン対応
- [ ] 祝日考慮

### 通知テンプレート

#### MessageTemplates (`utils/message_templates.ts`)
- [ ] カテゴリ別テンプレート
  ```typescript
  const templates = {
    reminder: {
      title: '今日のトレーニング',
      body: '{name}さん、今日も頑張りましょう！'
    },
    achievement: {
      title: '目標達成！',
      body: '{achievement}を達成しました🎉'
    },
    streak: {
      title: '連続{days}日！',
      body: '素晴らしい継続です。この調子で！'
    }
  };
  ```
- [ ] 多言語対応
- [ ] 絵文字使用
- [ ] パーソナライズ

### 分析・最適化

#### NotificationAnalytics
- [ ] 送信数トラッキング
- [ ] 開封率測定
- [ ] クリック率測定
- [ ] オプトアウト率
- [ ] 最適送信時間分析

#### A/Bテスト
- [ ] メッセージバリエーション
- [ ] 送信時間テスト
- [ ] 頻度テスト
- [ ] 効果測定

### エラー処理

#### 配信エラー管理
- [ ] 無効トークン処理
  - [ ] 自動削除
  - [ ] 再取得試行
- [ ] レート制限対応
- [ ] リトライ機構
- [ ] フォールバック

### プライバシー・コンプライアンス

#### 同意管理
- [ ] 通知許可の記録
- [ ] カテゴリ別同意
- [ ] 同意撤回処理
- [ ] GDPR準拠

#### データ管理
- [ ] 通知履歴保存
- [ ] 個人情報保護
- [ ] ログ保持期間

### テスト実装

#### 単体テスト
- [ ] トークン管理
- [ ] テンプレート処理
- [ ] 送信ロジック

#### 統合テスト
- [ ] エンドツーエンド送信
- [ ] 各プラットフォーム確認
- [ ] ディープリンク動作

#### デバイステスト
- [ ] iOS実機テスト
- [ ] Android実機テスト
- [ ] バックグラウンド動作
- [ ] 省電力モード対応

## 受け入れ条件
- [ ] 両プラットフォームで通知が受信できる
- [ ] アプリ内から通知設定を変更できる
- [ ] スケジュール通知が正しく送信される
- [ ] 通知タップで適切な画面に遷移
- [ ] オプトアウトが正しく機能する

## 注意事項
- バッテリー消費への配慮
- 通知疲れの防止（頻度制限）
- サイレント時間帯の考慮
- 地域別法規制の遵守

## 参考リンク
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Flutter Local Notifications](https://pub.dev/packages/flutter_local_notifications)
- [iOS Push Notifications](https://developer.apple.com/documentation/usernotifications)
