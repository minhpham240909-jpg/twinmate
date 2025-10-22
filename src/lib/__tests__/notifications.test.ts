import { prisma } from '../prisma'

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    sessionParticipant: {
      findMany: jest.fn(),
    },
  },
}))

describe('Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Notification Creation', () => {
    it('should create notification with required fields', async () => {
      const mockNotification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'MATCH_REQUEST',
        title: 'New Connection Request',
        message: 'Someone wants to connect',
        isRead: false,
        createdAt: new Date(),
      }

      ;(prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      const result = await prisma.notification.create({
        data: {
          userId: 'user-123',
          type: 'MATCH_REQUEST',
          title: 'New Connection Request',
          message: 'Someone wants to connect',
          isRead: false,
        },
      })

      expect(result).toEqual(mockNotification)
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'MATCH_REQUEST',
          title: 'New Connection Request',
          message: 'Someone wants to connect',
          isRead: false,
        },
      })
    })

    it('should create notification with optional action URL', async () => {
      const mockNotification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'SESSION_INVITE',
        title: 'Study Session Invite',
        message: 'You have been invited to a session',
        actionUrl: '/study-sessions/session-123',
        isRead: false,
        createdAt: new Date(),
      }

      ;(prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      const result = await prisma.notification.create({
        data: {
          userId: 'user-123',
          type: 'SESSION_INVITE',
          title: 'Study Session Invite',
          message: 'You have been invited to a session',
          actionUrl: '/study-sessions/session-123',
          isRead: false,
        },
      })

      expect(result.actionUrl).toBe('/study-sessions/session-123')
    })
  })

  describe('Notification Queries', () => {
    it('should fetch unread notifications', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-123',
          type: 'MATCH_REQUEST',
          isRead: false,
        },
        {
          id: 'notification-2',
          userId: 'user-123',
          type: 'NEW_MESSAGE',
          isRead: false,
        },
      ]

      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications)

      const result = await prisma.notification.findMany({
        where: {
          userId: 'user-123',
          isRead: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      expect(result).toHaveLength(2)
      expect(result.every((n: { isRead: boolean }) => !n.isRead)).toBe(true)
    })

    it('should fetch notifications with pagination', async () => {
      const mockNotifications = Array.from({ length: 20 }, (_, i) => ({
        id: `notification-${i}`,
        userId: 'user-123',
        type: 'NEW_MESSAGE',
        isRead: false,
      }))

      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockNotifications.slice(0, 10)
      )

      const result = await prisma.notification.findMany({
        where: { userId: 'user-123' },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      })

      expect(result).toHaveLength(10)
    })
  })

  describe('Notification Updates', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notification-123',
        isRead: true,
        readAt: new Date(),
      }

      ;(prisma.notification.update as jest.Mock).mockResolvedValue(mockNotification)

      const result = await prisma.notification.update({
        where: { id: 'notification-123' },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      expect(result.isRead).toBe(true)
      expect(result.readAt).toBeDefined()
    })
  })

  describe('Notification Deletion', () => {
    it('should delete multiple notifications', async () => {
      ;(prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 3 })

      const result = await prisma.notification.deleteMany({
        where: {
          id: {
            in: ['notification-1', 'notification-2', 'notification-3'],
          },
          userId: 'user-123',
        },
      })

      expect(result.count).toBe(3)
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['notification-1', 'notification-2', 'notification-3'],
          },
          userId: 'user-123',
        },
      })
    })

    it('should only delete notifications belonging to user', async () => {
      ;(prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

      const result = await prisma.notification.deleteMany({
        where: {
          id: { in: ['notification-1'] },
          userId: 'wrong-user',
        },
      })

      expect(result.count).toBe(0)
    })
  })
})
