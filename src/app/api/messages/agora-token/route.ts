import { NextRequest, NextResponse } from 'next/server'
import { RtcTokenBuilder, RtcRole } from 'agora-token'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders, handleCorsPreFlight } from '@/lib/cors'

// Handle CORS preflight
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      )
    }

    const userId = user.id
    const body = await req.json()
    const { channelName, uid, role = 'publisher' } = body

    if (!channelName) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400, headers: corsHeaders(origin) }
      )
    }

    // Get Agora credentials from environment variables
    // Sanitize to remove any newlines or whitespace that might cause token generation to fail
    const sanitize = (val: string | undefined) => val?.replace(/[\r\n\s]+/g, '').trim() || ''
    const appId = sanitize(process.env.NEXT_PUBLIC_AGORA_APP_ID)
    const appCertificate = sanitize(process.env.AGORA_APP_CERTIFICATE)

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: 'Agora credentials not configured. Please add NEXT_PUBLIC_AGORA_APP_ID and AGORA_APP_CERTIFICATE to your .env file' },
        { status: 500, headers: corsHeaders(origin) }
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

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      userUid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    )

    return NextResponse.json(
      {
        token,
        appId,
        channelName,
        uid: userUid,
        expiresAt: privilegeExpiredTs,
        success: true
      },
      { headers: corsHeaders(origin) }
    )

  } catch (error) {
    console.error('Error generating Agora token:', error)
    return NextResponse.json(
      { error: 'Failed to generate Agora token' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
}
