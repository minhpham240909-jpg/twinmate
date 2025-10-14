-- ============================================
-- Fix Materialized View Security Warning
-- Created: 2025-10-10
-- Purpose: Restrict access to common_timezones materialized view
-- ============================================

-- Revoke public access to the materialized view
REVOKE ALL ON public.common_timezones FROM anon;
REVOKE ALL ON public.common_timezones FROM authenticated;

-- Grant only SELECT to authenticated users if they need it
-- Comment this line out if you don't want ANY API access to this view
GRANT SELECT ON public.common_timezones TO authenticated;

-- Alternative: If you don't need this view to be accessible via the API at all,
-- you can keep the REVOKE statements above and not grant any permissions.
-- The view will still be usable by your database functions and backend code.
