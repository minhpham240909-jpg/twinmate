/**
 * Embedding Backfill Script
 *
 * Run this script to generate embeddings for all existing profiles and groups.
 * Usage: npx tsx scripts/backfill-embeddings.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const BATCH_SIZE = 20
const EMBEDDING_MODEL = 'text-embedding-3-small'

// ============================================
// Helper Functions
// ============================================

function buildProfileSearchText(profile: {
  bio: string | null
  subjects: string[] | null
  interests: string[] | null
  goals: string[] | null
  skillLevel: string | null
  studyStyle: string | null
  subjectCustomDescription: string | null
  skillLevelCustomDescription: string | null
  studyStyleCustomDescription: string | null
  interestsCustomDescription: string | null
  aboutYourself: string | null
  school: string | null
  languages: string | null
  location_city: string | null
  location_state: string | null
  location_country: string | null
}): string {
  const parts: string[] = []

  if (profile.bio) parts.push(profile.bio)
  if (profile.aboutYourself) parts.push(profile.aboutYourself)
  if (profile.school) parts.push(`School: ${profile.school}`)
  if (profile.subjects?.length) parts.push(`Subjects: ${profile.subjects.join(', ')}`)
  if (profile.interests?.length) parts.push(`Interests: ${profile.interests.join(', ')}`)
  if (profile.goals?.length) parts.push(`Goals: ${profile.goals.join(', ')}`)
  if (profile.skillLevel) parts.push(`Skill Level: ${profile.skillLevel}`)
  if (profile.studyStyle) parts.push(`Study Style: ${profile.studyStyle}`)
  if (profile.subjectCustomDescription) parts.push(profile.subjectCustomDescription)
  if (profile.skillLevelCustomDescription) parts.push(profile.skillLevelCustomDescription)
  if (profile.studyStyleCustomDescription) parts.push(profile.studyStyleCustomDescription)
  if (profile.interestsCustomDescription) parts.push(profile.interestsCustomDescription)
  if (profile.languages) parts.push(`Languages: ${profile.languages}`)
  if (profile.location_city) parts.push(`Location: ${profile.location_city}`)
  if (profile.location_state) parts.push(profile.location_state)
  if (profile.location_country) parts.push(profile.location_country)

  return parts.join(' | ')
}

function buildGroupSearchText(group: {
  name: string
  description: string | null
  subject: string | null
  subjectCustomDescription: string | null
  skillLevel: string | null
  skillLevelCustomDescription: string | null
}): string {
  const parts: string[] = []

  parts.push(group.name)
  if (group.description) parts.push(group.description)
  if (group.subject) parts.push(`Subject: ${group.subject}`)
  if (group.subjectCustomDescription) parts.push(group.subjectCustomDescription)
  if (group.skillLevel) parts.push(`Skill Level: ${group.skillLevel}`)
  if (group.skillLevelCustomDescription) parts.push(group.skillLevelCustomDescription)

  return parts.join(' | ')
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

// ============================================
// Backfill Profiles
// ============================================

async function backfillProfiles() {
  console.log('\n📋 Starting profile embedding backfill...')

  // Get profiles without embeddings
  const profiles = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Profile"
    WHERE embedding IS NULL
    AND (
      bio IS NOT NULL OR
      school IS NOT NULL OR
      subjects IS NOT NULL OR
      interests IS NOT NULL OR
      "aboutYourself" IS NOT NULL
    )
  `

  console.log(`Found ${profiles.length} profiles without embeddings`)

  if (profiles.length === 0) {
    console.log('✅ All profiles already have embeddings!')
    return { processed: 0, success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  // Process in batches
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE)
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(profiles.length / BATCH_SIZE)}...`)

    for (const { id } of batch) {
      try {
        // Fetch full profile data
        const profile = await prisma.profile.findUnique({
          where: { id },
          select: {
            bio: true,
            subjects: true,
            interests: true,
            goals: true,
            skillLevel: true,
            studyStyle: true,
            subjectCustomDescription: true,
            skillLevelCustomDescription: true,
            studyStyleCustomDescription: true,
            interestsCustomDescription: true,
            aboutYourself: true,
            school: true,
            languages: true,
            location_city: true,
            location_state: true,
            location_country: true,
          }
        })

        if (!profile) {
          failed++
          continue
        }

        // Build search text
        const searchText = buildProfileSearchText({
          ...profile,
          skillLevel: profile.skillLevel?.toString() || null,
          studyStyle: profile.studyStyle?.toString() || null,
        })

        if (!searchText || searchText.length < 10) {
          console.log(`  Skipping profile ${id} - insufficient data`)
          continue
        }

        // Generate embedding
        const embedding = await generateEmbedding(searchText)
        if (!embedding) {
          failed++
          continue
        }

        // Update profile with embedding
        const embeddingStr = `[${embedding.join(',')}]`
        await prisma.$executeRaw`
          UPDATE "Profile"
          SET embedding = ${embeddingStr}::vector
          WHERE id = ${id}::uuid
        `

        success++
        process.stdout.write('.')
      } catch (error) {
        console.error(`\n  Error processing profile ${id}:`, error)
        failed++
      }
    }

    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n\n✅ Profile backfill complete: ${success} success, ${failed} failed`)
  return { processed: profiles.length, success, failed }
}

// ============================================
// Backfill Groups
// ============================================

async function backfillGroups() {
  console.log('\n📋 Starting group embedding backfill...')

  // Get groups without embeddings
  const groups = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Group"
    WHERE embedding IS NULL
    AND "isDeleted" = false
    AND (
      name IS NOT NULL OR
      description IS NOT NULL OR
      subject IS NOT NULL
    )
  `

  console.log(`Found ${groups.length} groups without embeddings`)

  if (groups.length === 0) {
    console.log('✅ All groups already have embeddings!')
    return { processed: 0, success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  // Process in batches
  for (let i = 0; i < groups.length; i += BATCH_SIZE) {
    const batch = groups.slice(i, i + BATCH_SIZE)
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(groups.length / BATCH_SIZE)}...`)

    for (const { id } of batch) {
      try {
        // Fetch full group data
        const group = await prisma.group.findUnique({
          where: { id },
          select: {
            name: true,
            description: true,
            subject: true,
            subjectCustomDescription: true,
            skillLevel: true,
            skillLevelCustomDescription: true,
          }
        })

        if (!group) {
          failed++
          continue
        }

        // Build search text
        const searchText = buildGroupSearchText(group)

        if (!searchText || searchText.length < 5) {
          console.log(`  Skipping group ${id} - insufficient data`)
          continue
        }

        // Generate embedding
        const embedding = await generateEmbedding(searchText)
        if (!embedding) {
          failed++
          continue
        }

        // Update group with embedding
        const embeddingStr = `[${embedding.join(',')}]`
        await prisma.$executeRaw`
          UPDATE "Group"
          SET embedding = ${embeddingStr}::vector
          WHERE id = ${id}::uuid
        `

        success++
        process.stdout.write('.')
      } catch (error) {
        console.error(`\n  Error processing group ${id}:`, error)
        failed++
      }
    }

    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < groups.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n\n✅ Group backfill complete: ${success} success, ${failed} failed`)
  return { processed: groups.length, success, failed }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('🚀 Starting Embedding Backfill')
  console.log('================================')

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set!')
    process.exit(1)
  }

  console.log('✅ OpenAI API key found')

  try {
    // Backfill profiles
    const profileResults = await backfillProfiles()

    // Backfill groups
    const groupResults = await backfillGroups()

    console.log('\n================================')
    console.log('📊 Final Results:')
    console.log(`   Profiles: ${profileResults.success}/${profileResults.processed} successful`)
    console.log(`   Groups: ${groupResults.success}/${groupResults.processed} successful`)
    console.log('================================\n')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
