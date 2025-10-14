-- Add missing enum values to NotificationType if they don't exist
DO $$
BEGIN
    -- Add CONNECTION_REQUEST if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'CONNECTION_REQUEST'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_REQUEST';
    END IF;

    -- Add CONNECTION_ACCEPTED if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'CONNECTION_ACCEPTED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_ACCEPTED';
    END IF;

    -- Add CONNECTION_DECLINED if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'CONNECTION_DECLINED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_DECLINED';
    END IF;
END $$;
