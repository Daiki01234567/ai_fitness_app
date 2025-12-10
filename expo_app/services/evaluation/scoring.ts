/**
 * Scoring Logic
 *
 * Functions for calculating frame and session scores
 * based on form evaluation checks.
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 * Reference: docs/common/specs/06_フォーム評価ロジック_v1_0.md
 */

import type { FormCheckResult, FormIssue } from "./types";

/**
 * Calculate frame score from check results
 *
 * Simple percentage-based scoring where each check has equal weight.
 *
 * @param checks - Array of check results (true = passed)
 * @returns Score from 0 to 100
 *
 * @example
 * const checks = [true, true, false, true];
 * const score = calculateFrameScore(checks); // 75
 */
export function calculateFrameScore(checks: boolean[]): number {
  if (checks.length === 0) return 0;

  const passedChecks = checks.filter((check) => check).length;
  const totalChecks = checks.length;

  return Math.round((passedChecks / totalChecks) * 100);
}

/**
 * Calculate frame score from FormCheckResult objects
 *
 * Supports optional weighting of checks.
 *
 * @param results - Array of FormCheckResult objects
 * @param weights - Optional weights for each check (default: equal weights)
 * @returns Score from 0 to 100
 */
export function calculateFrameScoreFromResults(
  results: FormCheckResult[],
  weights?: number[]
): number {
  if (results.length === 0) return 0;

  // Use equal weights if not provided
  const effectiveWeights = weights ?? results.map(() => 1);

  if (effectiveWeights.length !== results.length) {
    throw new Error("Weights array must match results array length");
  }

  let weightedSum = 0;
  let totalWeight = 0;

  results.forEach((result, index) => {
    const weight = effectiveWeights[index];
    weightedSum += result.passed ? weight : 0;
    totalWeight += weight;
  });

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100);
}

/**
 * Calculate overall session score from frame scores
 *
 * @param frameScores - Array of frame scores (0-100)
 * @returns Overall score from 0 to 100
 *
 * @example
 * const frames = [85, 90, 75, 80, 95];
 * const overall = calculateOverallScore(frames); // 85
 */
export function calculateOverallScore(frameScores: number[]): number {
  if (frameScores.length === 0) return 0;

  const sum = frameScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / frameScores.length);
}

/**
 * Calculate rep score from frame scores during a single rep
 *
 * @param repFrameScores - Frame scores for a single rep
 * @returns Rep score from 0 to 100
 */
export function calculateRepScore(repFrameScores: number[]): number {
  return calculateOverallScore(repFrameScores);
}

/**
 * Calculate weighted overall score (rep scores have more weight than individual frames)
 *
 * @param repScores - Scores for each completed rep
 * @returns Weighted overall score
 */
export function calculateWeightedOverallScore(repScores: number[]): number {
  if (repScores.length === 0) return 0;

  // Could implement more sophisticated weighting here
  // For now, simple average
  return calculateOverallScore(repScores);
}

/**
 * Get letter grade from score
 *
 * @param score - Score from 0 to 100
 * @returns Letter grade (S, A, B, C, D, F)
 */
