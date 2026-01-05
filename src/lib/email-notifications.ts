/**
 * Email Notification Service
 * Sends email notifications via Supabase (uses built-in email service)
 * Falls back to console logging in development
 */

import { Resend } from 'resend'
import logger from './logger'
import { getAppUrl } from './env'

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface EmailNotificationData {
  to: string
  subject: string
  html: string
  text?: string
}

export interface NotificationContext {
  userName: string
  userEmail: string
  actionUrl?: string
  senderName?: string
  additionalData?: Record<string, any>
}

/**
 * Send email notification
 */
export async function sendEmailNotification(data: EmailNotificationData): Promise<boolean> {
  try {
    // In development, just log
    if (process.env.NODE_ENV === 'development') {
      logger.info('📧 Email notification (dev mode)', {
        to: data.to,
        subject: data.subject,
      })
      console.log('\n========== EMAIL NOTIFICATION ==========')
      console.log('To:', data.to)
      console.log('Subject:', data.subject)
      console.log('Body:', data.text || data.html.substring(0, 200))
      console.log('========================================\n')
      return true
    }

    // Production: Use Resend
    if (!resend) {
      logger.warn('Resend not configured, skipping email', {
        to: data.to,
        subject: data.subject,
      })
      return false
    }

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Clerva <noreply@clerva.com>',
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    })

    if (result.error) {
      logger.error('Resend email error', result.error as any)
      return false
    }

    logger.info('Email sent successfully', {
      to: data.to,
      subject: data.subject,
      id: result.data?.id,
    })

    return true
  } catch (error) {
    logger.error('Failed to send email notification', error as Error)
    return false
  }
}

/**
 * Email templates
 */

export function generateConnectionRequestEmail(ctx: NotificationContext): EmailNotificationData {
  return {
    to: ctx.userEmail,
    subject: `${ctx.senderName} sent you a connection request`,
    text: `Hi ${ctx.userName},\n\n${ctx.senderName} wants to connect with you on Clerva!\n\nView their profile and respond: ${ctx.actionUrl}\n\nBest regards,\nThe Clerva Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Connection Request</h2>
        <p>Hi ${ctx.userName},</p>
        <p><strong>${ctx.senderName}</strong> wants to connect with you on Clerva!</p>
        <a href="${ctx.actionUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">View Profile & Respond</a>
        <p style="color: #666; font-size: 14px;">If you don't want to receive these notifications, update your <a href="${getAppUrl()}/settings">email preferences</a>.</p>
      </div>
    `,
  }
}

export function generateConnectionAcceptedEmail(ctx: NotificationContext): EmailNotificationData {
  return {
    to: ctx.userEmail,
    subject: `${ctx.senderName} accepted your connection request`,
    text: `Hi ${ctx.userName},\n\n${ctx.senderName} accepted your connection request! You can now message and schedule study sessions together.\n\nStart chatting: ${ctx.actionUrl}\n\nBest regards,\nThe Clerva Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Connection Accepted!</h2>
        <p>Hi ${ctx.userName},</p>
        <p><strong>${ctx.senderName}</strong> accepted your connection request! You can now message and schedule study sessions together.</p>
        <a href="${ctx.actionUrl}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Start Chatting</a>
        <p style="color: #666; font-size: 14px;">If you don't want to receive these notifications, update your <a href="${getAppUrl()}/settings">email preferences</a>.</p>
      </div>
    `,
  }
}

export function generateSessionInviteEmail(ctx: NotificationContext): EmailNotificationData {
  const sessionTitle = ctx.additionalData?.sessionTitle || 'a study session'
  return {
    to: ctx.userEmail,
    subject: `${ctx.senderName} invited you to ${sessionTitle}`,
    text: `Hi ${ctx.userName},\n\n${ctx.senderName} invited you to join "${sessionTitle}".\n\nJoin session: ${ctx.actionUrl}\n\nBest regards,\nThe Clerva Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8B5CF6;">Study Session Invite</h2>
        <p>Hi ${ctx.userName},</p>
        <p><strong>${ctx.senderName}</strong> invited you to join <strong>"${sessionTitle}"</strong>.</p>
        <a href="${ctx.actionUrl}" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Join Session</a>
        <p style="color: #666; font-size: 14px;">If you don't want to receive these notifications, update your <a href="${getAppUrl()}/settings">email preferences</a>.</p>
      </div>
    `,
  }
}

export function generateNewMessageEmail(ctx: NotificationContext): EmailNotificationData {
  return {
    to: ctx.userEmail,
    subject: `New message from ${ctx.senderName}`,
    text: `Hi ${ctx.userName},\n\n${ctx.senderName} sent you a message on Clerva.\n\nView message: ${ctx.actionUrl}\n\nBest regards,\nThe Clerva Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0EA5E9;">New Message</h2>
        <p>Hi ${ctx.userName},</p>
        <p><strong>${ctx.senderName}</strong> sent you a message on Clerva.</p>
        <a href="${ctx.actionUrl}" style="display: inline-block; background: #0EA5E9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">View Message</a>
        <p style="color: #666; font-size: 14px;">If you don't want to receive these notifications, update your <a href="${getAppUrl()}/settings">email preferences</a>.</p>
      </div>
    `,
  }
}

export function generateWeeklySummaryEmail(ctx: NotificationContext): EmailNotificationData {
  const stats = ctx.additionalData?.stats || {}
  return {
    to: ctx.userEmail,
    subject: 'Your Weekly Clerva Summary',
    text: `Hi ${ctx.userName},\n\nHere's your weekly summary:\n- Study sessions: ${stats.sessions || 0}\n- Study hours: ${stats.hours || 0}\n- New connections: ${stats.connections || 0}\n- Messages: ${stats.messages || 0}\n\nKeep up the great work!\n\nBest regards,\nThe Clerva Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Your Weekly Summary 📊</h2>
        <p>Hi ${ctx.userName},</p>
        <p>Here's what you accomplished this week:</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>📚 Study Sessions:</strong> ${stats.sessions || 0}</p>
          <p style="margin: 8px 0;"><strong>⏱️ Study Hours:</strong> ${stats.hours || 0}</p>
          <p style="margin: 8px 0;"><strong>🤝 New Connections:</strong> ${stats.connections || 0}</p>
          <p style="margin: 8px 0;"><strong>💬 Messages:</strong> ${stats.messages || 0}</p>
        </div>
        <p>Keep up the great work!</p>
        <a href="${getAppUrl()}/dashboard" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">View Dashboard</a>
        <p style="color: #666; font-size: 14px;">If you don't want to receive these notifications, update your <a href="${getAppUrl()}/settings">email preferences</a>.</p>
      </div>
    `,
  }
}

/**
 * Helper to send notification based on type
 */
export async function sendNotificationEmail(
  type: 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'SESSION_INVITE' | 'NEW_MESSAGE' | 'WEEKLY_SUMMARY',
  context: NotificationContext
): Promise<boolean> {
  let emailData: EmailNotificationData

  switch (type) {
    case 'CONNECTION_REQUEST':
      emailData = generateConnectionRequestEmail(context)
      break
    case 'CONNECTION_ACCEPTED':
      emailData = generateConnectionAcceptedEmail(context)
      break
    case 'SESSION_INVITE':
      emailData = generateSessionInviteEmail(context)
      break
    case 'NEW_MESSAGE':
      emailData = generateNewMessageEmail(context)
      break
    case 'WEEKLY_SUMMARY':
      emailData = generateWeeklySummaryEmail(context)
      break
    default:
      logger.warn('Unknown notification type', { type })
      return false
  }

  return sendEmailNotification(emailData)
}
