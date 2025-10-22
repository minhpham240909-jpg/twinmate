-- Add INCOMING_CALL to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCOMING_CALL';
