# Supabase Storage Setup for Post Images

## Required: Create Storage Bucket

Before deploying the Phase 2 image upload feature, you need to create a Supabase Storage bucket.

### Steps:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your Clerva project

2. **Navigate to Storage**
   - Click "Storage" in the left sidebar
   - Click "Create a new bucket"

3. **Create Bucket**
   - Bucket name: `post-images`
   - Public bucket: ✅ **YES** (check this box)
   - Click "Create bucket"

4. **Set Storage Policies (RLS)**

   After creating the bucket, you need to add policies:

   **a) Go to Policies tab**
   - Click on the `post-images` bucket
   - Click "Policies" tab
   - Click "New Policy"

   **b) Insert Policy (Allow authenticated users to upload)**
   ```sql
   CREATE POLICY "Authenticated users can upload images"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'post-images');
   ```

   **c) Select Policy (Allow everyone to view images)**
   ```sql
   CREATE POLICY "Public images are viewable by everyone"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'post-images');
   ```

   **d) Delete Policy (Users can delete their own images)**
   ```sql
   CREATE POLICY "Users can delete their own images"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

5. **Verify Setup**
   - Try uploading an image through the Community page
   - Image should appear in posts
   - Check Storage bucket to see uploaded files

## File Structure

Images are organized by user:
```
post-images/
├── {userId}/
│   ├── {timestamp}-{random}.jpg
│   ├── {timestamp}-{random}.png
│   └── ...
```

## Size Limits

- **Per Image**: 5MB max
- **Per Post**: 4 images max
- **Supported formats**: All image types (jpg, png, gif, webp, etc.)

## Troubleshooting

### "Failed to upload images" error:
1. Check that `post-images` bucket exists
2. Verify bucket is set to **Public**
3. Confirm RLS policies are created
4. Check browser console for detailed errors

### Images not displaying:
1. Verify bucket is **Public**
2. Check that SELECT policy exists
3. Test image URL directly in browser

## Storage Costs

Supabase Free Tier includes:
- **1GB** storage
- **2GB** bandwidth per month

Upgrade if you need more:
- https://supabase.com/pricing
