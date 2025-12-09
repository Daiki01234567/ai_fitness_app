# 047 セキュリティ監視API

## 概要

システムのセキュリティ状態を監視し、不正アクセスや異常な行動を検知・対応するためのAPIを実装するチケットです。アラート設定、インシデント管理、セキュリティダッシュボード機能を提供します。

## Phase

Phase 4（管理者バックエンド）

## プラットフォーム

common（バックエンド共通）

## 依存チケット

- 041: 管理者認証基盤

## 要件

### 機能要件

- FR-ADM-009: セキュリティ監視 - 監査ログを確認し、異常なアクセスパターンを検知

### 非機能要件

- NFR-041: 異常検知アラート - リアルタイムでアラートを送信
- NFR-013: 脆弱性診断 - リリース前に実施

## 受け入れ条件（Todo）

### 不正アクセス検知

- [ ] ログイン失敗の連続検知機能を実装
- [ ] 異常なIPアドレスからのアクセス検知を実装
- [ ] 不審なAPI呼び出しパターンの検知を実装
- [ ] ブルートフォース攻撃の検知を実装
- [ ] アカウント乗っ取りの兆候検知を実装

### アラート設定API

- [ ] アラートルールの作成・編集・削除APIを実装
- [ ] アラート通知先の設定APIを実装
- [ ] アラート閾値の設定APIを実装
- [ ] アラートの有効/無効切り替えAPIを実装

### インシデント管理API

- [ ] インシデント（セキュリティ事案）の登録APIを実装
- [ ] インシデント一覧・詳細取得APIを実装
- [ ] インシデントステータス更新APIを実装
- [ ] インシデント対応履歴記録APIを実装
- [ ] インシデントレポート生成APIを実装

### セキュリティダッシュボード

- [ ] セキュリティ概要取得APIを実装
- [ ] 直近のセキュリティイベント取得APIを実装
- [ ] 脅威レベル評価APIを実装

### テスト

- [ ] 不正アクセス検知ロジックのユニットテストを作成
- [ ] アラート設定APIのテストを作成
- [ ] インシデント管理APIのテストを作成
- [ ] 統合テストを作成

## 参照ドキュメント

- `docs/common/specs/02-1_機能要件_v1_0.md` - FR-ADM-009（セキュリティ監視）
- `docs/common/specs/02-2_非機能要件_v1_0.md` - NFR-041（異常検知アラート）
- `docs/common/specs/08_セキュリティポリシー_v1_0.md` - セキュリティ方針

## 技術詳細

### APIエンドポイント設計

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| GET | `/admin/security/dashboard` | セキュリティダッシュボード | admin以上 |
| GET | `/admin/security/events` | セキュリティイベント一覧 | admin以上 |
| GET | `/admin/security/alerts` | アラート一覧 | admin以上 |
| POST | `/admin/security/alerts` | アラートルール作成 | superAdmin |
| PUT | `/admin/security/alerts/:id` | アラートルール更新 | superAdmin |
| DELETE | `/admin/security/alerts/:id` | アラートルール削除 | superAdmin |
| GET | `/admin/security/incidents` | インシデント一覧 | admin以上 |
| POST | `/admin/security/incidents` | インシデント登録 | admin以上 |
| PUT | `/admin/security/incidents/:id` | インシデント更新 | admin以上 |
| POST | `/admin/security/incidents/:id/actions` | 対応記録追加 | admin以上 |

### データ構造

#### セキュリティイベント

```typescript
interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  sourceIp: string;
  userId?: string;
  userAgent?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  status: "new" | "acknowledged" | "investigating" | "resolved" | "false_positive";
  detectedAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
}

type SecurityEventType =
  | "LOGIN_FAILURE_BURST"      // ログイン失敗の連続
  | "SUSPICIOUS_IP"            // 不審なIPからのアクセス
  | "BRUTE_FORCE_ATTEMPT"      // ブルートフォース攻撃
  | "ACCOUNT_TAKEOVER_ATTEMPT" // アカウント乗っ取り試行
  | "UNUSUAL_API_PATTERN"      // 異常なAPI呼び出し
  | "ADMIN_ACCESS_ANOMALY"     // 管理者アクセスの異常
  | "DATA_EXFILTRATION_RISK"   // データ流出リスク
  | "RATE_LIMIT_EXCEEDED"      // レート制限超過
  | "UNAUTHORIZED_ACCESS"      // 権限外アクセス
  | "SESSION_HIJACK_RISK";     // セッションハイジャックリスク
```

#### アラートルール

