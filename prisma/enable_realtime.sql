-- ====================================================================================
-- ENABLE SUPABASE REALTIME FOR STUDY SESSION TABLES
-- ====================================================================================
-- This enables Supabase real-time subscriptions for session and participant changes
-- Run this in your Supabase SQL editor
-- ====================================================================================

-- Enable real-time publication for StudySession table
-- This allows clients to subscribe to session status changes (WAITING -> ACTIVE)
ALTER PUBLICATION supabase_realtime ADD TABLE "StudySession";

-- Enable real-time publication for SessionParticipant table  
-- This allows clients to subscribe to participant join/leave events
ALTER PUBLICATION supabase_realtime ADD TABLE "SessionParticipant";

-- Enable real-time publication for SessionMessage table
-- This allows clients to subscribe to new messages
ALTER PUBLICATION supabase_realtime ADD TABLE "SessionMessage";

-- Enable real-time publication for collaboration tables
ALTER PUBLICATION supabase_realtime ADD TABLE "SessionWhiteboard";
ALTER PUBLICATION supabase_realtime ADD TABLE "SessionNote";
ALTER PUBLICATION supabase_realtime ADD TABLE "SessionFlashcard";

-- ====================================================================================
-- VERIFICATION QUERY
-- ====================================================================================
-- Run this to verify real-time is enabled:
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime'
-- ORDER BY tablename;
