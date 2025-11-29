# パフォーマンス分析クエリ

パフォーマンスメトリクスとレイテンシ分析用のクエリ集です。

## 全パフォーマンスログ

```
resource.type="cloud_function"
jsonPayload.logType="performance"
```

## API レイテンシログ

```
resource.type="cloud_function"
jsonPayload.metricName="api_latency"
```

## 遅いリクエスト（1秒以上）

```
resource.type="cloud_function"
jsonPayload.durationMs>=1000
```

## 非常に遅いリクエスト（5秒以上）

```
resource.type="cloud_function"
jsonPayload.durationMs>=5000
```

## 特定エンドポイントのパフォーマンス

```
resource.type="cloud_function"
resource.labels.function_name="api"
httpRequest.requestUrl:"/users"
```

## Cloud Functions 実行時間

```
resource.type="cloud_function"
textPayload:"Function execution took"
```

## メモリ使用量が高いリクエスト

```
resource.type="cloud_function"
jsonPayload.memoryUsageMb>=200
```

## コールドスタート検出

```
resource.type="cloud_function"
textPayload:"Function execution started"
jsonPayload.coldStart=true
```

## タイムアウトエラー

```
resource.type="cloud_function"
severity>=ERROR
(textPayload:"timeout" OR jsonPayload.message:"timeout" OR textPayload:"DEADLINE_EXCEEDED")
```

## Firestore 読み取り/書き込みパフォーマンス

```
resource.type="cloud_function"
jsonPayload.metricName:"firestore"
```

## HTTPリクエスト応答時間

```
resource.type="cloud_function"
httpRequest.latency!=""
```

## エンドポイント別レイテンシ分析

```
resource.type="cloud_function"
httpRequest.requestUrl!=""
jsonPayload.durationMs!=""
```

## BigQuery ジョブパフォーマンス

```
resource.type="bigquery_resource"
protoPayload.methodName="jobservice.jobcompleted"
```

## Cloud Storage 操作パフォーマンス

```
resource.type="gcs_bucket"
protoPayload.methodName!=""
```

## 時間帯別のリクエスト数

```
resource.type="cloud_function"
```

ヒストグラム表示でトラフィックパターンを分析します。

## 高負荷期間の特定

```
resource.type="cloud_function"
httpRequest.status!=""
```

時間範囲を広げて、リクエスト数のスパイクを特定します。

## 並列実行数の確認

```
resource.type="cloud_function"
textPayload:"Function execution started"
```

同じ時間帯に多数の開始ログがあれば、並列実行が多いことを示します。
