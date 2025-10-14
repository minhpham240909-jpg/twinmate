# Supabase Storage Setup for Avatar Uploads

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard: https://zuukijevgtcfsgylbsqj.supabase.co
2. Click on **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Enter bucket name: `user-uploads`
5. Make it **Public** (check the "Public bucket" checkbox)
6. Click **Create bucket**

## Step 2: Set Storage Policies (Run in SQL Editor)

Go to **SQL Editor** in your Supabase dashboard and run this SQL:

```sql
-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow everyone to view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);
```

## Step 3: Verify Setup

After running the SQL:

1. Go back to **Storage** → **user-uploads** bucket
2. You should see **Policies** tab with 4 policies created
3. Try uploading an image in the profile page to test

## Folder Structure

Images will be stored as:
```
user-uploads/
  avatars/
    {userId}-{timestamp}.{ext}
```

Example: `user-uploads/avatars/5a67fad1-9a1a-4370-8685-4bbdf1fc67aa-1234567890.jpg`

## Security

- ✅ Users can only upload/update/delete their own avatars
- ✅ Avatars are publicly readable (so they display on profiles)
- ✅ File size limited to 5MB (enforced in API)
- ✅ Only image files allowed (enforced in API)
