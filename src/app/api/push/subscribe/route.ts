import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/web-push'

// GET /api/push/subscribe - Get VAPID public key
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    publicKey: getVapidPublicKey(),
  })
}

// POST /api/push/subscribe - Subscribe to push notifications
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isWebPushConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { subscription, oldEndpoint } = body

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      )
    }

    const { endpoint, keys } = subscription
    const { p256dh, auth } = keys

    if (!p256dh || !auth) {
      return NextResponse.json(
        { error: 'Missing subscription keys' },
        { status: 400 }
      )
    }

    // Get device info from user agent
    const userAgent = req.headers.get('user-agent') || ''
    const deviceName = getDeviceName(userAgent)

    // If oldEndpoint is provided, this is a subscription refresh - delete old one
    if (oldEndpoint) {
      try {
        await prisma.pushSubscription.deleteMany({
          where: {
            userId: user.id,
            endpoint: oldEndpoint,
          },
        })
      } catch (error) {
        // Log error but don't fail subscription - old endpoint cleanup is non-critical
        console.error('[Push Subscribe] Failed to delete old subscription:', error)
      }
    }

    // Check if this exact subscription already exists
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    })

    if (existing) {
      // Update existing subscription
      if (existing.userId !== user.id) {
        // Endpoint belongs to different user - delete and recreate
        await prisma.pushSubscription.delete({
          where: { endpoint },
        })
      } else {
        // Same user - just update
        await prisma.pushSubscription.update({
          where: { endpoint },
          data: {
            p256dh,
            auth,
            userAgent,
            deviceName,
            isActive: true,
            failCount: 0,
            lastUsed: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription updated',
        })
      }
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
        deviceName,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription created',
    })
  } catch (error) {
    console.error('Error subscribing to push:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe to push notifications' },
      { status: 500 }
    )
  }
}

// DELETE /api/push/subscribe - Unsubscribe from push notifications
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      )
    }

    // Delete the subscription
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from push notifications',
    })
  } catch (error) {
    console.error('Error unsubscribing from push:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}

/**
 * Get a human-readable device name from user agent
 */
function getDeviceName(userAgent: string): string {
  // Check for mobile devices
  if (/iPhone/i.test(userAgent)) {
    return 'Safari on iPhone'
  }
  if (/iPad/i.test(userAgent)) {
    return 'Safari on iPad'
  }
  if (/Android/i.test(userAgent)) {
    if (/Chrome/i.test(userAgent)) {
      return 'Chrome on Android'
    }
    if (/Firefox/i.test(userAgent)) {
      return 'Firefox on Android'
    }
    return 'Browser on Android'
  }

  // Desktop browsers
  if (/Macintosh/i.test(userAgent)) {
    if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
      return 'Chrome on Mac'
    }
    if (/Firefox/i.test(userAgent)) {
      return 'Firefox on Mac'
    }
    if (/Safari/i.test(userAgent)) {
      return 'Safari on Mac'
    }
    if (/Edge/i.test(userAgent)) {
      return 'Edge on Mac'
    }
    return 'Browser on Mac'
  }

  if (/Windows/i.test(userAgent)) {
    if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
      return 'Chrome on Windows'
    }
    if (/Firefox/i.test(userAgent)) {
      return 'Firefox on Windows'
    }
    if (/Edge/i.test(userAgent)) {
      return 'Edge on Windows'
    }
    return 'Browser on Windows'
  }

  if (/Linux/i.test(userAgent)) {
    if (/Chrome/i.test(userAgent)) {
      return 'Chrome on Linux'
    }
    if (/Firefox/i.test(userAgent)) {
      return 'Firefox on Linux'
    }
    return 'Browser on Linux'
  }

  return 'Unknown Device'
}
