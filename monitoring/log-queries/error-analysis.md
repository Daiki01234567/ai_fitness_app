# エラーログ分析クエリ

Cloud Logging ログエクスプローラー用のクエリ集です。

## 全エラーログの取得

```
resource.type="cloud_function"
severity>=ERROR
```

## 特定の関数のエラー

```
resource.type="cloud_function"
resource.labels.function_name="api"
severity>=ERROR
```

## 過去1時間の重大エラー

```
resource.type="cloud_function"
severity>=CRITICAL
timestamp>="2024-01-01T00:00:00Z"
```

## エラータイプ別の分類

```
resource.type="cloud_function"
severity>=ERROR
jsonPayload.errorCode!=""
```

## 認証エラー

```
resource.type="cloud_function"
severity>=WARNING
(jsonPayload.message:"authentication" OR jsonPayload.message:"unauthorized" OR jsonPayload.message:"permission denied")
```

## Firestoreエラー

```
resource.type="cloud_function"
severity>=ERROR
(jsonPayload.message:"Firestore" OR jsonPayload.message:"firestore" OR jsonPayload.errorCode:"firestore")
```

## HTTPエラーステータスコード

```
resource.type="cloud_function"
httpRequest.status>=400
```

## 5xxサーバーエラー

```
resource.type="cloud_function"
httpRequest.status>=500
```

## スタックトレース付きエラー

```
resource.type="cloud_function"
severity>=ERROR
jsonPayload.stack!=""
```

## 特定ユーザーのエラー

```
resource.type="cloud_function"
severity>=ERROR
jsonPayload.userId="USER_ID_HERE"
```

## エラー数のカウント（時間帯別）

ログエクスプローラーで以下を実行後、「ヒストグラムで表示」を選択：

```
resource.type="cloud_function"
severity>=ERROR
```

## 繰り返し発生するエラーパターン

```
resource.type="cloud_function"
severity>=ERROR
jsonPayload.message:"Error"
```

結果をグループ化して、同じメッセージの頻度を確認します。
