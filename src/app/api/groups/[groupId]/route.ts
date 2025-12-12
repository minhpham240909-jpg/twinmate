import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// H9 FIX: Permission cache with 30-second TTL
interface CachedPermission {
  isMember: boolean
  isOwner: boolean
  role: string | null
  timestamp: number
}

const permissionCache = new Map<string, CachedPermission>()
const PERMISSION_CACHE_TTL_MS = 30000 // 30 seconds

/**
 * H9 FIX: Get cached permission or fetch from database
 */
async function getGroupPermission(
  groupId: string,
  userId: string,
  ownerId: string,
  members: Array<{ userId: string; role: string }>
): Promise<CachedPermission> {
  const cacheKey = `${groupId}:${userId}`
  const cached = permissionCache.get(cacheKey)
  
  // Check if cached and not expired
  if (cached && Date.now() - cached.timestamp < PERMISSION_CACHE_TTL_MS) {
    return cached
  }
  
  // Calculate permission
  const membership = members.find(m => m.userId === userId)
  const permission: CachedPermission = {
    isMember: !!membership,
    isOwner: ownerId === userId,
    role: membership?.role || null,
    timestamp: Date.now(),
  }
  
  // Store in cache
  permissionCache.set(cacheKey, permission)
  
  // Cleanup old entries (simple LRU-like cleanup)
  if (permissionCache.size > 1000) {
    const now = Date.now()
    for (const [key, value] of permissionCache.entries()) {
      if (now - value.timestamp > PERMISSION_CACHE_TTL_MS) {
        permissionCache.delete(key)
      }
    }
  }
  
  return permission
}

/**
 * H9 FIX: Invalidate cached permission for a user/group
 */
function invalidateGroupPermission(groupId: string, userId?: string): void {
  if (userId) {
    permissionCache.delete(`${groupId}:${userId}`)
  } else {
    // Invalidate all permissions for this group
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${groupId}:`)) {
        permissionCache.delete(key)
      }
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch group with members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                presence: {
                  select: {
                    status: true
                  }
                }
              }
            }
          },
          orderBy: [
            { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
            { joinedAt: 'asc' }
          ]
        }
      }
    })

    if (!group || group.isDeleted) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Fetch owner info
    const owner = await prisma.user.findUnique({
      where: { id: group.ownerId },
      select: {
        id: true,
        name: true,
        avatarUrl: true
      }
    })

    // H9 FIX: Check permissions with caching
    const permission = await getGroupPermission(
      groupId,
      user.id,
      group.ownerId,
      group.members.map(m => ({ userId: m.userId, role: m.role }))
    )
    const { isMember, isOwner } = permission

    // Get current user's membership (for role)
    const membership = group.members.find(m => m.userId === user.id)

    // Format members list
    const membersList = group.members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      onlineStatus: m.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
      joinedAt: m.joinedAt
    }))

    // Return group data
    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        subject: group.subject,
        subjectCustomDescription: group.subjectCustomDescription,
        skillLevel: group.skillLevel,
        skillLevelCustomDescription: group.skillLevelCustomDescription,
        maxMembers: group.maxMembers,
        memberCount: group.members.length,
        avatarUrl: group.avatarUrl,
        owner: {
          id: owner?.id || group.ownerId,
          name: owner?.name || 'Unknown',
          avatarUrl: owner?.avatarUrl || null
        },
        members: membersList,
        isMember,
        isOwner,
        userRole: permission.role,
        createdAt: group.createdAt
      }
    })
  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group details' },
      { status: 500 }
    )
  }
}
