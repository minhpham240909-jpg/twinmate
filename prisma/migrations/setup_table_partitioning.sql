-- ==========================================
-- TABLE PARTITIONING FOR TIME-SERIES DATA
-- ==========================================
-- Partition large time-series tables for better performance at scale
--
-- Benefits:
-- 1. Faster queries on recent data (most common use case)
-- 2. Efficient archival/deletion of old data
-- 3. Better index performance (smaller indexes per partition)
-- 4. Parallel query execution across partitions
--
-- IMPORTANT: This is a PREPARATORY migration
-- Actual table conversion requires careful planning and downtime
-- Use this as a reference for future partitioning implementation
--
-- SECURITY: All partitions inherit RLS policies from parent table
-- ==========================================

-- ==========================================
-- HELPER FUNCTION: Auto-create partitions
-- ==========================================

CREATE OR REPLACE FUNCTION create_monthly_partition(
  parent_table text,
  partition_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partition_name text;
  start_date date;
  end_date date;
BEGIN
  -- Calculate partition boundaries (first day of month to first day of next month)
  start_date := date_trunc('month', partition_date)::date;
  end_date := (start_date + interval '1 month')::date;

  -- Generate partition name (e.g., notification_2025_01)
  partition_name := parent_table || '_' || to_char(partition_date, 'YYYY_MM');

  -- Create partition if it doesn't exist
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    parent_table,
    start_date,
    end_date
  );

  RAISE NOTICE 'Created partition: % for range % to %', partition_name, start_date, end_date;
END;
$$;

-- ==========================================
-- HELPER FUNCTION: Auto-create next 12 months of partitions
-- ==========================================

