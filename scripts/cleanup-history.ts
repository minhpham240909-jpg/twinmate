#!/usr/bin/env tsx
/**
 * Manual cleanup script for permanently deleting items older than 30 days
 * 
 * Usage:
 *   npm run cleanup:history
 *   or
 *   tsx scripts/cleanup-history.ts
 * 
 * Environment variables required:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for storage operations)
 *   - CLEANUP_API_KEY: Optional API key for authentication
 */

/// <reference types="node" />

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupHistory() {
  console.log('🧹 Starting history cleanup...')
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`)
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  console.log(`📅 Cleaning up items deleted before: ${thirtyDaysAgo.toISOString()}`)

  let deletedCount = {
    messages: 0,
    groups: 0,
    posts: 0,
  }

  try {
    // Cleanup expired messages
    console.log('\n📨 Cleaning up expired messages...')
    const expiredMessages = await prisma.message.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
      select: {
        id: true,
        fileUrl: true,
      },
    })

    console.log(`   Found ${expiredMessages.length} expired messages`)

    // Delete files from storage
    for (const message of expiredMessages) {
      if (message.fileUrl) {
        try {
          const urlParts = message.fileUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('messages').remove([fileName])
          }
        } catch (error) {
          console.error(`   ⚠️  Error deleting message file: ${error}`)
        }
      }
    }

    deletedCount.messages = await prisma.message.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
    }).then(result => result.count)

    console.log(`   ✅ Deleted ${deletedCount.messages} messages`)

    // Cleanup expired groups
    console.log('\n👥 Cleaning up expired groups...')
    const expiredGroups = await prisma.group.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
      select: {
        id: true,
        avatarUrl: true,
      },
    })

    console.log(`   Found ${expiredGroups.length} expired groups`)

    // Delete avatars from storage
    for (const group of expiredGroups) {
      if (group.avatarUrl) {
        try {
          const urlParts = group.avatarUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('groups').remove([fileName])
          }
        } catch (error) {
          console.error(`   ⚠️  Error deleting group avatar: ${error}`)
        }
      }
    }

    deletedCount.groups = await prisma.group.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
    }).then(result => result.count)

    console.log(`   ✅ Deleted ${deletedCount.groups} groups`)

    // Cleanup expired posts
    console.log('\n📝 Cleaning up expired posts...')
    const expiredPosts = await prisma.post.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        imageUrls: true,
      },
    })

    console.log(`   Found ${expiredPosts.length} expired posts`)

    // Delete images from storage
    for (const post of expiredPosts) {
      if (post.imageUrls && post.imageUrls.length > 0) {
        for (const imageUrl of post.imageUrls) {
          try {
            const urlParts = imageUrl.split('/post-images/')
            if (urlParts.length === 2) {
              const filePath = urlParts[1]
              await supabase.storage.from('post-images').remove([filePath])
            }
          } catch (error) {
            console.error(`   ⚠️  Error deleting post image: ${error}`)
          }
        }
      }
    }

    deletedCount.posts = await prisma.post.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    }).then(result => result.count)

    console.log(`   ✅ Deleted ${deletedCount.posts} posts`)

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('✅ Cleanup completed successfully!')
    console.log('='.repeat(50))
    console.log(`📊 Summary:`)
    console.log(`   Messages: ${deletedCount.messages}`)
    console.log(`   Groups: ${deletedCount.groups}`)
    console.log(`   Posts: ${deletedCount.posts}`)
    console.log(`   Total: ${deletedCount.messages + deletedCount.groups + deletedCount.posts}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run cleanup
cleanupHistory()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })

