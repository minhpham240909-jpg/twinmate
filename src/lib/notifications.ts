import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  relatedUserId?: string
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        relatedUserId: params.relatedUserId,
        isRead: false,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

export async function notifySessionParticipants(
  sessionId: string,
  type: NotificationType,
  title: string,
  message: string,
  excludeUserId?: string
) {
  try {
    const participants = await prisma.sessionParticipant.findMany({
      where: {
        sessionId,
        status: 'JOINED',
        ...(excludeUserId && { userId: { not: excludeUserId } }),
      },
      select: { userId: true },
    })

    const notifications = participants.map((p) => ({
      userId: p.userId,
      type: type,
      title,
      message,
      actionUrl: `/study-sessions/${sessionId}`,
      isRead: false,
    }))

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      })
    }
  } catch (error) {
    console.error('Error notifying participants:', error)
  }
}