export function getLetterGrade(score: number): "S" | "A" | "B" | "C" | "D" | "F" {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Get Japanese grade description
 *
 * @param score - Score from 0 to 100
 * @returns Japanese description of performance
 */
export function getScoreDescription(score: number): string {
  if (score >= 95) return "素晴らしいフォームです！";
  if (score >= 85) return "とても良いフォームです";
  if (score >= 70) return "良いフォームです";
  if (score >= 55) return "改善の余地があります";
  if (score >= 40) return "フォームを確認してください";
  return "フォームの改善が必要です";
}

/**
 * Analyze form issues from check results
 *
 * Identifies recurring problems across multiple frames.
 *
 * @param frameResults - Array of frame check results
 * @param minOccurrences - Minimum occurrences to count as an issue (default: 3)
 * @returns Array of identified form issues
 */
export function analyzeFormIssues(
  frameResults: FormCheckResult[][],
  minOccurrences: number = 3
): FormIssue[] {
  // Count failures for each check type
  const failureCounts = new Map<string, { count: number; description: string }>();

  frameResults.forEach((frame) => {
    frame.forEach((check) => {
      if (!check.passed) {
        const existing = failureCounts.get(check.description);
        if (existing) {
          existing.count++;
        } else {
          failureCounts.set(check.description, {
            count: 1,
            description: check.description,
          });
        }
      }
    });
  });

  // Convert to FormIssue array
  const issues: FormIssue[] = [];
  failureCounts.forEach((value, key) => {
    if (value.count >= minOccurrences) {
      issues.push({
        id: key.toLowerCase().replace(/\s+/g, "_"),
        description: value.description,
        occurrences: value.count,
        severity: getSeverity(value.count, frameResults.length),
        advice: getAdviceForIssue(key),
      });
    }
  });

  // Sort by occurrences (most frequent first)
  return issues.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Determine severity based on occurrence rate
 */
function getSeverity(
  occurrences: number,
  totalFrames: number
): "low" | "medium" | "high" {
  const rate = occurrences / totalFrames;
  if (rate >= 0.5) return "high";
  if (rate >= 0.25) return "medium";
  return "low";
}

/**
 * Get advice for a specific form issue
 */
function getAdviceForIssue(issueDescription: string): string {
  const adviceMap: Record<string, string> = {
    // Squat issues
    "膝の角度": "しゃがむ深さを調整してください。目標は90-110度です。",
    "膝がつま先を超えている":
      "膝がつま先より前に出ないよう、お尻を後ろに引いてください。",
    "背中が曲がっている": "背筋をまっすぐに保ち、胸を張ってください。",

    // Push-up issues
    "肘の角度": "肘を曲げる角度を調整してください。目標は80-100度です。",
    "体のライン": "お尻が上がりすぎ、または下がりすぎないようにしてください。",

    // Arm curl issues
    "肘が動いている": "肘を体の横に固定し、動かさないようにしてください。",
    "反動を使っている": "反動を使わず、ゆっくりとした動作で行ってください。",

    // Side raise issues
    "腕の高さ": "腕を肩の高さまで上げてください。",
    "左右非対称": "両腕を同じ高さまで上げるよう意識してください。",

    // Shoulder press issues
    "手首の高さ": "手首を頭の上まで押し上げてください。",
    "肘の伸び": "肘をしっかり伸ばしてください。",
  };

  // Find matching advice
  for (const [key, advice] of Object.entries(adviceMap)) {
    if (issueDescription.includes(key)) {
      return advice;
    }
  }

  return "フォームを確認し、ゆっくりとした動作で行ってください。";
}

/**
 * Calculate consistency score (how consistent the form is across reps)
 *
 * @param repScores - Scores for each rep
 * @returns Consistency score (0-100, higher = more consistent)
 */
export function calculateConsistencyScore(repScores: number[]): number {
  if (repScores.length < 2) return 100;

  // Calculate standard deviation
  const mean = repScores.reduce((a, b) => a + b, 0) / repScores.length;
  const squaredDiffs = repScores.map((score) => Math.pow(score - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / repScores.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Convert to consistency score (lower stdDev = higher consistency)
  // Max stdDev would be around 50 (scores ranging from 0-100)
  const maxStdDev = 50;
  const normalizedStdDev = Math.min(stdDev / maxStdDev, 1);

  return Math.round((1 - normalizedStdDev) * 100);
}

/**
 * Get performance trend from rep scores
 *
 * @param repScores - Scores for each rep in order
 * @returns Trend indicator
 */
export function getPerformanceTrend(
  repScores: number[]
): "improving" | "stable" | "declining" {
  if (repScores.length < 3) return "stable";

  // Compare first half average to second half average
  const midpoint = Math.floor(repScores.length / 2);
  const firstHalf = repScores.slice(0, midpoint);
  const secondHalf = repScores.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;

  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

/**
 * Generate summary statistics for a session
 */
export function generateSessionStats(repScores: number[]): {
  totalReps: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  consistency: number;
  trend: "improving" | "stable" | "declining";
  grade: "S" | "A" | "B" | "C" | "D" | "F";
} {
  if (repScores.length === 0) {
    return {
      totalReps: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      consistency: 0,
      trend: "stable",
      grade: "F",
    };
  }

  const averageScore = calculateOverallScore(repScores);

  return {
    totalReps: repScores.length,
    averageScore,
    bestScore: Math.max(...repScores),
    worstScore: Math.min(...repScores),
    consistency: calculateConsistencyScore(repScores),
    trend: getPerformanceTrend(repScores),
    grade: getLetterGrade(averageScore),
  };
}
