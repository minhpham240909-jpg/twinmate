/**
 * Chat Group Search API
 *
 * Searches ONLY within the user's existing groups and their message conversations.
 * This is different from /api/groups/search which finds ALL groups.
 *
 * Used by: Group Chat search bar
 * Scope: Only groups the user is a member of
 *
 * PERFORMANCE: Single optimized query, no N+1 issues
 * SECURITY: Only returns groups the user is a member of
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchQuery } = await request.json()

    if (!searchQuery || searchQuery.trim().length < 2) {
      return NextResponse.json({ groups: [] })
    }

    const query = searchQuery.trim().toLowerCase()

    // PERFORMANCE: Get user's group IDs first (needed for both searches)
    const userGroupIds = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true }
    }).then(members => members.map(m => m.groupId))

    // PERFORMANCE: Run both searches in parallel
    const [userGroups, messagesMatching] = await Promise.all([
      // Search 1: Groups matching by name/description/subject
      prisma.group.findMany({
        where: {
          id: { in: userGroupIds },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { subject: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          subject: true,
          avatarUrl: true,
          _count: {
            select: {
              members: true
            }
          }
        },
        take: 10
      }),
      // Search 2: Groups with matching messages
      userGroupIds.length > 0
        ? prisma.message.findMany({
            where: {
              content: {
                contains: query,
                mode: 'insensitive'
              },
              groupId: { in: userGroupIds }
            },
            select: {
              groupId: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  subject: true,
                  avatarUrl: true,
                  _count: {
                    select: {
                      members: true
                    }
                  }
                }
              }
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
          })
        : Promise.resolve([])
    ])

    let additionalGroups: typeof userGroups = []

    if (messagesMatching.length > 0) {

      // Extract unique groups from messages that aren't already in userGroups
      const existingIds = new Set(userGroups.map(g => g.id))
      const seenIds = new Set<string>()

      messagesMatching.forEach(msg => {
        if (msg.group && !existingIds.has(msg.group.id) && !seenIds.has(msg.group.id)) {
          seenIds.add(msg.group.id)
          additionalGroups.push(msg.group)
        }
      })
    }

    // Combine and format results
    const allGroups = [...userGroups, ...additionalGroups].slice(0, 10)

    return NextResponse.json({
      groups: allGroups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        subject: g.subject,
        avatarUrl: g.avatarUrl,
        memberCount: g._count.members
      }))
    })
  } catch (error) {
    console.error('Chat group search error:', error)
    return NextResponse.json(
      { error: 'Failed to search groups' },
      { status: 500 }
    )
  }
}
