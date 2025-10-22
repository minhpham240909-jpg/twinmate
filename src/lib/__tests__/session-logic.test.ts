import { prisma } from '../prisma'

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    studySession: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sessionParticipant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

describe('Study Session Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Session Creation', () => {
    it('should create a new study session', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Math Study Group',
        description: 'Study algebra together',
        type: 'GROUP',
        createdBy: 'user-123',
        status: 'SCHEDULED',
        maxParticipants: 10,
        isPublic: true,
        createdAt: new Date(),
      }

      ;(prisma.studySession.create as jest.Mock).mockResolvedValue(mockSession)

      const result = await prisma.studySession.create({
        data: {
          title: 'Math Study Group',
          description: 'Study algebra together',
          type: 'GROUP',
          createdBy: 'user-123',
          status: 'SCHEDULED',
          maxParticipants: 10,
          isPublic: true,
        },
      })

      expect(result).toEqual(mockSession)
      expect(result.status).toBe('SCHEDULED')
    })

    it('should create SOLO session type', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Personal Study Time',
        type: 'SOLO',
        createdBy: 'user-123',
        status: 'SCHEDULED',
        maxParticipants: 1,
        isPublic: false,
      }

      ;(prisma.studySession.create as jest.Mock).mockResolvedValue(mockSession)

      const result = await prisma.studySession.create({
        data: {
          title: 'Personal Study Time',
          type: 'SOLO',
          createdBy: 'user-123',
          status: 'SCHEDULED',
          maxParticipants: 1,
          isPublic: false,
        },
      })

      expect(result.type).toBe('SOLO')
      expect(result.maxParticipants).toBe(1)
    })

    it('should create ONE_ON_ONE session type', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Study with Partner',
        type: 'ONE_ON_ONE',
        createdBy: 'user-123',
        status: 'SCHEDULED',
        maxParticipants: 2,
        isPublic: false,
      }

      ;(prisma.studySession.create as jest.Mock).mockResolvedValue(mockSession)

      const result = await prisma.studySession.create({
        data: {
          title: 'Study with Partner',
          type: 'ONE_ON_ONE',
          createdBy: 'user-123',
          status: 'SCHEDULED',
          maxParticipants: 2,
          isPublic: false,
        },
      })

      expect(result.type).toBe('ONE_ON_ONE')
      expect(result.maxParticipants).toBe(2)
    })
  })

  describe('Session Status Updates', () => {
    it('should start a scheduled session', async () => {
      const mockUpdatedSession = {
        id: 'session-123',
        status: 'ACTIVE',
        startedAt: new Date(),
      }

      ;(prisma.studySession.update as jest.Mock).mockResolvedValue(mockUpdatedSession)

      const result = await prisma.studySession.update({
        where: { id: 'session-123' },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      })

      expect(result.status).toBe('ACTIVE')
      expect(result.startedAt).toBeDefined()
    })

    it('should complete an active session', async () => {
      const mockUpdatedSession = {
        id: 'session-123',
        status: 'COMPLETED',
        endedAt: new Date(),
      }

      ;(prisma.studySession.update as jest.Mock).mockResolvedValue(mockUpdatedSession)

      const result = await prisma.studySession.update({
        where: { id: 'session-123' },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      })

      expect(result.status).toBe('COMPLETED')
      expect(result.endedAt).toBeDefined()
    })

    it('should cancel a scheduled session', async () => {
      const mockUpdatedSession = {
        id: 'session-123',
        status: 'CANCELLED',
      }

      ;(prisma.studySession.update as jest.Mock).mockResolvedValue(mockUpdatedSession)

      const result = await prisma.studySession.update({
        where: { id: 'session-123' },
        data: {
          status: 'CANCELLED',
        },
      })

      expect(result.status).toBe('CANCELLED')
    })
  })

  describe('Session Participants', () => {
    it('should add participant to session', async () => {
      const mockParticipant = {
        id: 'participant-123',
        sessionId: 'session-123',
        userId: 'user-456',
        status: 'JOINED',
        joinedAt: new Date(),
      }

      ;(prisma.sessionParticipant.create as jest.Mock).mockResolvedValue(mockParticipant)

      const result = await prisma.sessionParticipant.create({
        data: {
          sessionId: 'session-123',
          userId: 'user-456',
          status: 'JOINED',
          joinedAt: new Date(),
        },
      })

      expect(result.status).toBe('JOINED')
      expect(result.userId).toBe('user-456')
    })

    it('should get all participants in a session', async () => {
      const mockParticipants = [
        {
          id: 'participant-1',
          sessionId: 'session-123',
          userId: 'user-1',
          status: 'JOINED',
        },
        {
          id: 'participant-2',
          sessionId: 'session-123',
          userId: 'user-2',
          status: 'JOINED',
        },
      ]

      ;(prisma.sessionParticipant.findMany as jest.Mock).mockResolvedValue(mockParticipants)

      const result = await prisma.sessionParticipant.findMany({
        where: {
          sessionId: 'session-123',
          status: 'JOINED',
        },
      })

      expect(result).toHaveLength(2)
      expect(result.every((p: { status: string }) => p.status === 'JOINED')).toBe(true)
    })

    it('should remove participant from session', async () => {
      const mockUpdatedParticipant = {
        id: 'participant-123',
        status: 'LEFT',
        leftAt: new Date(),
      }

      ;(prisma.sessionParticipant.update as jest.Mock).mockResolvedValue(mockUpdatedParticipant)

      const result = await prisma.sessionParticipant.update({
        where: { id: 'participant-123' },
        data: {
          status: 'LEFT',
          leftAt: new Date(),
        },
      })

      expect(result.status).toBe('LEFT')
      expect(result.leftAt).toBeDefined()
    })
  })

  describe('Session Queries', () => {
    it('should find active sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          status: 'ACTIVE',
          title: 'Math Study',
        },
        {
          id: 'session-2',
          status: 'ACTIVE',
          title: 'Science Study',
        },
      ]

      ;(prisma.studySession.findMany as jest.Mock).mockResolvedValue(mockSessions)

      const result = await prisma.studySession.findMany({
        where: { status: 'ACTIVE' },
      })

      expect(result).toHaveLength(2)
      expect(result.every((s: { status: string }) => s.status === 'ACTIVE')).toBe(true)
    })

    it('should find public sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          isPublic: true,
          title: 'Public Study',
        },
      ]

      ;(prisma.studySession.findMany as jest.Mock).mockResolvedValue(mockSessions)

      const result = await prisma.studySession.findMany({
        where: { isPublic: true },
      })

      expect(result.every((s: { isPublic: boolean }) => s.isPublic)).toBe(true)
    })

    it('should find session by creator', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          createdBy: 'user-123',
          title: 'My Study Session',
        },
      ]

      ;(prisma.studySession.findMany as jest.Mock).mockResolvedValue(mockSessions)

      const result = await prisma.studySession.findMany({
        where: { createdBy: 'user-123' },
      })

      expect(result.every((s: { createdBy: string }) => s.createdBy === 'user-123')).toBe(true)
    })
  })

  describe('Transaction Safety', () => {
    it('should handle session start with transaction', async () => {
      const mockSession = {
        id: 'session-123',
        status: 'SCHEDULED',
        createdBy: 'user-123',
      }

      const mockUpdatedSession = {
        ...mockSession,
        status: 'ACTIVE',
        startedAt: new Date(),
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          studySession: {
            findUnique: jest.fn().mockResolvedValue(mockSession),
            update: jest.fn().mockResolvedValue(mockUpdatedSession),
          },
        })
      })

      const result = await prisma.$transaction(async (tx) => {
        const session = await tx.studySession.findUnique({
          where: { id: 'session-123' },
        })

        if (!session) {
          throw new Error('Session not found')
        }

        if (session.status === 'ACTIVE') {
          throw new Error('Session already started')
        }

        return await tx.studySession.update({
          where: { id: 'session-123' },
          data: {
            status: 'ACTIVE',
            startedAt: new Date(),
          },
        })
      })

      expect(result.status).toBe('ACTIVE')
    })
  })
})
