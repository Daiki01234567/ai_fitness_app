/**
 * 音声フィードバックメッセージ定義
 *
 * トレーニング中に読み上げるフィードバックメッセージを定義します。
 * 薬機法対応のため、すべてのメッセージは「参考情報」として扱います。
 *
 * @see docs/expo/tickets/023-voice-feedback.md
 * @see docs/common/specs/09_利用規約_v1_0.md - 第1.2条
 */

/**
 * 一般的なフィードバックメッセージ
 */
export const GENERAL_FEEDBACK = {
  good: "良いフォームです",
  excellent: "素晴らしいフォームです",
  keepGoing: "その調子で続けましょう",
  almostThere: "もう少しです",
  completed: "完了しました",
  paused: "一時停止しました",
  resumed: "再開します",
  sessionStart: "トレーニングを開始します",
  sessionEnd: "トレーニング終了です。お疲れ様でした",
} as const;

/**
 * スクワットのフィードバックメッセージ
 */
export const SQUAT_FEEDBACK = {
  kneesForward: "膝が前に出すぎているかもしれません",
  kneesInward: "膝が内側に入っているかもしれません",
  backStraight: "背中をまっすぐにしてみましょう",
  depthGood: "良い深さです",
  depthShallow: "もう少し深くしゃがんでみましょう",
  depthTooDeep: "しゃがみすぎかもしれません",
  heelLifting: "かかとが浮いているかもしれません",
  goodForm: "スクワットのフォームが良いです",
} as const;

/**
 * プッシュアップのフィードバックメッセージ
 */
export const PUSHUP_FEEDBACK = {
  bodyLine: "体のラインを維持しましょう",
  elbowAngle: "肘の角度を確認してみてください",
  hipsUp: "腰が上がっているかもしれません",
  hipsDown: "腰が下がっているかもしれません",
  headPosition: "頭の位置を確認してみてください",
  elbowFlare: "肘が開きすぎているかもしれません",
  goodForm: "プッシュアップのフォームが良いです",
} as const;

/**
 * アームカールのフィードバックメッセージ
 */
export const ARM_CURL_FEEDBACK = {
  elbowStable: "肘を固定しましょう",
  noSwing: "反動を使わないようにしましょう",
  fullRange: "可動域を最大限に使いましょう",
  slowDown: "ゆっくり下ろしましょう",
  controlledMotion: "動きをコントロールしましょう",
  goodForm: "アームカールのフォームが良いです",
} as const;

/**
 * サイドレイズのフィードバックメッセージ
 */
export const SIDE_RAISE_FEEDBACK = {
  height: "良い高さです",
  heightLow: "もう少し上げてみましょう",
  heightHigh: "上げすぎかもしれません",
  symmetry: "左右対称を意識しましょう",
  elbowBend: "肘を少し曲げましょう",
  shoulderShrug: "肩をすくめないようにしましょう",
  goodForm: "サイドレイズのフォームが良いです",
} as const;

/**
 * ショルダープレスのフィードバックメッセージ
 */
export const SHOULDER_PRESS_FEEDBACK = {
  elbowPath: "肘の軌道を確認してみてください",
  backArch: "腰の反りに注意しましょう",
  fullExtension: "しっかり伸ばしましょう",
  wristPosition: "手首の位置を確認してみてください",
  coreEngaged: "体幹を安定させましょう",
  goodForm: "ショルダープレスのフォームが良いです",
} as const;

/**
 * レップカウント読み上げ用
 */
export function getRepCountMessage(count: number): string {
  return `${count}回`;
}

/**
 * スコア読み上げ用
 */
export function getScoreMessage(score: number): string {
  if (score >= 90) {
    return `スコア${score}点、素晴らしいです`;
  } else if (score >= 80) {
    return `スコア${score}点、良いフォームです`;
  } else if (score >= 60) {
    return `スコア${score}点、改善の余地があります`;
  } else {
    return `スコア${score}点、フォームを確認しましょう`;
  }
}

/**
 * すべてのフィードバックメッセージ
 */
export const VOICE_FEEDBACK_MESSAGES = {
  general: GENERAL_FEEDBACK,
  squat: SQUAT_FEEDBACK,
  pushup: PUSHUP_FEEDBACK,
  armCurl: ARM_CURL_FEEDBACK,
  sideRaise: SIDE_RAISE_FEEDBACK,
  shoulderPress: SHOULDER_PRESS_FEEDBACK,
} as const;

export type VoiceFeedbackMessages = typeof VOICE_FEEDBACK_MESSAGES;
