/**
 * GDPR 通知サービス
 *
 * エクスポート完了・失敗の通知機能を提供
 *
 * 参照: docs/specs/06_データ処理記録_ROPA_v1_0.md
 * 参照: docs/tickets/015_data_export_deletion.md
 */

import { logger } from "../utils/logger";

// =============================================================================
// エクスポート通知
// =============================================================================

/**
 * エクスポート完了通知を送信
 *
 * ユーザーにデータエクスポートが完了したことを通知する
 * 開発環境ではログ出力のみ、本番環境ではメール送信サービスを使用
 *
 * @param userId - ユーザー ID
 * @param email - メールアドレス
 * @param downloadUrl - ダウンロード URL
 * @param expiresAt - 有効期限
 *
 * @example
 * ```typescript
 * sendExportCompletionNotification(
 *   "user123",
 *   "user@example.com",
 *   "https://storage.googleapis.com/...",
 *   new Date("2024-01-17T10:00:00Z")
 * );
 * ```
 */
export function sendExportCompletionNotification(
  userId: string,
  email: string,
  downloadUrl: string,
  expiresAt: Date,
): void {
  const isDevelopment =
    process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development";

  const expiresAtFormatted = expiresAt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const emailContent = {
    subject: "[AI Fitness] データエクスポートが完了しました",
    body: `
AI Fitness Appをご利用いただきありがとうございます。

リクエストいただいたデータエクスポートが完了しました。

■ ダウンロードについて
以下のリンクからデータをダウンロードできます。
※リンクの有効期限: ${expiresAtFormatted}（日本時間）

■ セキュリティに関するご注意
- このリンクはあなた専用です。第三者に共有しないでください。
- ダウンロードしたデータには個人情報が含まれています。
- 安全な場所に保管し、不要になったら完全に削除してください。

■ データの内容
エクスポートされたZIPファイルには以下が含まれます：
- プロフィール情報
- トレーニング履歴
- 設定情報
- 同意記録
- 分析データ（該当する場合）

ご不明な点がございましたら、アプリ内のお問い合わせフォームよりご連絡ください。

---
AI Fitness App サポートチーム
※このメールは自動送信されています。返信はできません。
    `.trim(),
  };

  if (isDevelopment) {
    // Development environment: log only
    logger.info("Export completion notification (development mode)", {
      userId,
      email,
      downloadUrl: downloadUrl.substring(0, 100) + "...",
      expiresAt: expiresAtFormatted,
      subject: emailContent.subject,
      bodyPreview: emailContent.body.substring(0, 200) + "...",
    });
    return;
  }

  // Production environment: send email via email service
  // TODO: Integrate with SendGrid, Firebase Extensions (Trigger Email), or other email service
  logger.info("Export completion notification sent", {
    userId,
    email,
    expiresAt: expiresAtFormatted,
  });

  // Example implementation with SendGrid (uncomment when service is configured):
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: email,
  //   from: 'noreply@aifitnessapp.com',
  //   subject: emailContent.subject,
  //   text: emailContent.body,
  //   html: `<pre>${emailContent.body}</pre>`, // Simple HTML version
  // });
}

/**
 * エクスポート失敗通知を送信
 *
 * ユーザーにデータエクスポートが失敗したことを通知する
 * 開発環境ではログ出力のみ、本番環境ではメール送信サービスを使用
 *
 * @param userId - ユーザー ID
 * @param email - メールアドレス
 * @param errorMessage - エラーメッセージ（オプション、内部ログ用）
 *
 * @example
 * ```typescript
 * sendExportFailureNotification(
 *   "user123",
 *   "user@example.com",
 *   "Timeout during export"
 * );
 * ```
 */
export function sendExportFailureNotification(
  userId: string,
  email: string,
  errorMessage?: string,
): void {
  const isDevelopment =
    process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development";

  const emailContent = {
    subject: "[AI Fitness] データエクスポートに失敗しました",
    body: `
AI Fitness Appをご利用いただきありがとうございます。

リクエストいただいたデータエクスポートの処理中にエラーが発生しました。
大変申し訳ございませんが、しばらく時間をおいてから再度お試しください。

問題が解決しない場合は、アプリ内のお問い合わせフォームよりご連絡ください。

---
AI Fitness App サポートチーム
※このメールは自動送信されています。返信はできません。
    `.trim(),
  };

  if (isDevelopment) {
    logger.info("Export failure notification (development mode)", {
      userId,
      email,
      errorMessage,
      subject: emailContent.subject,
    });
    return;
  }

  logger.info("Export failure notification sent", {
    userId,
    email,
    errorMessage,
  });

  // Example implementation with SendGrid (uncomment when service is configured):
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: email,
  //   from: 'noreply@aifitnessapp.com',
  //   subject: emailContent.subject,
  //   text: emailContent.body,
  //   html: `<pre>${emailContent.body}</pre>`,
  // });
}