```typescript
interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  eventType: SecurityEventType;
  conditions: AlertCondition[];
  severity: "low" | "medium" | "high" | "critical";
  notifications: AlertNotification[];
  cooldownMinutes: number;    // 連続アラート防止のクールダウン
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

interface AlertCondition {
  metric: string;             // 監視対象メトリクス
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number;
  timeWindowMinutes: number;  // 時間窓
}

interface AlertNotification {
  type: "email" | "slack" | "webhook";
  target: string;             // メールアドレス、SlackチャンネルID、WebhookURL
  enabled: boolean;
}
```

#### インシデント

```typescript
interface Incident {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  category: IncidentCategory;
  affectedUsers: number;
  affectedSystems: string[];
  relatedEvents: string[];    // セキュリティイベントID
  assignee?: string;
  timeline: IncidentAction[];
  detectedAt: Timestamp;
  containedAt?: Timestamp;
  resolvedAt?: Timestamp;
  closedAt?: Timestamp;
  rootCause?: string;
  remediation?: string;
  lessonsLearned?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

type IncidentCategory =
  | "DATA_BREACH"
  | "UNAUTHORIZED_ACCESS"
  | "MALWARE"
  | "DDOS"
  | "PHISHING"
  | "INSIDER_THREAT"
  | "CONFIGURATION_ERROR"
  | "OTHER";

interface IncidentAction {
  id: string;
  action: string;
  performedBy: string;
  performedAt: Timestamp;
  notes: string;
}
```

### 実装例

#### セキュリティダッシュボードAPI

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/adminAuth";
import * as admin from "firebase-admin";

/**
 * セキュリティダッシュボードAPI
 *
 * セキュリティ状態の概要を取得します。
 */
export const getSecurityDashboard = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 各種メトリクスを並列で取得
        const [
          eventsLast24h,
          eventsLast7d,
          activeIncidents,
          loginFailures,
          suspiciousIps,
          threatLevel,
        ] = await Promise.all([
          countSecurityEvents(last24h, now),
          countSecurityEvents(last7d, now),
          countActiveIncidents(),
          countLoginFailures(last24h),
          getSuspiciousIps(last24h),
          calculateThreatLevel(),
        ]);

        // 重要度別イベント数
        const eventsBySeverity = await getEventsBySeverity(last24h, now);

        // 最近のイベント
        const recentEvents = await getRecentSecurityEvents(10);

        const dashboard = {
          summary: {
            threatLevel: threatLevel,
            eventsLast24h: eventsLast24h,
            eventsLast7d: eventsLast7d,
            activeIncidents: activeIncidents,
            criticalEvents: eventsBySeverity.critical || 0,
            highEvents: eventsBySeverity.high || 0,
          },
          loginSecurity: {
            failuresLast24h: loginFailures,
            suspiciousIpCount: suspiciousIps.length,
            blockedIps: await getBlockedIpsCount(),
          },
          recentEvents: recentEvents.map(event => ({
            id: event.id,
            type: event.type,
            severity: event.severity,
            title: event.title,
            detectedAt: event.detectedAt.toDate().toISOString(),
            status: event.status,
          })),
          alerts: {
            activeAlerts: await countActiveAlerts(),
            triggeredLast24h: await countTriggeredAlerts(last24h),
          },
          generatedAt: now.toISOString(),
        };

        res.json(dashboard);
      } catch (error) {
        logger.error("セキュリティダッシュボード取得エラー", { error });
        res.status(500).json({
          error: "セキュリティダッシュボードの取得に失敗しました",
          code: "DASHBOARD_ERROR",
        });
      }
    });
  }
);

/**
 * 脅威レベルを計算
 *
 * 各種指標から総合的な脅威レベルを判定します。
 */
