# AI Fitness App

AIを活用したフィットネスアプリ - MediaPipeによるリアルタイム姿勢検出

## プロジェクト概要

本プロジェクトは、スマートフォンのカメラを使用してユーザーのトレーニングフォームをリアルタイムで分析し、改善提案を行うAIフィットネスアプリです。

### 主な機能
- 5種目のフォーム確認（スクワット、アームカール、サイドレイズ、ショルダープレス、プッシュアップ）
- MediaPipeによるオンデバイス姿勢検出（プライバシー優先）
- トレーニング履歴と分析
- パーソナルベスト記録
- サブスクリプション課金（RevenueCat）

## クイックスタート

### 必要条件
- Node.js 20 LTS以上
- Flutter 3.x
- Firebase CLI
- Git

### セットアップ手順

1. **Firebase CLIのインストール**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase認証**
   ```bash
   firebase login
   ```

3. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集して必要な値を設定
   ```

4. **Firebase Emulatorsの起動**

   Windows:
   ```bash
   scripts\start-emulators.bat
   ```

   Mac/Linux:
   ```bash
   chmod +x scripts/start-emulators.sh
   ./scripts/start-emulators.sh
   ```

エミュレータが起動すると以下のポートで利用可能になります:
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- Functions: http://localhost:5001
- Storage: http://localhost:9199
- Emulator UI: http://localhost:4000

## プロジェクト構造

```
ai-fitness-app/
├── flutter_app/          # Flutterアプリケーション
├── functions/           # Cloud Functions (Phase 1で実装)
├── docs/               # ドキュメント
│   ├── specs/          # 仕様書
│   └── tickets/        # 開発チケット
├── scripts/            # ユーティリティスクリプト
├── firebase.json       # Firebase設定
├── firestore.rules     # Firestoreセキュリティルール
└── CLAUDE.md          # 開発ガイドライン
```

## 開発ドキュメント

詳細は以下のドキュメントを参照してください:
- [CLAUDE.md](CLAUDE.md) - 開発時の制約事項とベストプラクティス
- [開発チケット](docs/tickets/) - 番号付きタスク管理

**Project ID**: ai-fitness-c38f0
**Version**: 0.1.0 (MVP Phase 1)
