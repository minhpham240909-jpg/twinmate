-- ============================================================
-- Scale improvements: atomic quota + missing indexes
-- ============================================================

-- 1. Atomic lead quota enforcement
-- Checks quota AND increments in a single locked transaction.
-- Returns TRUE if the lead was allowed, FALSE if quota exceeded.
CREATE OR REPLACE FUNCTION try_use_lead(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT leads_used_this_month, plan_lead_limit
    INTO v_used, v_limit
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN FALSE;
  END IF;

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles
     SET leads_used_this_month = leads_used_this_month + 1
   WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2. Missing indexes for scale

-- Activity log: dashboard queries and cron digest
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log(user_id, created_at DESC);

-- Activity log: lead reference for orphan cleanup
CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id
  ON activity_log(lead_id) WHERE lead_id IS NOT NULL;

-- Leads: pagination tiebreaker (prevents duplicate rows across pages)
CREATE INDEX IF NOT EXISTS idx_leads_user_created_id
  ON leads(user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Push subscriptions: lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON push_subscriptions(user_id);
