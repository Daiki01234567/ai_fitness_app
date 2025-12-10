/**
 * Unit Tests for Scoring Functions
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 */

import {
  calculateFrameScore,
  calculateFrameScoreFromResults,
  calculateOverallScore,
  calculateRepScore,
  getLetterGrade,
  getScoreDescription,
  calculateConsistencyScore,
  getPerformanceTrend,
  generateSessionStats,
} from "../scoring";
import type { FormCheckResult } from "../types";

describe("calculateFrameScore", () => {
  it("calculates 100% for all passed checks", () => {
    const checks = [true, true, true, true];
    expect(calculateFrameScore(checks)).toBe(100);
  });

  it("calculates 0% for all failed checks", () => {
    const checks = [false, false, false, false];
    expect(calculateFrameScore(checks)).toBe(0);
  });

  it("calculates 75% for 3 of 4 passed", () => {
    const checks = [true, true, true, false];
    expect(calculateFrameScore(checks)).toBe(75);
  });

  it("calculates 50% for half passed", () => {
    const checks = [true, false, true, false];
    expect(calculateFrameScore(checks)).toBe(50);
  });

  it("returns 0 for empty array", () => {
    expect(calculateFrameScore([])).toBe(0);
  });

  it("rounds to nearest integer", () => {
    const checks = [true, true, false]; // 66.67%
    expect(calculateFrameScore(checks)).toBe(67);
  });
});

describe("calculateFrameScoreFromResults", () => {
  const createResult = (passed: boolean): FormCheckResult => ({
    passed,
    value: 0,
    description: "Test check",
  });

  it("calculates score with equal weights", () => {
    const results = [createResult(true), createResult(true), createResult(false)];
    expect(calculateFrameScoreFromResults(results)).toBe(67);
  });

  it("calculates score with custom weights", () => {
    const results = [createResult(true), createResult(false)];
    const weights = [3, 1]; // First check is 3x more important

    // 3 passed out of 4 total weight = 75%
    expect(calculateFrameScoreFromResults(results, weights)).toBe(75);
  });

  it("throws error for mismatched weights array", () => {
    const results = [createResult(true), createResult(false)];
    const weights = [1];

    expect(() => calculateFrameScoreFromResults(results, weights)).toThrow();
  });

  it("returns 0 for empty results", () => {
    expect(calculateFrameScoreFromResults([])).toBe(0);
  });
});

describe("calculateOverallScore", () => {
  it("calculates average of frame scores", () => {
    const frameScores = [80, 90, 85, 75];
    expect(calculateOverallScore(frameScores)).toBe(83);
  });

  it("returns 0 for empty array", () => {
    expect(calculateOverallScore([])).toBe(0);
  });

  it("returns score for single frame", () => {
    expect(calculateOverallScore([85])).toBe(85);
  });

  it("rounds to nearest integer", () => {
    const frameScores = [80, 90]; // Average: 85
    expect(calculateOverallScore(frameScores)).toBe(85);
  });
});

describe("calculateRepScore", () => {
  it("calculates average of rep frame scores", () => {
    const repFrameScores = [90, 85, 80, 85];
    expect(calculateRepScore(repFrameScores)).toBe(85);
  });
});

describe("getLetterGrade", () => {
  it("returns S for 95+", () => {
    expect(getLetterGrade(95)).toBe("S");
    expect(getLetterGrade(100)).toBe("S");
  });

  it("returns A for 85-94", () => {
    expect(getLetterGrade(85)).toBe("A");
    expect(getLetterGrade(94)).toBe("A");
  });

  it("returns B for 70-84", () => {
    expect(getLetterGrade(70)).toBe("B");
    expect(getLetterGrade(84)).toBe("B");
  });

  it("returns C for 55-69", () => {
    expect(getLetterGrade(55)).toBe("C");
    expect(getLetterGrade(69)).toBe("C");
  });

  it("returns D for 40-54", () => {
    expect(getLetterGrade(40)).toBe("D");
    expect(getLetterGrade(54)).toBe("D");
  });

  it("returns F for below 40", () => {
    expect(getLetterGrade(39)).toBe("F");
    expect(getLetterGrade(0)).toBe("F");
  });
});

describe("getScoreDescription", () => {
  it("returns Japanese descriptions for each score range", () => {
    expect(getScoreDescription(95)).toContain("素晴らしい");
    expect(getScoreDescription(85)).toContain("とても良い");
    expect(getScoreDescription(70)).toContain("良い");
    expect(getScoreDescription(55)).toContain("改善");
    expect(getScoreDescription(40)).toContain("確認");
    expect(getScoreDescription(30)).toContain("必要");
  });
});

describe("calculateConsistencyScore", () => {
  it("returns 100 for identical scores", () => {
    const repScores = [80, 80, 80, 80];
    expect(calculateConsistencyScore(repScores)).toBe(100);
  });

  it("returns 100 for single rep", () => {
    expect(calculateConsistencyScore([85])).toBe(100);
  });

  it("returns lower score for inconsistent reps", () => {
    const consistentScores = [80, 82, 78, 80];
    const inconsistentScores = [50, 90, 60, 100];

    const consistentResult = calculateConsistencyScore(consistentScores);
    const inconsistentResult = calculateConsistencyScore(inconsistentScores);

    expect(consistentResult).toBeGreaterThan(inconsistentResult);
  });

  it("handles extreme variation", () => {
    const extremeScores = [0, 100, 0, 100];
    const result = calculateConsistencyScore(extremeScores);
    expect(result).toBeLessThan(50);
  });
});

describe("getPerformanceTrend", () => {
  it("returns improving when second half is better", () => {
    const repScores = [70, 75, 80, 85, 90, 95];
    expect(getPerformanceTrend(repScores)).toBe("improving");
  });

  it("returns declining when second half is worse", () => {
    const repScores = [95, 90, 85, 80, 75, 70];
    expect(getPerformanceTrend(repScores)).toBe("declining");
  });

  it("returns stable when scores are similar", () => {
    const repScores = [80, 82, 78, 81, 79, 80];
    expect(getPerformanceTrend(repScores)).toBe("stable");
  });

  it("returns stable for fewer than 3 reps", () => {
    expect(getPerformanceTrend([80])).toBe("stable");
    expect(getPerformanceTrend([80, 90])).toBe("stable");
  });
});

describe("generateSessionStats", () => {
  it("generates complete stats for session", () => {
    const repScores = [85, 90, 80, 95, 88];
    const stats = generateSessionStats(repScores);

    expect(stats.totalReps).toBe(5);
    expect(stats.averageScore).toBe(88);
    expect(stats.bestScore).toBe(95);
    expect(stats.worstScore).toBe(80);
    expect(stats.grade).toBe("A");
    expect(typeof stats.consistency).toBe("number");
    expect(["improving", "stable", "declining"]).toContain(stats.trend);
  });

  it("handles empty session", () => {
    const stats = generateSessionStats([]);

    expect(stats.totalReps).toBe(0);
    expect(stats.averageScore).toBe(0);
    expect(stats.bestScore).toBe(0);
    expect(stats.worstScore).toBe(0);
    expect(stats.grade).toBe("F");
  });

  it("handles single rep", () => {
    const stats = generateSessionStats([85]);

    expect(stats.totalReps).toBe(1);
    expect(stats.averageScore).toBe(85);
    expect(stats.bestScore).toBe(85);
    expect(stats.worstScore).toBe(85);
  });
});
