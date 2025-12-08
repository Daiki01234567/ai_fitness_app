# 043 プッシュ通知基盤

## 概要
トレーニングリマインダーなどのプッシュ通知を送信する基盤を実装します。

## Phase
Phase 2（機能実装）

## 依存チケット
- 001: Firebaseプロジェクトセットアップ
- 041: 通知設定機能

## 要件
- expo-notificationsの導入
- Firebase Cloud Messaging (FCM)との連携
- リマインダー通知機能
- 通知タップ時のアプリ起動
- バックグラウンド通知処理

## 受け入れ条件
- [ ] プッシュ通知が端末に届く
- [ ] 設定した時刻に通知が届く
- [ ] 通知タップでアプリが開く
- [ ] 通知のON/OFF設定が反映される

## 参照ドキュメント
- `docs/expo/specs/01_要件定義書_Expo版_v1_Part1.md` - FR-017

## 技術詳細
- expo-notifications
- @react-native-firebase/messaging
- ローカル通知とリモート通知の両対応

## 見積もり
3日

## 進捗
- [ ] 未着手
