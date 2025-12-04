-- exercise_definitions テーブルの初期データ投入
-- 仕様書: docs/specs/04_BigQuery設計書_v3_3.md - セクション4.4.3
--
-- 使用方法:
--   bq query --use_legacy_sql=false < scripts/bigquery/seed_exercise_definitions.sql
--
-- または BigQuery コンソールで実行

-- 既存データをクリアして再投入する場合はコメントを解除
-- DELETE FROM `tokyo-list-478804-e5.fitness_analytics.exercise_definitions` WHERE TRUE;

INSERT INTO `tokyo-list-478804-e5.fitness_analytics.exercise_definitions`
(exercise_id, exercise_name_en, exercise_name_ja, category, description, difficulty_level, required_landmarks, created_at, updated_at, is_active)
VALUES
  -- スクワット: 下半身の複合エクササイズ
  ('squat', 'Squat', 'スクワット', 'strength',
   'Lower body compound exercise targeting quadriceps, hamstrings, and glutes',
   'beginner',
   [23, 24, 25, 26, 27, 28],  -- 腰(23,24)、膝(25,26)、足首(27,28)
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),

  -- プッシュアップ: 上半身の複合エクササイズ
  ('push_up', 'Push-up', 'プッシュアップ', 'strength',
   'Upper body compound exercise targeting chest, shoulders, and triceps',
   'beginner',
   [11, 12, 13, 14, 15, 16],  -- 肩(11,12)、肘(13,14)、手首(15,16)
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),

  -- プランク: コア安定化エクササイズ (MVPでは実装予定なし、将来用)
  ('plank', 'Plank', 'プランク', 'strength',
   'Core stabilization exercise for abdominal and back muscles',
   'beginner',
   [11, 12, 23, 24],  -- 肩(11,12)、腰(23,24)
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), FALSE),

  -- ランジ: 下半身の片足エクササイズ (MVPでは実装予定なし、将来用)
  ('lunge', 'Lunge', 'ランジ', 'strength',
   'Lower body unilateral exercise for balance and leg strength',
   'intermediate',
   [23, 24, 25, 26, 27, 28],  -- 腰、膝、足首
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), FALSE),

  -- グルートブリッジ: 臀部エクササイズ (MVPでは実装予定なし、将来用)
  ('glute_bridge', 'Glute Bridge', 'グルートブリッジ', 'strength',
   'Hip extension exercise targeting glutes and hamstrings',
   'beginner',
   [23, 24, 25, 26],  -- 腰、膝
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), FALSE),

  -- アームカール (バイセップカール): MVP対象
  ('bicep_curl', 'Bicep Curl', 'アームカール', 'strength',
   'Isolation exercise for biceps targeting arm flexion',
   'beginner',
   [11, 12, 13, 14, 15, 16],  -- 肩、肘、手首
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),

  -- サイドレイズ: MVP対象
  ('lateral_raise', 'Lateral Raise', 'サイドレイズ', 'strength',
   'Shoulder isolation exercise for lateral deltoids',
   'beginner',
   [11, 12, 13, 14, 15, 16],  -- 肩、肘、手首
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE),

  -- ショルダープレス: MVP対象
  ('shoulder_press', 'Shoulder Press', 'ショルダープレス', 'strength',
   'Compound shoulder exercise targeting deltoids and triceps',
   'intermediate',
   [11, 12, 13, 14, 15, 16],  -- 肩、肘、手首
   CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), TRUE);

-- 投入結果を確認
SELECT exercise_id, exercise_name_ja, category, difficulty_level, is_active
FROM `tokyo-list-478804-e5.fitness_analytics.exercise_definitions`
ORDER BY is_active DESC, exercise_id;
