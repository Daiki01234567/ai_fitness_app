/**
 * 日付ユーティリティ
 * 共通の日付操作関数
 */

/**
 * 現在のタイムスタンプをミリ秒で取得
 */
export function now(): number {
  return Date.now();
}

/**
 * 現在の日付を ISO 文字列で取得
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 日付に日数を加算
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 日付に時間を加算
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * 日付に分を加算
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * 日の開始を取得
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 日の終了を取得
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * 週の開始を取得（月曜日）
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  return startOfDay(result);
}

/**
 * 月の開始を取得
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  return startOfDay(result);
}

/**
 * 年の開始を取得
 */
export function startOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  return startOfDay(result);
}

/**
 * 日付が今日かどうかをチェック
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * 日付が過去かどうかをチェック
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * 日付が未来かどうかをチェック
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * 2つの日付間の日数を取得
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * 削除予定日を取得（今日から30日後）
 */
export function getDeletionScheduledDate(): Date {
  return addDays(new Date(), 30);
}

/**
 * 削除猶予期間が経過したかどうかをチェック
 */
export function isDeletionGracePeriodExpired(scheduledDate: Date): boolean {
  return isPast(scheduledDate);
}

/**
 * 日本のロケールで日付をフォーマット
 */
export function formatDateJP(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 日本のロケールで日時をフォーマット
 */
export function formatDateTimeJP(date: Date): string {
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ISO 日付文字列をパース
 */
export function parseISO(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * 期間タイプに基づいて期間の開始日を取得
 */
export function getPeriodStartDate(period: "week" | "month" | "year" | "all"): Date {
  const now = new Date();
  switch (period) {
    case "week":
      return startOfWeek(now);
    case "month":
      return startOfMonth(now);
    case "year":
      return startOfYear(now);
    case "all":
      return new Date(0); // Unix epoch
    default:
      return startOfMonth(now);
  }
}

/**
 * 指数バックオフでリトライ遅延を取得
 */
export function getExponentialBackoffDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
): number {
  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * 指数バックオフで次のリトライ時刻を取得
 */
export function getNextRetryTime(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
): Date {
  const delay = getExponentialBackoffDelay(attempt, baseDelayMs, maxDelayMs);
  return addMinutes(new Date(), delay / 60000);
}
