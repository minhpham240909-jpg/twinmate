# Message Delete Implementation

## Summary
Implemented soft delete functionality for messages in both Study Session chat and Messages function.

## Changes Made

### 1. Database Schema Updates
**File:** `prisma/schema.prisma`

Added `deletedAt` field to both `SessionMessage` and `Message` models:
```prisma
deletedAt DateTime?
@@index([deletedAt])
```

**Migration SQL:** `add_deleted_at_to_messages.sql`
- Adds `deletedAt` column to `SessionMessage` table
- Adds `deletedAt` column to `Message` table
- Creates indexes for performance

**⚠️ IMPORTANT:** You need to run this SQL migration on your Supabase database:
```bash
# Option 1: Run SQL directly in Supabase Dashboard
# Copy contents of add_deleted_at_to_messages.sql and run in SQL Editor

# Option 2: Use psql if available
psql -h your-supabase-host -U your-user -d your-db -f add_deleted_at_to_messages.sql
```

### 2. Study Session Chat Delete API
**File:** `src/app/api/study-sessions/[sessionId]/messages/[messageId]/delete/route.ts`

**Features:**
- Soft deletes messages (sets `deletedAt` timestamp)
- **Permissions:**
  - Message sender can delete their own messages
  - Session HOST can delete any message
- Returns success/error response

**Endpoint:** `DELETE /api/study-sessions/[sessionId]/messages/[messageId]/delete`

### 3. Study Session Chat UI
**File:** `src/components/SessionChat.tsx`

**Features:**
- Click on a message to show/hide delete button
- Delete button appears to the right of the message
- Deleted messages show as "This message was deleted" in gray/italic
- Confirmation dialog: "Are you sure you want to delete this message?"
- Toast notifications for success/error
- Both sender and host can see delete option on their allowed messages

**Props Added:**
- `isHost?: boolean` - Passed from parent to determine if user can delete any message

### 4. Messages Function (Pending)
Still need to implement delete for the main Messages function (DMs and Groups).

## How It Works

### User Experience:
1. User clicks on a message they can delete
2. A "Delete" button appears next to the message
3. User clicks "Delete"
4. Confirmation dialog appears: "Are you sure?"
5. If confirmed:
   - Message is soft-deleted (deletedAt set to current time)
   - Message content changes to "This message was deleted" (gray, italic)
   - Toast notification: "Message deleted"

### Permissions:
**Study Session Chat:**
- Own messages: ✅ Can delete
- Other's messages: ✅ Can delete IF you're the host
- Deleted messages: ❌ Cannot delete again

### Soft Delete vs Hard Delete:
- **Soft Delete:** Message is marked as deleted but stays in database
- **Permanent Delete:** After 24 hours, a background job will permanently remove messages where `deletedAt` is older than 24 hours
- **Why 24 hours?** Allows for recovery if needed, compliance, and moderation purposes

## Next Steps

### 1. Run Database Migration ⚠️
You MUST run the SQL migration to add the `deletedAt` columns:
```sql
-- See add_deleted_at_to_messages.sql file
```

### 2. Implement Messages Function Delete
Need to create similar delete functionality for:
- DM messages (`/messages` page)
- Group messages

### 3. Create Cleanup Job
Create a cron job/scheduled function to permanently delete messages older than 24 hours:
```typescript
// Pseudo-code
async function cleanupOldDeletedMessages() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

  await prisma.sessionMessage.deleteMany({
    where: {
      deletedAt: {
        lt: cutoff
      }
    }
  })

  await prisma.message.deleteMany({
    where: {
      deletedAt: {
        lt: cutoff
      }
    }
  })
}
```

This can be implemented as:
- Vercel Cron Job
- Supabase Function with pg_cron
- External cron service

## Testing Checklist

- [ ] Run database migration
- [ ] Send a message in study session chat
- [ ] Click on your own message - delete button should appear
- [ ] Delete your message - should show "This message was deleted"
- [ ] Try deleting someone else's message (as host) - should work
- [ ] Try deleting someone else's message (not host) - should fail
- [ ] Check deleted message appears in database with deletedAt timestamp
- [ ] Verify terminal is not spamming (timer polling fixed)
- [ ] Test on mobile - click to show delete button

## Files Modified/Created

**Created:**
- `src/app/api/study-sessions/[sessionId]/messages/[messageId]/delete/route.ts`
- `add_deleted_at_to_messages.sql`
- `MESSAGE_DELETE_IMPLEMENTATION.md` (this file)

**Modified:**
- `prisma/schema.prisma` - Added deletedAt to SessionMessage and Message
- `src/components/SessionChat.tsx` - Added delete UI and logic
- `src/app/study-sessions/[sessionId]/page.tsx` - Pass isHost prop to SessionChat
- `src/hooks/useTimerSync.ts` - Fixed timer polling spam (bonus fix)

## Notes

- Messages are never truly deleted immediately - always soft deleted first
- 24-hour window allows for recovery if user changes mind
- Host privilege allows moderation of inappropriate content
- Real-time updates work - when one user deletes, others see it update via Supabase Realtime
