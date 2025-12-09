/**
 * Admin User Details API
 * CEO Control Panel - View Complete User Profile, Activity & Behavior
 *
 * This endpoint provides comprehensive user data for admin investigation,
 * similar to Facebook/ChatGPT admin panels.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params

    // Fetch comprehensive user data
    const [
      userData,
      userPresence,
      recentMessages,
      recentPosts,
      groupMemberships,
      studySessions,
      sentMatches,
      receivedMatches,
      reportsAgainst,
      reportsFiled,
      warnings,
      ban,
      deviceSessions,
      activityStats,
      aiPartnerSessions,
      aiPartnerStats,
      aiPartnerFlaggedMessages,
    ] = await Promise.all([
      // 1. Core user data with profile
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          coverPhotoUrl: true,
          role: true,
          emailVerified: true,
          googleId: true,
          stripeCustomerId: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          deactivatedAt: true,
          deactivationReason: true,
          twoFactorEnabled: true,
          isAdmin: true,
          adminGrantedAt: true,
          adminGrantedBy: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          profile: {
            select: {
              bio: true,
              age: true,
              role: true,
              timezone: true,
              location_city: true,
              location_state: true,
              location_country: true,
              location_visibility: true,
              subjects: true,
              interests: true,
              goals: true,
              skillLevel: true,
              studyStyle: true,
              school: true,
              languages: true,
              availableDays: true,
              availableHours: true,
              aboutYourself: true,
              aboutYourselfItems: true,
              isLookingForPartner: true,
              studyStreak: true,
              totalStudyHours: true,
              lastStudyDate: true,
              createdAt: true,
              updatedAt: true,
            }
          },
          learningProfile: {
            select: {
              strengths: true,
              weaknesses: true,
              recommendedFocus: true,
              learningVelocity: true,
              retentionRate: true,
              preferredDifficulty: true,
            }
          },
          settings: {
            select: {
              theme: true,
              language: true,
              notifyMessages: true,
              notifyConnectionRequests: true,
              profileVisibility: true,
              showOnlineStatus: true,
            }
          },
        }
      }),

      // 2. User presence (online/offline status) - REAL-TIME
      prisma.userPresence.findUnique({
        where: { userId },
        select: {
          status: true,
          lastSeenAt: true,
          lastActivityAt: true,
          updatedAt: true,
        }
      }),

      // 3. Recent messages (last 50)
      prisma.message.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          content: true,
          type: true,
          createdAt: true,
          isEdited: true,
          recipientId: true,
          groupId: true,
          isDeleted: true,
        }
      }),

      // 3. Recent posts (last 30)
      prisma.post.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          content: true,
          imageUrls: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            }
          }
        }
      }),

      // 4. Group memberships
      prisma.groupMember.findMany({
        where: { userId },
        select: {
          role: true,
          joinedAt: true,
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              subject: true,
              createdAt: true,
              _count: {
                select: { members: true }
              }
            }
          }
        }
      }),

      // 5. Study sessions (participated in)
      prisma.sessionParticipant.findMany({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        take: 30,
        select: {
          joinedAt: true,
          leftAt: true,
          session: {
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              startedAt: true,
              endedAt: true,
              creator: {
                select: { id: true, name: true }
              },
              _count: {
                select: { participants: true }
              }
            }
          }
        }
      }),

      // 6. Partner connections - sent matches
      prisma.match.findMany({
        where: {
          senderId: userId,
          status: 'ACCEPTED'
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          receiver: { select: { id: true, name: true, email: true, avatarUrl: true } },
        }
      }),

      // 7. Partner connections - received matches
      prisma.match.findMany({
        where: {
          receiverId: userId,
          status: 'ACCEPTED'
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
        }
      }),

      // 8. Reports against this user
      prisma.report.findMany({
        where: { reportedUserId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          handledAt: true,
          resolution: true,
          reporter: {
            select: { id: true, name: true, email: true }
          },
          handledBy: {
            select: { id: true, name: true }
          }
        }
      }),

      // 9. Reports filed by this user
      prisma.report.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          handledAt: true,
          reportedUser: {
            select: { id: true, name: true, email: true }
          }
        }
      }),

      // 10. Warnings issued to user
      prisma.userWarning.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          severity: true,
          issuedById: true,
          createdAt: true,
          expiresAt: true,
        }
      }),

      // 11. Current ban status
      prisma.userBan.findUnique({
        where: { userId },
        select: {
          id: true,
          type: true,
          reason: true,
          issuedById: true,
          createdAt: true,
          expiresAt: true,
        }
      }),

      // 12. Device sessions (login history)
      prisma.deviceSession.findMany({
        where: { userId },
        orderBy: { lastHeartbeatAt: 'desc' },
        take: 20,
        select: {
          id: true,
          deviceId: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastHeartbeatAt: true,
          isActive: true,
        }
      }),

      // 13. Activity statistics
      prisma.$transaction([
        prisma.message.count({ where: { senderId: userId } }),
        prisma.post.count({ where: { userId } }),
        prisma.postComment.count({ where: { userId } }),
        prisma.postLike.count({ where: { userId } }),
        prisma.sessionParticipant.count({ where: { userId } }),
        prisma.groupMember.count({ where: { userId } }),
        prisma.match.count({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            status: 'ACCEPTED'
          }
        }),
        prisma.report.count({ where: { reportedUserId: userId } }),
        prisma.userWarning.count({ where: { userId } }),
      ]),

      // 14. AI Partner sessions
      prisma.aIPartnerSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          subject: true,
          status: true,
          startedAt: true,
          endedAt: true,
          totalDuration: true,
          messageCount: true,
          quizCount: true,
          flashcardCount: true,
          rating: true,
          flaggedCount: true,
          wasSafetyBlocked: true,
          createdAt: true,
        }
      }),

      // 15. AI Partner stats
      prisma.aIPartnerSession.aggregate({
        where: { userId },
        _count: true,
        _sum: {
          messageCount: true,
          totalDuration: true,
          flaggedCount: true,
        },
        _avg: { rating: true },
      }),

      // 16. AI Partner flagged messages
      prisma.aIPartnerMessage.findMany({
        where: {
          session: { userId },
          wasFlagged: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          content: true,
          role: true,
          flagCategories: true,
          createdAt: true,
          session: {
            select: {
              id: true,
              subject: true,
            }
          }
        }
      }),
    ])

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Combine sent and received matches for partner connections
    const partnerConnections = [
      ...sentMatches.map(match => ({
        matchId: match.id,
        status: match.status,
        connectedAt: match.updatedAt,
        partner: match.receiver
      })),
      ...receivedMatches.map(match => ({
        matchId: match.id,
        status: match.status,
        connectedAt: match.updatedAt,
        partner: match.sender
      }))
    ]

    // Format messages with recipient info
    const formattedMessages = recentMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      createdAt: msg.createdAt,
      isEdited: msg.isEdited,
      isDeleted: msg.isDeleted,
      recipientId: msg.recipientId,
      groupId: msg.groupId,
    }))

    // Format group memberships with member count
    const formattedGroups = groupMemberships.map(membership => ({
      role: membership.role,
      joinedAt: membership.joinedAt,
      group: {
        ...membership.group,
        memberCount: membership.group._count.members
      }
    }))

    // Build activity stats object
    const [
      totalMessages,
      totalPosts,
      totalComments,
      totalLikes,
      totalSessions,
      totalGroups,
      totalPartners,
      totalReportsAgainst,
      totalWarnings,
    ] = activityStats

    // Log this admin view action
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_USER_DETAILS',
        targetType: 'USER',
        targetId: userId,
        details: {
          viewedSections: [
            'profile', 'messages', 'posts', 'groups',
            'sessions', 'connections', 'reports', 'warnings', 'devices'
          ]
        },
      }
    })

    // Calculate accurate online status
    // User is considered online if last heartbeat was within 2 minutes
    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
    const now = Date.now()
    const lastSeenTime = userPresence?.lastSeenAt ? new Date(userPresence.lastSeenAt).getTime() : 0
    const isOnline = userPresence?.status === 'online' && (now - lastSeenTime) < ONLINE_THRESHOLD_MS
    const activeDeviceCount = deviceSessions.filter(d => d.isActive).length

    return NextResponse.json({
      success: true,
      data: {
        // Core user info
        user: {
          ...userData,
          signupMethod: userData.googleId ? 'google' : 'email',
        },

        // REAL-TIME Online Status (accurate 100%)
        onlineStatus: {
          isOnline,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastSeenAt: userPresence?.lastSeenAt || null,
          lastActivityAt: userPresence?.lastActivityAt || null,
          activeDevices: activeDeviceCount,
          // How long ago was the user last seen (in minutes)
          lastSeenMinutesAgo: userPresence?.lastSeenAt
            ? Math.floor((now - lastSeenTime) / (1000 * 60))
            : null,
        },

        // Activity overview
        activityStats: {
          totalMessages,
          totalPosts,
          totalComments,
          totalLikes,
          totalSessions,
          totalGroups,
          totalPartners,
          totalReportsAgainst,
          totalWarnings,
          accountAge: Math.floor((Date.now() - new Date(userData.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        },

        // Detailed data
        recentMessages: formattedMessages,
        recentPosts,
        groupMemberships: formattedGroups,
        studySessions,
        partnerConnections,
        reportsAgainst,
        reportsFiled,
        warnings,
        ban,
        deviceSessions,

        // AI Partner data
        aiPartner: {
          sessions: aiPartnerSessions.map(s => ({
            ...s,
            durationFormatted: s.totalDuration
              ? formatAIDuration(s.totalDuration)
              : null,
          })),
          stats: {
            totalSessions: aiPartnerStats._count,
            totalMessages: aiPartnerStats._sum.messageCount || 0,
            totalDuration: aiPartnerStats._sum.totalDuration || 0,
            totalDurationFormatted: formatAIDuration(aiPartnerStats._sum.totalDuration || 0),
            averageRating: aiPartnerStats._avg.rating
              ? Number(aiPartnerStats._avg.rating.toFixed(1))
              : null,
            totalFlagged: aiPartnerStats._sum.flaggedCount || 0,
          },
          flaggedMessages: aiPartnerFlaggedMessages,
          hasAIPartnerActivity: aiPartnerStats._count > 0,
          hasFlaggedContent: aiPartnerFlaggedMessages.length > 0,
        },

        // Risk assessment
        riskIndicators: {
          hasWarnings: warnings.length > 0,
          warningCount: warnings.length,
          hasReportsAgainst: reportsAgainst.length > 0,
          reportCount: reportsAgainst.length,
          isBanned: !!ban,
          banType: ban?.type || null,
          isDeactivated: !!userData.deactivatedAt,
          recentActivity: userData.lastLoginAt
            ? Math.floor((Date.now() - new Date(userData.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
            : null,
          hasAIFlaggedContent: aiPartnerFlaggedMessages.length > 0,
          aiFlaggedCount: aiPartnerFlaggedMessages.length,
        }
      }
    })

  } catch (error) {
    console.error('Error fetching user details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user details' },
      { status: 500 }
    )
  }
}

// Helper function to format AI Partner session duration
function formatAIDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}
