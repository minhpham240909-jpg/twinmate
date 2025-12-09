-- Add WHITEBOARD value to AIMessageType enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = '"AIMessageType"'::regtype 
        AND enumlabel = 'WHITEBOARD'
    ) THEN
        ALTER TYPE "AIMessageType" ADD VALUE 'WHITEBOARD';
    END IF;
END $$;
