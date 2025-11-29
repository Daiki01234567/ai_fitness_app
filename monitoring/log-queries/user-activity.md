# ユーザーアクティビティ分析クエリ

ユーザー行動とセッション分析用のクエリ集です。

## 全ユーザーアクティビティ

```
resource.type="cloud_function"
jsonPayload.userId!=""
```

## 特定ユーザーの全アクティビティ

```
resource.type="cloud_function"
jsonPayload.userId="USER_ID_HERE"
```

## ユーザー登録イベント

```
resource.type="cloud_function"
resource.labels.function_name="onUserCreated"
```

## ユーザー削除イベント

```
resource.type="cloud_function"
resource.labels.function_name="onUserDeleted"
```

## プロフィール更新

```
resource.type="cloud_function"
httpRequest.requestUrl:"/users"
httpRequest.requestMethod="PATCH"
```

## ログインアクティビティ

```
resource.type="cloud_function"
(jsonPayload.action="LOGIN" OR jsonPayload.eventType="LOGIN_SUCCESS")
```

## ログアウトアクティビティ

```
resource.type="cloud_function"
jsonPayload.action="LOGOUT"
```

## セッション開始

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="SESSION_START"
```

## セッション終了

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="SESSION_END"
```

## トレーニングセッション

```
resource.type="cloud_function"
jsonPayload.resourceType="session"
```

## エクササイズ種目別

### スクワット
```
resource.type="cloud_function"
jsonPayload.exerciseType="squat"
```

### アームカール
```
resource.type="cloud_function"
jsonPayload.exerciseType="arm_curl"
```

### サイドレイズ
```
resource.type="cloud_function"
jsonPayload.exerciseType="side_raise"
```

### ショルダープレス
```
resource.type="cloud_function"
jsonPayload.exerciseType="shoulder_press"
```

### プッシュアップ
```
resource.type="cloud_function"
jsonPayload.exerciseType="push_up"
```

## 同意管理イベント

### 同意付与
```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="CONSENT_GRANTED"
```

### 同意撤回
```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="CONSENT_REVOKED"
```

## データ削除リクエスト

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="DATA_DELETION_REQUEST"
```

## データエクスポートリクエスト

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="DATA_EXPORT_REQUEST"
```

## アクティブユーザー分析

```
resource.type="cloud_function"
jsonPayload.userId!=""
httpRequest.status>=200
httpRequest.status<300
```

時間範囲を設定し、ユニークユーザーIDをカウントします。

## ユーザージャーニー追跡

特定ユーザーの時系列アクティビティ：
```
resource.type="cloud_function"
jsonPayload.userId="USER_ID_HERE"
```

タイムスタンプでソートして行動の流れを確認します。

## 新規ユーザー vs リピーター

新規ユーザー（過去24時間以内に作成）：
```
resource.type="cloud_function"
resource.labels.function_name="onUserCreated"
timestamp>="2024-01-01T00:00:00Z"
```

## 非アクティブユーザー検出

長期間アクティビティがないユーザーの特定は、
Firestore の lastActiveAt フィールドをチェックするスケジュール関数で実装します。

## プラットフォーム別アクティビティ

```
resource.type="cloud_function"
jsonPayload.platform!=""
```

## アプリバージョン別

```
resource.type="cloud_function"
jsonPayload.appVersion!=""
```
