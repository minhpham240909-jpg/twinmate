import { NextRequest, NextResponse } from 'next/server'
import { RtcTokenBuilder, RtcRole } from 'agora-token'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders, handleCorsPreFlight } from '@/lib/cors'
import { prisma } from '@/lib/prisma'

// Handle CORS preflight
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  // Set CORS headers for all responses
  const headers = corsHeaders(origin)

  try {
    console.log('[Agora Token] Request received from origin:', origin)

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Agora Token] Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401, headers }
      )
    }

    console.log('[Agora Token] User authenticated:', user.id)

    const body = await req.json()
    const { channelName, uid, role = 'publisher' } = body

    console.log('[Agora Token] Request params:', { channelName, uid, role })

    if (!channelName) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400, headers }
      )
    }

    // SECURITY: Verify user is a participant in the study session
    // Find the session by Agora channel name
    const session = await prisma.studySession.findFirst({
      where: { agoraChannel: channelName },
      select: { id: true, status: true }
    })

    if (!session) {
      console.warn(`[Agora Token] Session not found for channel: ${channelName}`)
      return NextResponse.json(
        { error: 'Study session not found' },
        { status: 404, headers }
      )
    }

    // SECURITY: Verify user is a JOINED participant (not just invited)
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId: session.id,
        userId: user.id,
        status: 'JOINED' // Only JOINED participants can get tokens
      }
    })

    if (!participant) {
      console.warn(`[Agora Token] User ${user.id} is not a joined participant in session ${session.id}`)
      return NextResponse.json(
        { error: 'You are not authorized to join this study session' },
        { status: 403, headers }
      )
    }

    console.log('[Agora Token] Participant validation passed:', { sessionId: session.id, userId: user.id })

    // Get Agora credentials from environment variables
    // Sanitize to remove any newlines or whitespace that might cause token generation to fail
    const sanitize = (val: string | undefined) => val?.replace(/[\r\n\s]+/g, '').trim() || ''
    const appId = sanitize(process.env.NEXT_PUBLIC_AGORA_APP_ID)
    const appCertificate = sanitize(process.env.AGORA_APP_CERTIFICATE)

    console.log('[Agora Token] Credentials check:', {
      appIdExists: !!appId,
      appIdLength: appId?.length,
      certExists: !!appCertificate,
      certLength: appCertificate?.length
    })

    if (!appId || !appCertificate) {
      console.error('[Agora Token] Missing credentials!')
      return NextResponse.json(
        {
          error: 'Agora credentials not configured',
          details: `AppID: ${appId ? 'exists' : 'missing'}, Certificate: ${appCertificate ? 'exists' : 'missing'}`
        },
        { status: 500, headers }
      )
    }

    // Generate a random UID if not provided
    const userUid = uid || Math.floor(Math.random() * 100000)

    // Token expiration time (24 hours from now)
    const expirationTimeInSeconds = 86400
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // Build the token
    const agoraRole = role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER

    console.log('[Agora Token] Building token for:', { channelName, userUid, role: agoraRole })

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      userUid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    )

    console.log('[Agora Token] Token generated successfully')

    return NextResponse.json(
      {
        token,
        appId,
        channelName,
        uid: userUid,
        expiresAt: privilegeExpiredTs,
        success: true
      },
      { headers }
    )

  } catch (error: any) {
    console.error('[Agora Token] Fatal error:', error)
    console.error('[Agora Token] Error stack:', error?.stack)
    return NextResponse.json(
      {
        error: 'Failed to generate Agora token',
        details: error?.message || String(error)
      },
      { status: 500, headers }
    )
  }
}
