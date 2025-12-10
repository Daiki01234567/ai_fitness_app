# AI Fitness App - プロジェクト概要

## 目的
MediaPipeを活用したオンデバイス姿勢検出によるフィットネスアプリ。日本市場向け、GDPR準拠。

## 対象種目
- スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス（5種目）

## Firebase プロジェクト
- **Project ID**: `tokyo-list-478804-e5`

## 技術スタック

### モバイルアプリ（Expo版）
- Expo SDK 54 / React Native 0.81
- React 19.1
- Expo Router（ファイルベースルーティング）
- Zustand（状態管理）
- TanStack Query（サーバー状態管理）
- React Native Paper（Material Design 3 UI）
- Firebase SDK

### バックエンド
- Firebase Functions (TypeScript/Node 24)
- Firestore（データベース）
- BigQuery（分析）
- Cloud Tasks（非同期処理）

## コードベース構造

```
ai_fitness_app/
├── expo_app/          # Expo/React Native アプリ
│   ├── app/           # Expo Router（ファイルベースルーティング）
│   ├── components/    # 再利用可能UIコンポーネント
│   ├── lib/           # サービス、テーマ、ユーティリティ
│   ├── stores/        # Zustand状態管理ストア
│   └── types/         # TypeScript型定義
├── flutter_app/       # Flutter版（別実装）
├── functions/         # Firebase Functions
├── firebase/          # Firestore ルール、テスト
└── docs/              # 仕様書
```

## 開発フェーズ
- Phase 1: 0-2ヶ月（基盤構築）- 現在進行中
- Phase 2: 2-7ヶ月（コア機能実装）
- Phase 3: 8ヶ月以降（課金機能）
- Phase 4: 将来（管理者機能）
