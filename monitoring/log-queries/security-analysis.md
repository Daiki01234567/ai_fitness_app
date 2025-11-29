# セキュリティログ分析クエリ

セキュリティイベントとインシデント調査用のクエリ集です。

## 全セキュリティイベント

```
resource.type="cloud_function"
jsonPayload.logType="security"
```

## ブルートフォース検知

```
resource.type="cloud_function"
jsonPayload.eventType="BRUTE_FORCE_DETECTED"
```

## 不正アクセス試行

```
resource.type="cloud_function"
jsonPayload.eventType="UNAUTHORIZED_ACCESS"
```

## レート制限超過

```
resource.type="cloud_function"
jsonPayload.eventType="RATE_LIMIT_EXCEEDED"
```

## 大量データダウンロード

```
resource.type="cloud_function"
jsonPayload.eventType="MASS_DATA_DOWNLOAD"
```

## クリティカルセキュリティイベント

```
resource.type="cloud_function"
jsonPayload.logType="security"
jsonPayload.severity="critical"
```

## 高リスクセキュリティイベント

```
resource.type="cloud_function"
jsonPayload.logType="security"
(jsonPayload.severity="high" OR jsonPayload.severity="critical")
```

## 特定IPアドレスのアクティビティ

```
resource.type="cloud_function"
jsonPayload.sourceIp="IP_ADDRESS_HERE"
```

## 認証失敗ログ

```
resource.type="cloud_function"
(jsonPayload.eventType="LOGIN_FAILURE" OR jsonPayload.eventType="AUTH_FAILURE")
```

## 権限昇格試行

```
resource.type="cloud_function"
jsonPayload.eventType="PRIVILEGE_ESCALATION"
```

## GDPR関連イベント

```
resource.type="cloud_function"
(jsonPayload.eventType="GDPR_VIOLATION_RISK" OR jsonPayload.message:"GDPR" OR jsonPayload.message:"データ削除")
```

## データ削除リクエスト

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.action="DATA_DELETION_REQUEST"
```

## 管理者アクション

```
resource.type="cloud_function"
jsonPayload.logType="audit"
jsonPayload.actorRole="admin"
```

## 特定ユーザーの全アクティビティ

```
resource.type="cloud_function"
jsonPayload.userId="USER_ID_HERE"
```

## 過去24時間の疑わしいアクティビティ

```
resource.type="cloud_function"
jsonPayload.logType="security"
timestamp>="2024-01-01T00:00:00Z"
```

## IPアドレス別のリクエスト数（不正検知用）

```
resource.type="cloud_function"
httpRequest.remoteIp!=""
```

結果をremoteIpでグループ化して、異常に多いIPを特定します。

## 時間外アクセス（不審な時間帯）

```
resource.type="cloud_function"
timestamp>="2024-01-01T02:00:00+09:00"
timestamp<="2024-01-01T05:00:00+09:00"
```

## 同意管理イベント

```
resource.type="cloud_function"
jsonPayload.logType="audit"
(jsonPayload.action="CONSENT_GRANTED" OR jsonPayload.action="CONSENT_REVOKED")
```
