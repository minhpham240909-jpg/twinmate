-- Migration: Seed initial unlockable items for Progress Perks shop
-- Date: 2025-01-15
-- Description: Creates initial themes, sounds, and streak shields for the shop

-- ============================================================================
-- 1. INSERT THEME UNLOCKABLES
-- ============================================================================

INSERT INTO "Unlockable" ("id", "itemId", "name", "description", "category", "pointsCost", "icon", "previewUrl", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  -- Free default theme
  (gen_random_uuid(), 'theme_default', 'Classic Light', 'Clean, minimal light theme', 'THEME', 0, '☀️', NULL, true, 1, NOW(), NOW()),
  -- Paid themes
  (gen_random_uuid(), 'theme_dark', 'Midnight Dark', 'Easy on the eyes dark mode', 'THEME', 50, '🌙', NULL, true, 2, NOW(), NOW()),
  (gen_random_uuid(), 'theme_forest', 'Forest Green', 'Calming nature-inspired theme', 'THEME', 100, '🌲', NULL, true, 3, NOW(), NOW()),
  (gen_random_uuid(), 'theme_ocean', 'Ocean Blue', 'Deep blue oceanic vibes', 'THEME', 100, '🌊', NULL, true, 4, NOW(), NOW()),
  (gen_random_uuid(), 'theme_sunset', 'Sunset Warm', 'Warm amber and orange tones', 'THEME', 150, '🌅', NULL, true, 5, NOW(), NOW()),
  (gen_random_uuid(), 'theme_lavender', 'Lavender Dreams', 'Soft purple relaxing theme', 'THEME', 150, '💜', NULL, true, 6, NOW(), NOW())
ON CONFLICT ("itemId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "pointsCost" = EXCLUDED."pointsCost",
  "icon" = EXCLUDED."icon",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- ============================================================================
-- 2. INSERT SOUND UNLOCKABLES
-- ============================================================================

INSERT INTO "Unlockable" ("id", "itemId", "name", "description", "category", "pointsCost", "icon", "previewUrl", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  -- Free default sound (no sound / silence)
  (gen_random_uuid(), 'sound_none', 'Silence', 'Pure focus, no distractions', 'SOUND', 0, '🔇', NULL, true, 1, NOW(), NOW()),
  -- Paid ambient sounds
  (gen_random_uuid(), 'sound_rain', 'Gentle Rain', 'Soothing rain sounds', 'SOUND', 50, '🌧️', '/sounds/ambient/rain.mp3', true, 2, NOW(), NOW()),
  (gen_random_uuid(), 'sound_cafe', 'Coffee Shop', 'Ambient cafe background', 'SOUND', 75, '☕', '/sounds/ambient/cafe.mp3', true, 3, NOW(), NOW()),
  (gen_random_uuid(), 'sound_forest', 'Forest Birds', 'Nature sounds with birds', 'SOUND', 75, '🐦', '/sounds/ambient/forest.mp3', true, 4, NOW(), NOW()),
  (gen_random_uuid(), 'sound_ocean', 'Ocean Waves', 'Calm ocean waves', 'SOUND', 100, '🌊', '/sounds/ambient/ocean.mp3', true, 5, NOW(), NOW()),
  (gen_random_uuid(), 'sound_fireplace', 'Cozy Fireplace', 'Crackling fire sounds', 'SOUND', 100, '🔥', '/sounds/ambient/fireplace.mp3', true, 6, NOW(), NOW()),
  (gen_random_uuid(), 'sound_lofi', 'Lo-Fi Beats', 'Chill lo-fi music', 'SOUND', 150, '🎵', '/sounds/ambient/lofi.mp3', true, 7, NOW(), NOW())
ON CONFLICT ("itemId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "pointsCost" = EXCLUDED."pointsCost",
  "icon" = EXCLUDED."icon",
  "previewUrl" = EXCLUDED."previewUrl",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- ============================================================================
-- 3. INSERT STREAK SHIELD UNLOCKABLES
-- ============================================================================

INSERT INTO "Unlockable" ("id", "itemId", "name", "description", "category", "pointsCost", "icon", "previewUrl", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'streak_shield', 'Streak Shield', 'Protects your streak if you miss a day. Used automatically when needed.', 'STREAK_SHIELD', 200, '🛡️', NULL, true, 1, NOW(), NOW())
ON CONFLICT ("itemId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "pointsCost" = EXCLUDED."pointsCost",
  "icon" = EXCLUDED."icon",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
DECLARE
    theme_count INTEGER;
    sound_count INTEGER;
    shield_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO theme_count FROM "Unlockable" WHERE category = 'THEME' AND "isActive" = true;
    SELECT COUNT(*) INTO sound_count FROM "Unlockable" WHERE category = 'SOUND' AND "isActive" = true;
    SELECT COUNT(*) INTO shield_count FROM "Unlockable" WHERE category = 'STREAK_SHIELD' AND "isActive" = true;

    RAISE NOTICE 'Unlockables seeded: % themes, % sounds, % shields', theme_count, sound_count, shield_count;
END $$;
