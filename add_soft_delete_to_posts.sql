-- Add soft delete fields to Post table
ALTER TABLE "Post"
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create indexes for soft delete queries
CREATE INDEX "Post_isDeleted_idx" ON "Post"("isDeleted");
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- Success message
SELECT 'Soft delete fields added to Post table successfully!' as message;
