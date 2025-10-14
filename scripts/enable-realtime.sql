-- Enable Supabase Realtime for Clerva Tables
-- Run this in your Supabase SQL Editor

-- Enable Realtime for Messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE "Message";

-- Enable Realtime for Profiles (for online status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE "Profile";

-- Enable Realtime for Notifications (for instant alerts)
ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";

-- Enable Realtime for Matches (for partner requests)
ALTER PUBLICATION supabase_realtime ADD TABLE "Match";

-- Optional: Enable for GroupMembers (to see who joins/leaves groups)
ALTER PUBLICATION supabase_realtime ADD TABLE "GroupMember";

-- Verify what tables have Realtime enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;