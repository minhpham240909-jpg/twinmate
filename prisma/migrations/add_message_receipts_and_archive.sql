-- Migration: Add message read receipts, archive, and file attachment features
-- Date: 2025-10-05

-- 1. Add deliveredAt field to Message table for delivery receipts
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- 2. Add isArchived field to Message table for archiving conversations
-- Note: This tracks archived state per user, so we'll handle it differently
-- We'll create a new table for per-user conversation archives

CREATE TABLE IF NOT EXISTS "ConversationArchive" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "conversationType" TEXT NOT NULL, -- 'partner' or 'group'
  "conversationId" TEXT NOT NULL, -- partner userId or groupId
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationArchive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationArchive_unique" UNIQUE ("userId", "conversationType", "conversationId")
);

-- Create indexes for ConversationArchive
CREATE INDEX IF NOT EXISTS "ConversationArchive_userId_idx" ON "ConversationArchive"("userId");
CREATE INDEX IF NOT EXISTS "ConversationArchive_conversationId_idx" ON "ConversationArchive"("conversationId");

-- 3. Create Supabase Storage buckets for file uploads
-- Note: These are run via Supabase SQL editor or API

-- Bucket for group avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-avatars',
  'group-avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket for message attachments (images and PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false, -- private bucket, requires auth
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for group-avatars bucket (public read, owner-controlled upload/update/delete)
-- NOTE: Object metadata must include 'owner' field set to the user ID who uploaded it
CREATE POLICY "Public read access for group avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-avatars');

CREATE POLICY "Authenticated users can upload group avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text  -- Enforce user folder structure
);

CREATE POLICY "Users can update their own group avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'group-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text  -- Only update own folder
)
WITH CHECK (
  bucket_id = 'group-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own group avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text  -- Only delete own uploads
);

-- 5. Storage policies for message-attachments bucket (private, only accessible by conversation participants)
-- IMPORTANT: Object path must follow convention: {conversationId}/{messageId}/{filename}
-- or metadata must include 'conversationId' field

-- Helper function to extract conversationId from object path
CREATE OR REPLACE FUNCTION get_conversation_id_from_path(object_path text)
RETURNS text AS $$
BEGIN
  -- Assuming path format: conversationId/messageId/filename
  RETURN split_part(object_path, '/', 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if user is participant of a conversation
CREATE OR REPLACE FUNCTION is_conversation_participant(user_id uuid, conv_id text)
RETURNS boolean AS $$
BEGIN
  -- Check if user is in a direct conversation (as sender or recipient)
  IF EXISTS (
    SELECT 1 FROM "Conversation" c
    INNER JOIN "Message" m ON m."conversationId" = c.id
    WHERE c.id = conv_id
    AND (m."senderId" = user_id::text OR m."recipientId" = user_id::text)
    LIMIT 1
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is a member of the group conversation
  IF EXISTS (
    SELECT 1 FROM "Conversation" c
    INNER JOIN "GroupMember" gm ON gm."groupId" = c."groupId"
    WHERE c.id = conv_id
    AND gm."userId" = user_id::text
    LIMIT 1
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Read policy: Only conversation participants can read attachments
CREATE POLICY "Conversation participants can read message attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND auth.role() = 'authenticated'
  AND is_conversation_participant(auth.uid(), get_conversation_id_from_path(name))
);

-- Insert policy: Only authenticated users uploading to their own conversations
CREATE POLICY "Users can upload attachments to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments'
  AND auth.role() = 'authenticated'
  AND is_conversation_participant(auth.uid(), get_conversation_id_from_path(name))
);

-- Delete policy: Only the uploader or conversation participants can delete
CREATE POLICY "Conversation participants can delete message attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-attachments'
  AND auth.role() = 'authenticated'
  AND is_conversation_participant(auth.uid(), get_conversation_id_from_path(name))
);

-- 6. Add index on deliveredAt for performance
CREATE INDEX IF NOT EXISTS "Message_deliveredAt_idx" ON "Message"("deliveredAt");

-- 7. Update existing messages to set deliveredAt = createdAt (backward compatibility)
UPDATE "Message"
SET "deliveredAt" = "createdAt"
WHERE "deliveredAt" IS NULL;

-- Note: Run Prisma schema update to reflect these changes
-- prisma db pull (to sync schema)
-- prisma generate (to regenerate client)