async function calculateThreatLevel(): Promise<"low" | "medium" | "high" | "critical"> {
  const now = new Date();
  const last1h = new Date(now.getTime() - 60 * 60 * 1000);

  // 直近1時間のイベントを取得
  const eventsSnapshot = await admin.firestore()
    .collection("securityEvents")
    .where("detectedAt", ">=", admin.firestore.Timestamp.fromDate(last1h))
    .get();

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;

  eventsSnapshot.docs.forEach(doc => {
    const event = doc.data();
    switch (event.severity) {
      case "critical": criticalCount++; break;
      case "high": highCount++; break;
      case "medium": mediumCount++; break;
    }
  });

  // 脅威レベルの判定ロジック
  if (criticalCount > 0) return "critical";
  if (highCount >= 3) return "critical";
  if (highCount >= 1) return "high";
  if (mediumCount >= 5) return "high";
  if (mediumCount >= 2) return "medium";
  return "low";
}
```

#### 不正アクセス検知（バックグラウンド処理）

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * 不正アクセス検知（定期実行）
 *
 * 5分ごとに実行し、不審なアクセスパターンを検出します。
 */
export const detectSuspiciousActivity = onSchedule(
  { schedule: "every 5 minutes", region: "asia-northeast1" },
  async () => {
    const now = new Date();
    const last5min = new Date(now.getTime() - 5 * 60 * 1000);

    // 各種検知を並列実行
    await Promise.all([
      detectLoginFailureBurst(last5min, now),
      detectBruteForceAttempt(last5min, now),
      detectSuspiciousIpAccess(last5min, now),
      detectUnusualApiPattern(last5min, now),
    ]);
  }
);

/**
 * ログイン失敗の連続を検知
 *
 * 同一IPまたは同一ユーザーで短時間に複数回失敗した場合に検知
 */
async function detectLoginFailureBurst(start: Date, end: Date): Promise<void> {
  const THRESHOLD = 5; // 5回以上で検知

  // ログイン失敗ログを取得
  const failuresSnapshot = await admin.firestore()
    .collection("authLogs")
    .where("action", "==", "LOGIN_FAILED")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(end))
    .get();

  // IPアドレスごとに集計
  const ipCounts: Record<string, { count: number; emails: Set<string> }> = {};

  failuresSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const ip = data.ipAddress;
    if (!ipCounts[ip]) {
      ipCounts[ip] = { count: 0, emails: new Set() };
    }
    ipCounts[ip].count++;
    ipCounts[ip].emails.add(data.email);
  });

  // 閾値を超えたIPに対してイベントを作成
  for (const [ip, stats] of Object.entries(ipCounts)) {
    if (stats.count >= THRESHOLD) {
      await createSecurityEvent({
        type: "LOGIN_FAILURE_BURST",
        severity: stats.count >= 10 ? "high" : "medium",
        title: `ログイン失敗の連続検知: ${ip}`,
        description: `IPアドレス ${ip} から ${stats.count}回のログイン失敗が検出されました。`,
        sourceIp: ip,
        details: {
          failureCount: stats.count,
          targetedEmails: Array.from(stats.emails),
          timeWindow: "5分",
        },
      });

      // 10回以上の場合は一時的にIPをブロック
      if (stats.count >= 10) {
        await temporarilyBlockIp(ip, 30); // 30分間ブロック
      }
    }
  }
}

/**
 * ブルートフォース攻撃を検知
 *
 * 同一メールアドレスに対する短時間での大量のログイン試行を検知
 */
async function detectBruteForceAttempt(start: Date, end: Date): Promise<void> {
  const THRESHOLD = 10; // 10回以上で検知

  const failuresSnapshot = await admin.firestore()
    .collection("authLogs")
    .where("action", "==", "LOGIN_FAILED")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(end))
    .get();

  // メールアドレスごとに集計
  const emailCounts: Record<string, { count: number; ips: Set<string> }> = {};

  failuresSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const email = data.email;
    if (!emailCounts[email]) {
      emailCounts[email] = { count: 0, ips: new Set() };
    }
    emailCounts[email].count++;
    emailCounts[email].ips.add(data.ipAddress);
  });

  for (const [email, stats] of Object.entries(emailCounts)) {
    if (stats.count >= THRESHOLD) {
      await createSecurityEvent({
        type: "BRUTE_FORCE_ATTEMPT",
        severity: "critical",
        title: `ブルートフォース攻撃の可能性: ${maskEmail(email)}`,
        description: `メールアドレス ${maskEmail(email)} に対して ${stats.count}回のログイン試行が検出されました。`,
        sourceIp: Array.from(stats.ips).join(", "),
        details: {
          attemptCount: stats.count,
          sourceIpCount: stats.ips.size,
          sourceIps: Array.from(stats.ips),
          timeWindow: "5分",
        },
      });

      // ユーザーに警告メールを送信
      await sendSecurityAlertEmail(email, "ブルートフォース攻撃の可能性");
    }
  }
}

/**
 * セキュリティイベントを作成
 */
async function createSecurityEvent(input: {
  type: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  sourceIp: string;
  userId?: string;
  details: Record<string, unknown>;
}): Promise<string> {
  const now = admin.firestore.Timestamp.now();
  const id = admin.firestore().collection("securityEvents").doc().id;

  const event = {
    id,
    ...input,
    status: "new",
    detectedAt: now,
    userAgent: null,
    endpoint: null,
  };

  await admin.firestore()
    .collection("securityEvents")
    .doc(id)
    .set(event);

  // アラートルールをチェックしてトリガー
  await checkAndTriggerAlerts(event);

  logger.warn("セキュリティイベントを検出", {
    eventId: id,
    type: input.type,
    severity: input.severity,
  });

  return id;
}

/**
 * アラートルールをチェックしてトリガー
 */
async function checkAndTriggerAlerts(event: SecurityEvent): Promise<void> {
  // 有効なアラートルールを取得
  const rulesSnapshot = await admin.firestore()
    .collection("alertRules")
    .where("enabled", "==", true)
    .where("eventType", "==", event.type)
    .get();

  for (const ruleDoc of rulesSnapshot.docs) {
    const rule = ruleDoc.data() as AlertRule;

    // 重要度チェック
    if (shouldTrigger(event.severity, rule.severity)) {
      // クールダウンチェック
      const canTrigger = await checkCooldown(rule.id, rule.cooldownMinutes);
      if (!canTrigger) continue;

      // 通知を送信
      for (const notification of rule.notifications) {
        if (!notification.enabled) continue;

        switch (notification.type) {
          case "email":
            await sendAlertEmail(notification.target, rule, event);
            break;
          case "slack":
            await sendSlackAlert(notification.target, rule, event);
            break;
          case "webhook":
            await sendWebhookAlert(notification.target, rule, event);
            break;
        }
      }

      // アラート履歴を記録
      await admin.firestore()
        .collection("alertHistory")
        .add({
          ruleId: rule.id,
          ruleName: rule.name,
          eventId: event.id,
          eventType: event.type,
          severity: event.severity,
          triggeredAt: admin.firestore.Timestamp.now(),
        });

      logger.info("アラートをトリガーしました", {
        ruleId: rule.id,
        eventId: event.id,
      });
    }
  }
}
```

