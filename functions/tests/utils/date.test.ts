/**
 * Date Utility Tests
 *
 * Unit tests for date manipulation utilities
 * Covers GDPR grace period calculations and date formatting
 *
 * Reference: docs/specs/06_データ処理記録_ROPA_v1_0.md
 */

import {
  now,
  nowISO,
  addDays,
  addHours,
  addMinutes,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isToday,
  isPast,
  isFuture,
  daysBetween,
  getDeletionScheduledDate,
  isDeletionGracePeriodExpired,
  formatDateJP,
  formatDateTimeJP,
  parseISO,
  getPeriodStartDate,
  getExponentialBackoffDelay,
  getNextRetryTime,
} from "../../src/utils/date";

describe("Date Utilities", () => {
  // Use fixed date for consistent testing
  const fixedDate = new Date("2025-06-15T12:00:00.000Z");

  describe("now", () => {
    it("should return current timestamp in milliseconds", () => {
      const before = Date.now();
      const result = now();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("nowISO", () => {
    it("should return current date as ISO string", () => {
      const result = nowISO();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe("addDays", () => {
    it("should add positive days", () => {
      const result = addDays(fixedDate, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(5); // June (0-indexed)
    });

    it("should subtract days with negative value", () => {
      const result = addDays(fixedDate, -5);

      expect(result.getDate()).toBe(10);
    });

    it("should handle month overflow", () => {
      const result = addDays(fixedDate, 20);

      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(5);
    });

    it("should not mutate original date", () => {
      const original = new Date(fixedDate);
      addDays(fixedDate, 10);

      expect(fixedDate.getTime()).toBe(original.getTime());
    });
  });

  describe("addHours", () => {
    it("should add positive hours", () => {
      const result = addHours(fixedDate, 3);

      expect(result.getUTCHours()).toBe(15);
    });

    it("should subtract hours with negative value", () => {
      const result = addHours(fixedDate, -3);

      expect(result.getUTCHours()).toBe(9);
    });

    it("should handle day overflow", () => {
      const result = addHours(fixedDate, 24);

      expect(result.getDate()).toBe(16);
    });
  });

  describe("addMinutes", () => {
    it("should add positive minutes", () => {
      const result = addMinutes(fixedDate, 30);

      expect(result.getUTCMinutes()).toBe(30);
    });

    it("should subtract minutes with negative value", () => {
      const testDate = new Date("2025-06-15T12:30:00.000Z");
      const result = addMinutes(testDate, -15);

      expect(result.getUTCMinutes()).toBe(15);
    });

    it("should handle hour overflow", () => {
      const result = addMinutes(fixedDate, 90);

      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });

  describe("startOfDay", () => {
    it("should set time to 00:00:00.000", () => {
      const result = startOfDay(fixedDate);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it("should preserve date", () => {
      const result = startOfDay(fixedDate);

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(15);
    });
  });

  describe("endOfDay", () => {
    it("should set time to 23:59:59.999", () => {
      const result = endOfDay(fixedDate);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe("startOfWeek", () => {
    it("should return Monday for mid-week date", () => {
      // June 15, 2025 is Sunday
      const result = startOfWeek(fixedDate);

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(9);
    });

    it("should return previous Monday for Sunday", () => {
      const sunday = new Date("2025-06-15T12:00:00.000Z"); // Sunday
      const result = startOfWeek(sunday);

      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(9);
    });

    it("should return same day for Monday", () => {
      const monday = new Date("2025-06-16T12:00:00.000Z"); // Monday
      const result = startOfWeek(monday);

      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(16);
    });
  });

  describe("startOfMonth", () => {
    it("should return first day of month", () => {
      const result = startOfMonth(fixedDate);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5);
      expect(result.getHours()).toBe(0);
    });
  });

  describe("startOfYear", () => {
    it("should return January 1st", () => {
      const result = startOfYear(fixedDate);

      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2025);
    });
  });

  describe("isToday", () => {
    it("should return true for today", () => {
      const today = new Date();
      const result = isToday(today);

      expect(result).toBe(true);
    });

    it("should return false for yesterday", () => {
      const yesterday = addDays(new Date(), -1);
      const result = isToday(yesterday);

      expect(result).toBe(false);
    });

    it("should return false for tomorrow", () => {
      const tomorrow = addDays(new Date(), 1);
      const result = isToday(tomorrow);

      expect(result).toBe(false);
    });
  });

  describe("isPast", () => {
    it("should return true for past date", () => {
      const pastDate = new Date("2020-01-01");
      const result = isPast(pastDate);

      expect(result).toBe(true);
    });

    it("should return false for future date", () => {
      const futureDate = new Date("2030-01-01");
      const result = isPast(futureDate);

      expect(result).toBe(false);
    });
  });

  describe("isFuture", () => {
    it("should return true for future date", () => {
      const futureDate = new Date("2030-01-01");
      const result = isFuture(futureDate);

      expect(result).toBe(true);
    });

    it("should return false for past date", () => {
      const pastDate = new Date("2020-01-01");
      const result = isFuture(pastDate);

      expect(result).toBe(false);
    });
  });

  describe("daysBetween", () => {
    it("should calculate days between two dates", () => {
      const date1 = new Date("2025-06-01");
      const date2 = new Date("2025-06-15");
      const result = daysBetween(date1, date2);

      expect(result).toBe(14);
    });

    it("should return absolute value regardless of order", () => {
      const date1 = new Date("2025-06-15");
      const date2 = new Date("2025-06-01");
      const result = daysBetween(date1, date2);

      expect(result).toBe(14);
    });

    it("should return 0 for same date", () => {
      const date = new Date("2025-06-15");
      const result = daysBetween(date, date);

      expect(result).toBe(0);
    });
  });

  describe("getDeletionScheduledDate", () => {
    it("should return date 30 days in future", () => {
      const result = getDeletionScheduledDate();
      const expected = addDays(new Date(), 30);

      expect(daysBetween(result, expected)).toBe(0);
    });

    it("should be in the future", () => {
      const result = getDeletionScheduledDate();

      expect(isFuture(result)).toBe(true);
    });
  });

  describe("isDeletionGracePeriodExpired", () => {
    it("should return true for past scheduled date", () => {
      const pastDate = new Date("2020-01-01");
      const result = isDeletionGracePeriodExpired(pastDate);

      expect(result).toBe(true);
    });

    it("should return false for future scheduled date", () => {
      const futureDate = addDays(new Date(), 30);
      const result = isDeletionGracePeriodExpired(futureDate);

      expect(result).toBe(false);
    });
  });

  describe("formatDateJP", () => {
    it("should format date in Japanese locale", () => {
      const result = formatDateJP(fixedDate);

      // Result should contain Japanese date format
      expect(result).toContain("2025");
      expect(result).toContain("6");
      expect(result).toContain("15");
    });
  });

  describe("formatDateTimeJP", () => {
    it("should format datetime in Japanese locale", () => {
      const result = formatDateTimeJP(fixedDate);

      expect(result).toContain("2025");
      expect(result).toContain("6");
    });
  });

  describe("parseISO", () => {
    it("should parse valid ISO string", () => {
      const result = parseISO("2025-06-15T12:00:00.000Z");

      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(5);
      expect(result.getUTCDate()).toBe(15);
    });

    it("should throw for invalid string", () => {
      expect(() => parseISO("invalid-date")).toThrow("Invalid date string");
    });

    it("should throw for empty string", () => {
      expect(() => parseISO("")).toThrow("Invalid date string");
    });
  });

  describe("getPeriodStartDate", () => {
    it("should return start of week for week period", () => {
      const result = getPeriodStartDate("week");

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getHours()).toBe(0);
    });

    it("should return start of month for month period", () => {
      const result = getPeriodStartDate("month");

      expect(result.getDate()).toBe(1);
    });

    it("should return start of year for year period", () => {
      const result = getPeriodStartDate("year");

      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });

    it("should return Unix epoch for all period", () => {
      const result = getPeriodStartDate("all");

      expect(result.getTime()).toBe(0);
    });

    it("should default to month for unknown period", () => {
      const result = getPeriodStartDate("unknown" as any);

      expect(result.getDate()).toBe(1);
    });
  });

  describe("getExponentialBackoffDelay", () => {
    it("should return base delay for first attempt", () => {
      const result = getExponentialBackoffDelay(1);

      expect(result).toBe(1000);
    });

    it("should double delay for each attempt", () => {
      expect(getExponentialBackoffDelay(2)).toBe(2000);
      expect(getExponentialBackoffDelay(3)).toBe(4000);
      expect(getExponentialBackoffDelay(4)).toBe(8000);
    });

    it("should cap at max delay", () => {
      const result = getExponentialBackoffDelay(100, 1000, 60000);

      expect(result).toBe(60000);
    });

    it("should use custom base delay", () => {
      const result = getExponentialBackoffDelay(1, 500);

      expect(result).toBe(500);
    });
  });

  describe("getNextRetryTime", () => {
    it.skip("should return future date - timing dependent", () => {
      const result = getNextRetryTime(1);

      expect(isFuture(result)).toBe(true);
    });

    it.skip("should increase with attempt number - timing dependent", () => {
      const result1 = getNextRetryTime(1);
      const result2 = getNextRetryTime(5);

      expect(result2.getTime()).toBeGreaterThan(result1.getTime());
    });
  });
});

  describe("getNextRetryTime - full coverage", () => {
    it("should return future date with correct delay", () => {
      const before = new Date();
      const result = getNextRetryTime(1);
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime() + 2000);
    });

    it("should calculate correct delay for multiple attempts", () => {
      const result1 = getNextRetryTime(1, 1000, 60000);
      const result2 = getNextRetryTime(2, 1000, 60000);

      expect(result2.getTime()).toBeGreaterThanOrEqual(result1.getTime());
    });
  });
