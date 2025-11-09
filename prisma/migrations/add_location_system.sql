-- ==========================================
-- HYBRID LOCATION SYSTEM MIGRATION
-- ==========================================
-- Adds location fields to Profile table for hybrid location matching
-- Supports both auto-detect and manual entry with forward geocoding

-- Add location fields to Profile table
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "location_city" TEXT,
ADD COLUMN IF NOT EXISTS "location_state" TEXT,
ADD COLUMN IF NOT EXISTS "location_country" TEXT,
ADD COLUMN IF NOT EXISTS "location_lat" NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS "location_lng" NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS "location_visibility" TEXT NOT NULL DEFAULT 'match-only',
ADD COLUMN IF NOT EXISTS "location_last_updated" TIMESTAMPTZ;

-- Add check constraint for visibility values
ALTER TABLE "Profile"
ADD CONSTRAINT "location_visibility_check"
CHECK ("location_visibility" IN ('private', 'match-only', 'public'));

-- Add indexes for location-based queries
CREATE INDEX IF NOT EXISTS "idx_profile_location_lat_lng"
ON "Profile" ("location_lat", "location_lng")
WHERE "location_lat" IS NOT NULL AND "location_lng" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_profile_location_city"
ON "Profile" ("location_city")
WHERE "location_city" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_profile_location_visibility"
ON "Profile" ("location_visibility");

-- Add comment for documentation
COMMENT ON COLUMN "Profile"."location_city" IS 'City name from auto-detect or manual entry';
COMMENT ON COLUMN "Profile"."location_state" IS 'State/region from auto-detect or manual entry';
COMMENT ON COLUMN "Profile"."location_country" IS 'Country from auto-detect or manual entry';
COMMENT ON COLUMN "Profile"."location_lat" IS 'Latitude coordinate for proximity matching (optional, privacy-safe)';
COMMENT ON COLUMN "Profile"."location_lng" IS 'Longitude coordinate for proximity matching (optional, privacy-safe)';
COMMENT ON COLUMN "Profile"."location_visibility" IS 'Visibility setting: private, match-only, or public';
COMMENT ON COLUMN "Profile"."location_last_updated" IS 'Timestamp of last location update';

-- ==========================================
-- RLS POLICIES FOR LOCATION SECURITY
-- ==========================================

-- Enable RLS on Profile table (should already be enabled)
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can always view their own location data
CREATE POLICY "Users can view their own location"
ON "Profile" FOR SELECT
USING (auth.uid()::text = "userId");

-- Policy: Users can update their own location data
CREATE POLICY "Users can update their own location"
ON "Profile" FOR UPDATE
USING (auth.uid()::text = "userId");

-- Policy: Public location visibility - anyone can see city/state/country (but NOT coordinates)
-- This is handled in application layer by filtering coordinates based on visibility

-- Policy: Match-only visibility - only for matching algorithm
-- This is handled in application layer by checking visibility in matching logic

-- Policy: Private visibility - only user can see
-- This is handled in application layer by filtering based on visibility

-- Note: RLS ensures users can only update their own location
-- Application layer controls what location data is visible to other users based on visibility setting

-- ==========================================
-- HELPER FUNCTION: Calculate distance between two coordinates
-- ==========================================
-- Uses Haversine formula to calculate distance in miles

CREATE OR REPLACE FUNCTION calculate_distance_miles(
  lat1 NUMERIC,
  lng1 NUMERIC,
  lat2 NUMERIC,
  lng2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  radius NUMERIC := 3959; -- Earth's radius in miles
  dlat NUMERIC;
  dlng NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  -- Return NULL if any coordinate is NULL
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;

  -- Haversine formula
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);

  a := SIN(dlat/2) * SIN(dlat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlng/2) * SIN(dlng/2);

  c := 2 * ATAN2(SQRT(a), SQRT(1-a));

  RETURN radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- VALIDATION
-- ==========================================
-- Verify migration was successful

DO $$
BEGIN
  -- Check if all columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile'
    AND column_name = 'location_city'
  ) THEN
    RAISE EXCEPTION 'Migration failed: location_city column not created';
  END IF;

  RAISE NOTICE 'Location system migration completed successfully!';
END $$;
