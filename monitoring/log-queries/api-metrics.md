# API メトリクス分析クエリ

API エンドポイントとカスタムメトリクス分析用のクエリ集です。

## 全 API リクエスト

```
resource.type="cloud_function"
resource.labels.function_name="api"
```

## エンドポイント別リクエスト

```
resource.type="cloud_function"
httpRequest.requestUrl:"/api/users"
```

## HTTPメソッド別

```
resource.type="cloud_function"
httpRequest.requestMethod="POST"
```

## ステータスコード別

### 成功レスポンス
```
resource.type="cloud_function"
httpRequest.status>=200
httpRequest.status<300
```

### クライアントエラー
```
resource.type="cloud_function"
httpRequest.status>=400
httpRequest.status<500
```

### サーバーエラー
```
resource.type="cloud_function"
httpRequest.status>=500
```

## カスタムメトリクス

### APIレイテンシ
```
resource.type="cloud_function"
jsonPayload._customMetric=true
jsonPayload.metricType="api_latency"
```

### APIエラーカウント
```
resource.type="cloud_function"
jsonPayload._customMetric=true
jsonPayload.metricType="api_error_count"
```

### 認証失敗カウント
```
resource.type="cloud_function"
jsonPayload._customMetric=true
jsonPayload.metricType="auth_failure_count"
```

### セッションカウント
```
resource.type="cloud_function"
jsonPayload._customMetric=true
jsonPayload.metricType="session_count"
```

## 認証関連API

```
resource.type="cloud_function"
(httpRequest.requestUrl:"/auth" OR httpRequest.requestUrl:"/register" OR httpRequest.requestUrl:"/login")
```

## ユーザー管理API

```
resource.type="cloud_function"
httpRequest.requestUrl:"/users"
```

## 同意管理API

```
resource.type="cloud_function"
httpRequest.requestUrl:"/consent"
```

## リクエストサイズ分析

```
resource.type="cloud_function"
httpRequest.requestSize!=""
```

## レスポンスサイズ分析

```
resource.type="cloud_function"
httpRequest.responseSize!=""
```

## ユーザーエージェント別

```
resource.type="cloud_function"
httpRequest.userAgent:"Flutter"
```

## リファラー分析

```
resource.type="cloud_function"
httpRequest.referer!=""
```

## API バージョン別（カスタムヘッダー使用時）

```
resource.type="cloud_function"
jsonPayload.apiVersion!=""
```

## 認証済みリクエスト

```
resource.type="cloud_function"
jsonPayload.userId!=""
httpRequest.status<400
```

## 匿名リクエスト

```
resource.type="cloud_function"
jsonPayload.userId=""
httpRequest.requestUrl!="/auth"
```

## 特定関数の呼び出し

### onCreate トリガー
```
resource.type="cloud_function"
resource.labels.function_name="onUserCreated"
```

### onDelete トリガー
```
resource.type="cloud_function"
resource.labels.function_name="onUserDeleted"
```

### スケジュール関数
```
resource.type="cloud_function"
resource.labels.function_name:"scheduled"
```