CREATE OR REPLACE FUNCTION create_future_partitions(
  parent_table text,
  months_ahead int DEFAULT 12
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int;
  partition_date date;
BEGIN
  FOR i IN 0..months_ahead LOOP
    partition_date := (CURRENT_DATE + (i || ' months')::interval)::date;
    PERFORM create_monthly_partition(parent_table, partition_date);
  END LOOP;

  RAISE NOTICE 'Created % partitions for %', months_ahead + 1, parent_table;
END;
$$;

-- ==========================================
-- NOTIFICATION PARTITIONING STRATEGY
-- ==========================================
-- NOTE: This is for reference. Actual implementation requires:
-- 1. Rename current "Notification" table to "Notification_old"
-- 2. Create new partitioned "Notification" table
-- 3. Migrate data from old to new
-- 4. Update application code if needed
-- 5. Drop old table after verification

/*
-- Step 1: Create partitioned Notification table (EXAMPLE - DO NOT RUN YET)

CREATE TABLE "Notification_partitioned" (
  id TEXT NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN NOT NULL DEFAULT false,
  actionUrl TEXT,
  relatedUserId TEXT,
  relatedMatchId TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id, createdAt),  -- createdAt must be in primary key for partitioning
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (relatedUserId) REFERENCES "User"(id) ON DELETE SET NULL,
  FOREIGN KEY (relatedMatchId) REFERENCES "Match"(id) ON DELETE SET NULL
) PARTITION BY RANGE (createdAt);

-- Enable RLS on partitioned table
ALTER TABLE "Notification_partitioned" ENABLE ROW LEVEL SECURITY;

-- Copy all RLS policies from original table
CREATE POLICY "Users can view own notifications"
  ON "Notification_partitioned" FOR SELECT
  USING (userId = (select auth.uid())::text);

CREATE POLICY "Users can update own notifications"
  ON "Notification_partitioned" FOR UPDATE
  USING (userId = (select auth.uid())::text);

CREATE POLICY "Users can delete own notifications"
  ON "Notification_partitioned" FOR DELETE
  USING (userId = (select auth.uid())::text);

-- Create indexes on partitioned table
CREATE INDEX idx_notification_part_user_created
  ON "Notification_partitioned" (userId, createdAt DESC);

CREATE INDEX idx_notification_part_unread
  ON "Notification_partitioned" (userId, createdAt DESC)
  WHERE isRead = false;

-- Create partitions for current month and next 11 months
SELECT create_future_partitions('Notification_partitioned', 11);

-- Step 2: Migrate data (example command, requires testing)
-- INSERT INTO "Notification_partitioned" SELECT * FROM "Notification";

-- Step 3: After verification, swap tables
-- ALTER TABLE "Notification" RENAME TO "Notification_old";
-- ALTER TABLE "Notification_partitioned" RENAME TO "Notification";

-- Step 4: Clean up old table (after verification)
-- DROP TABLE "Notification_old";
*/

-- ==========================================
-- MESSAGE PARTITIONING STRATEGY
-- ==========================================

/*
-- Similar approach for Message table

CREATE TABLE "Message_partitioned" (
  id TEXT NOT NULL,
  matchId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  receiverId TEXT NOT NULL,
  content TEXT NOT NULL,
  isRead BOOLEAN NOT NULL DEFAULT false,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id, createdAt),  -- createdAt must be in primary key
  FOREIGN KEY (matchId) REFERENCES "Match"(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (receiverId) REFERENCES "User"(id) ON DELETE CASCADE
) PARTITION BY RANGE (createdAt);

-- Enable RLS
ALTER TABLE "Message_partitioned" ENABLE ROW LEVEL SECURITY;

-- Copy RLS policies
CREATE POLICY "Users can view their messages"
  ON "Message_partitioned" FOR SELECT
  USING (
    senderId = (select auth.uid())::text
    OR receiverId = (select auth.uid())::text
  );

CREATE POLICY "Users can send messages"
  ON "Message_partitioned" FOR INSERT
  WITH CHECK (senderId = (select auth.uid())::text);

CREATE POLICY "Users can update their received messages"
  ON "Message_partitioned" FOR UPDATE
  USING (receiverId = (select auth.uid())::text);

-- Create indexes
CREATE INDEX idx_message_part_match_created
  ON "Message_partitioned" (matchId, createdAt DESC);

CREATE INDEX idx_message_part_unread_receiver
  ON "Message_partitioned" (receiverId, matchId, createdAt DESC)
  WHERE isRead = false;

-- Create partitions
SELECT create_future_partitions('Message_partitioned', 11);
*/

-- ==========================================
-- PARTITION MAINTENANCE FUNCTIONS
-- ==========================================

-- Function to drop old partitions (for data retention policy)
CREATE OR REPLACE FUNCTION drop_old_partitions(
  parent_table text,
  retention_months int DEFAULT 12
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partition_record RECORD;
  cutoff_date date;
BEGIN
  cutoff_date := (CURRENT_DATE - (retention_months || ' months')::interval)::date;

  FOR partition_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE parent_table || '_%'
    AND tablename <= parent_table || '_' || to_char(cutoff_date, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
  END LOOP;
END;
$$;

-- ==========================================
-- AUTOMATIC PARTITION CREATION TRIGGER
-- ==========================================
-- This can be scheduled via pg_cron to run monthly

/*
-- Example pg_cron job to create next month's partition

SELECT cron.schedule(
  'create-next-month-partitions',
  '0 0 1 * *',  -- Run at midnight on the 1st of each month
  $$
    SELECT create_monthly_partition('Notification_partitioned', CURRENT_DATE + interval '1 month');
    SELECT create_monthly_partition('Message_partitioned', CURRENT_DATE + interval '1 month');
  $$
);

-- Example pg_cron job to drop partitions older than 12 months

SELECT cron.schedule(
  'cleanup-old-partitions',
  '0 2 1 * *',  -- Run at 2am on the 1st of each month
  $$
    SELECT drop_old_partitions('Notification_partitioned', 12);
    SELECT drop_old_partitions('Message_partitioned', 12);
  $$
);
*/

-- ==========================================
-- MONITORING QUERY: Check partition sizes
-- ==========================================

CREATE OR REPLACE FUNCTION get_partition_sizes(parent_table text)
RETURNS TABLE (
  partition_name text,
  rows_estimate bigint,
  size_bytes bigint,
  size_pretty text,
  start_date text,
  end_date text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text as partition_name,
    c.reltuples::bigint as rows_estimate,
    pg_total_relation_size(c.oid)::bigint as size_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) as size_pretty,
    pg_get_expr(c.relpartbound, c.oid, true) as partition_range,
    ''::text as end_date  -- Placeholder
  FROM pg_class c
  JOIN pg_inherits i ON c.oid = i.inhrelid
  JOIN pg_class p ON p.oid = i.inhparent
  WHERE p.relname = parent_table
  ORDER BY c.relname;
END;
$$;

-- ==========================================
-- VALIDATION
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Table partitioning helper functions created!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - create_monthly_partition(table_name, date)';
  RAISE NOTICE '  - create_future_partitions(table_name, months)';
  RAISE NOTICE '  - drop_old_partitions(table_name, retention_months)';
  RAISE NOTICE '  - get_partition_sizes(table_name)';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Actual table partitioning requires careful migration';
  RAISE NOTICE 'Review the commented SQL in this file before implementing';
  RAISE NOTICE 'Test thoroughly in development before production rollout';
  RAISE NOTICE '';
  RAISE NOTICE 'Recommended tables for partitioning at scale:';
  RAISE NOTICE '  1. Notification (highest priority - 45K+ queries in testing)';
  RAISE NOTICE '  2. Message (high volume, time-based queries)';
  RAISE NOTICE '  3. SessionNote (grows with session usage)';
  RAISE NOTICE '';
  RAISE NOTICE 'All partitions will inherit RLS policies automatically';
  RAISE NOTICE '==============================================';
END $$;
