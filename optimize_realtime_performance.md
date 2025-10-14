# Realtime Performance Optimization Guide

## Problem
`realtime.list_changes()` is consuming 95.7% of database query time (2,516 seconds total).

## Solutions

### 1. Audit Your Realtime Publications

Check which tables are published to realtime:

```sql
-- Run this in Supabase SQL Editor to see all tables in realtime
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;
```

### 2. Remove Unnecessary Tables from Realtime

Only keep tables that NEED real-time updates (e.g., messages, session state).
Remove tables that don't need instant updates:

```sql
-- Example: Remove tables that don't need realtime
ALTER PUBLICATION supabase_realtime DROP TABLE "YourTableName";
```

**Recommended tables to keep in realtime:**
- `Message` (chat needs instant updates)
- `SessionMessage` (study session chat)
- `SessionTimer` (timer state)
- `SessionParticipant` (who's in session)
- `Notification` (instant notifications)

**Consider removing from realtime:**
- `User` (profile changes don't need instant sync)
- `Group` (group metadata changes are infrequent)
- `GroupMember` (membership changes can be polled)
- Any audit/log tables

### 3. Add Filters to Realtime Subscriptions

In your client code, use filters to reduce data volume:

```typescript
// BAD - subscribes to ALL changes
const channel = supabase
  .channel('messages')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'Message' },
    (payload) => console.log(payload)
  )

// GOOD - only subscribe to relevant data
const channel = supabase
  .channel('my-messages')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'Message',
      filter: `groupId=eq.${currentGroupId}` // Only messages for current group
    },
    (payload) => console.log(payload)
  )
```

### 4. Use Presence Instead of Database Polling

For "who's online" features, use Supabase Realtime Presence instead of database updates:

```typescript
// Instead of updating a database field every few seconds
// Use Realtime Presence
const channel = supabase.channel('room-1')
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    console.log('Online users:', state)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: userId, online_at: new Date() })
    }
  })
```

### 5. Implement Debouncing/Throttling

If you're doing frequent updates, implement debouncing:

```typescript
// BAD - updates on every keystroke
const handleChange = (text) => {
  supabase.from('drafts').update({ content: text }).eq('id', draftId)
}

// GOOD - debounce updates
import { debounce } from 'lodash'

const updateDraft = debounce(async (text) => {
  await supabase.from('drafts').update({ content: text }).eq('id', draftId)
}, 1000) // Wait 1 second after user stops typing

const handleChange = (text) => {
  updateDraft(text)
}
```

### 6. Monitor Active Connections

```sql
-- Check active realtime connections
SELECT
  COUNT(*) as connection_count,
  state
FROM pg_stat_activity
WHERE usename = 'supabase_admin'
GROUP BY state;
```

### 7. Consider Polling for Less Critical Data

For data that doesn't need instant updates, use polling instead:

```typescript
// Instead of realtime subscription for groups list
// Use periodic polling
useEffect(() => {
  const fetchGroups = async () => {
    const { data } = await supabase.from('Group').select('*')
    setGroups(data)
  }

  fetchGroups() // Initial fetch
  const interval = setInterval(fetchGroups, 30000) // Poll every 30s

  return () => clearInterval(interval)
}, [])
```

## Expected Impact

After optimization, you should see:
- 80-90% reduction in `realtime.list_changes()` calls
- Faster overall database response times
- Lower database CPU usage
- Better scalability for more users
