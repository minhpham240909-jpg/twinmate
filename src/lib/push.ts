import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@clerva.app'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  tag: string
  url: string
  actions?: { action: string; title: string }[]
  requireInteraction?: boolean
  data?: Record<string, unknown>
}

/**
 * Send push notification to all subscribed devices for a user.
 * Fire-and-forget — failures are logged, never block the pipeline.
 * Automatically removes invalid/expired subscriptions.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  try {
    const supabase = createAdminClient()
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) return

    const expiredIds: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            { TTL: 3600 }
          )
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode
          // 404 or 410 = subscription expired/invalid, clean it up
          if (statusCode === 404 || statusCode === 410) {
            expiredIds.push(sub.id)
          } else {
            console.error('[push] Failed to send to endpoint:', sub.endpoint, err)
          }
        }
      })
    )

    // Clean up expired subscriptions in one query
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds)
    }
  } catch (err) {
    console.error('[push] Failed to send push notification:', err)
  }
}
