# Community Feature Setup Guide

## ✅ What's Been Implemented

### Phase 1 Features (Complete):
1. ✅ Create text posts (up to 5000 characters)
2. ✅ Like/unlike posts
3. ✅ Comment on posts
4. ✅ Repost posts (simple + quote repost)
5. ✅ Real-time feed (no page refresh)
6. ✅ Search (content, #hashtags, @usernames)
7. ✅ Privacy settings (Public/Partners Only)
8. ✅ New posts notification badge
9. ✅ Community card on dashboard
10. ✅ Profile page integration:
    - View your own posts
    - See who liked each post
    - View all comments on posts
    - Privacy settings toggle

## 🚀 Setup Steps

### Step 1: Run Database Migration

**IMPORTANT: You MUST run this first!**

1. Go to https://supabase.com/dashboard
2. Select your Clerva project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `add_community_tables_with_rls.sql`
6. Click **Run**
7. ✅ Expected result: "Community tables created successfully!"

### Step 2: Test the Feature

1. Start your dev server: `npm run dev`
2. Login to your app
3. Go to Dashboard
4. Click the new **"Community"** card (below Messages)
5. Create your first post!

## 📱 How to Use Community

### Creating Posts:
- Max 5000 characters
- Supports hashtags (#math, #studytips)
- Supports mentions (@username)
- Real-time: New posts appear automatically

### Interacting with Posts:
- ❤️ **Like**: Click the heart icon
- 💬 **Comment**: Click comment icon, type, and press Enter
- 🔁 **Repost**: Click repost icon (coming: quote repost with comment)

### Search:
- **Content search**: Type any text
- **Hashtag search**: Type #hashtag
- **Username search**: Type @username
- Search updates in real-time (no refresh)

### Privacy:
- Set in Profile settings → Community Privacy Settings
- **Public**: Everyone sees your posts
- **Partners Only**: Only connected partners see your posts

## 🔄 Real-Time Features

### Automatic Updates:
- New posts show notification badge
- Click badge to refresh feed
- No page refresh needed

### Live Search:
- Results update as you type
- 500ms debounce for performance

## 📁 Files Created

### Database:
- `add_community_tables_with_rls.sql` - Migration script with RLS security (14 policies)

### API Endpoints:
- `POST /api/posts` - Create post
- `GET /api/posts` - Get feed
- `POST /api/posts/[postId]/like` - Like post
- `DELETE /api/posts/[postId]/like` - Unlike post
- `GET /api/posts/[postId]/comments` - Get comments
- `POST /api/posts/[postId]/comments` - Add comment
- `POST /api/posts/[postId]/repost` - Repost
- `DELETE /api/posts/[postId]/repost` - Remove repost
- `GET /api/posts/search` - Search posts

### Frontend:
- `src/app/community/page.tsx` - Community feed page
- Updated `src/app/dashboard/page.tsx` - Added Community card
- Updated `src/app/profile/page.tsx` - Added privacy settings and posts display

### Schema:
- Updated `prisma/schema.prisma`:
  - `Post` model
  - `PostLike` model
  - `PostComment` model
  - `PostRepost` model
  - `PostPrivacy` enum
  - Added `postPrivacy` to Profile

## 🎯 Enhanced Features (Future):
- Image uploads (schema ready, needs UI)
- Video uploads
- Polls
- Trending hashtags
- Who to follow suggestions
- Edit/delete posts

## 🐛 Troubleshooting

### "Table does not exist" error:
✅ **Solution**: Run `add_community_tables.sql` in Supabase SQL Editor

### Posts not showing:
✅ **Check**: Privacy settings - make sure you have at least some public posts or connected partners

### Search not working:
✅ **Check**: Type at least 1 character and wait 500ms for debounce

### Real-time not updating:
✅ **Check**: Make sure Supabase Realtime is enabled for the Post table
✅ **Fix**: Go to Supabase Dashboard → Database → Replication → Enable for "Post" table

## 📊 Database Tables

### Post:
- `id` - UUID
- `userId` - Author
- `content` - Post text
- `imageUrls` - Array of images (Phase 2)
- `createdAt`, `updatedAt`

### PostLike:
- `id` - UUID
- `postId` - Post being liked
- `userId` - User who liked
- `createdAt`
- **Unique**: One like per user per post

### PostComment:
- `id` - UUID
- `postId` - Post being commented on
- `userId` - Commenter
- `content` - Comment text
- `createdAt`, `updatedAt`

### PostRepost:
- `id` - UUID
- `postId` - Post being reposted
- `userId` - User who reposted
- `comment` - Optional quote comment
- `createdAt`
- **Unique**: One repost per user per post

---

**Ready to use! Just run the SQL file and start posting!** 🎉
