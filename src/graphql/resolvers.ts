import { prisma } from '@/lib/prisma'

export const resolvers = {
  Query: {
    getStudySession: async (_parent: any, { sessionId }: { sessionId: string }, context: any) => {
      // Get user from context (we'll set this up in Apollo Server)
      const userId = context.userId
      if (!userId) {
        throw new Error('Unauthorized')
      }

      const session = await prisma.studySession.findUnique({
        where: { id: sessionId },
        include: {
          creator: true,
          participants: {
            include: {
              user: true,
            },
          },
          messages: {
            include: {
              sender: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      // Check if user is a participant
      const isParticipant = session.participants.some((p) => p.userId === userId)
      if (!isParticipant) {
        throw new Error('Access denied')
      }

      return {
        id: session.id,
        title: session.title,
        description: session.description,
        type: session.type,
        status: session.status,
        subject: session.subject,
        tags: session.tags,
        scheduledAt: session.scheduledAt?.toISOString(),
        waitingExpiresAt: session.waitingExpiresAt?.toISOString(),
        startedAt: session.startedAt?.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        durationMinutes: session.durationMinutes,
        agoraChannel: session.agoraChannel,
        maxParticipants: session.maxParticipants,
        createdBy: {
          id: session.creator.id,
          name: session.creator.name,
          email: session.creator.email,
          avatarUrl: session.creator.avatarUrl,
        },
        participants: session.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt?.toISOString() || new Date().toISOString(),
          user: {
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            avatarUrl: p.user.avatarUrl,
          },
        })),
        messages: session.messages.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          sender: {
            id: m.sender.id,
            name: m.sender.name,
            email: m.sender.email,
            avatarUrl: m.sender.avatarUrl,
          },
        })),
      }
    },

    getMyStudySessions: async (_parent: any, _args: any, context: any) => {
      const userId = context.userId
      if (!userId) {
        throw new Error('Unauthorized')
      }

      const sessions = await prisma.studySession.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        include: {
          creator: true,
          participants: {
            include: {
              user: true,
            },
          },
          messages: {
            include: {
              sender: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return sessions.map((session) => ({
        id: session.id,
        title: session.title,
        description: session.description,
        type: session.type,
        status: session.status,
        subject: session.subject,
        tags: session.tags,
        scheduledAt: session.scheduledAt?.toISOString(),
        waitingExpiresAt: session.waitingExpiresAt?.toISOString(),
        startedAt: session.startedAt?.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        durationMinutes: session.durationMinutes,
        agoraChannel: session.agoraChannel,
        maxParticipants: session.maxParticipants,
        createdBy: {
          id: session.creator.id,
          name: session.creator.name,
          email: session.creator.email,
          avatarUrl: session.creator.avatarUrl,
        },
        participants: session.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt?.toISOString() || new Date().toISOString(),
          user: {
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            avatarUrl: p.user.avatarUrl,
          },
        })),
        messages: session.messages.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          sender: {
            id: m.sender.id,
            name: m.sender.name,
            email: m.sender.email,
            avatarUrl: m.sender.avatarUrl,
          },
        })),
      }))
    },
  },

  Mutation: {
    sendMessage: async (
      _parent: any,
      { sessionId, content }: { sessionId: string; content: string },
      context: any
    ) => {
      const userId = context.userId
      if (!userId) {
        throw new Error('Unauthorized')
      }

      // Check if user is a participant
      const participant = await prisma.sessionParticipant.findFirst({
        where: {
          sessionId,
          userId,
        },
      })

      if (!participant) {
        throw new Error('Access denied')
      }

      const message = await prisma.sessionMessage.create({
        data: {
          sessionId,
          senderId: userId,
          content,
        },
        include: {
          sender: true,
        },
      })

      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          email: message.sender.email,
          avatarUrl: message.sender.avatarUrl,
        },
      }
    },

    createStudySession: async (
      _parent: any,
      args: {
        title: string
        description?: string
        type: string
        subject?: string
        tags?: string[]
        scheduledAt?: string
        durationMinutes?: number
      },
      context: any
    ) => {
      const userId = context.userId
      if (!userId) {
        throw new Error('Unauthorized')
      }

      const session = await prisma.studySession.create({
        data: {
          title: args.title,
          description: args.description,
          type: args.type as any, // SessionType enum
          subject: args.subject,
          tags: args.tags || [],
          scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
          durationMinutes: args.durationMinutes || 60,
          status: 'WAITING',
          createdBy: userId,
          userId,
          participants: {
            create: {
              userId,
              role: 'HOST',
            },
          },
        },
        include: {
          creator: true,
          participants: {
            include: {
              user: true,
            },
          },
          messages: {
            include: {
              sender: true,
            },
          },
        },
      })

      return {
        id: session.id,
        title: session.title,
        description: session.description,
        type: session.type,
        status: session.status,
        subject: session.subject,
        tags: session.tags,
        scheduledAt: session.scheduledAt?.toISOString(),
        waitingExpiresAt: session.waitingExpiresAt?.toISOString(),
        startedAt: session.startedAt?.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        durationMinutes: session.durationMinutes,
        agoraChannel: session.agoraChannel,
        maxParticipants: session.maxParticipants,
        createdBy: {
          id: session.creator.id,
          name: session.creator.name,
          email: session.creator.email,
          avatarUrl: session.creator.avatarUrl,
        },
        participants: session.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt?.toISOString() || new Date().toISOString(),
          user: {
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            avatarUrl: p.user.avatarUrl,
          },
        })),
        messages: [],
      }
    },
  },
}