#### インシデント管理API

```typescript
/**
 * インシデント登録API
 */
export const createIncident = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    await requireAdmin("admin")(req, res, async () => {
      try {
        const {
          title,
          description,
          severity,
          category,
          affectedSystems,
          relatedEvents,
        } = req.body;

        // 入力チェック
        if (!title || !description || !severity || !category) {
          return res.status(400).json({
            error: "必須項目を入力してください",
            code: "REQUIRED_FIELDS_MISSING",
          });
        }

        const now = admin.firestore.Timestamp.now();
        const id = admin.firestore().collection("incidents").doc().id;

        const incident: Incident = {
          id,
          title,
          description,
          severity,
          status: "open",
          category,
          affectedUsers: 0,
          affectedSystems: affectedSystems || [],
          relatedEvents: relatedEvents || [],
          timeline: [{
            id: `action_${Date.now()}`,
            action: "インシデント登録",
            performedBy: req.adminUser.uid,
            performedAt: now,
            notes: "インシデントが登録されました",
          }],
          detectedAt: now,
          createdAt: now,
          createdBy: req.adminUser.uid,
          updatedAt: now,
        };

        await admin.firestore()
          .collection("incidents")
          .doc(id)
          .set(incident);

        // 関連するセキュリティイベントのステータスを更新
        if (relatedEvents && relatedEvents.length > 0) {
          const batch = admin.firestore().batch();
          for (const eventId of relatedEvents) {
            const eventRef = admin.firestore()
              .collection("securityEvents")
              .doc(eventId);
            batch.update(eventRef, {
              status: "investigating",
              incidentId: id,
            });
          }
          await batch.commit();
        }

        // 監査ログ
        await logAuditEvent({
          action: "INCIDENT_CREATED",
          category: "SECURITY",
          severity: severity === "critical" ? "critical" : "warning",
          performedBy: req.adminUser.uid,
          details: { incidentId: id, title, severity, category },
          ipAddress: req.ip,
        });

        // 重大インシデントの場合は即座に通知
        if (severity === "critical" || severity === "high") {
          await notifyIncidentCreated(incident);
        }

        res.status(201).json({
          id,
          createdAt: now.toDate().toISOString(),
        });
      } catch (error) {
        logger.error("インシデント登録エラー", { error });
        res.status(500).json({
          error: "インシデントの登録に失敗しました",
          code: "CREATE_INCIDENT_ERROR",
        });
      }
    });
  }
);
```

## 見積もり

- 工数: 6日
- 難易度: 高

## 進捗

- [ ] 未着手

## 完了日

（未完了）

## 備考

- 不正アクセス検知のロジックは運用しながらチューニングが必要
- 誤検知（False Positive）を減らすために閾値の調整を行う
- GDPRの観点からIPアドレスの保存期間に注意
- 重大インシデント発生時の対応フローを別途定義する

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-12-10 | 初版作成 |
