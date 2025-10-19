// Debug endpoint to test Agora token generation
import { NextResponse } from 'next/server'
import { RtcTokenBuilder, RtcRole } from 'agora-token'

export async function GET() {
  try {
    // Sanitize environment variables to remove newlines/whitespace
    const sanitize = (val: string | undefined) => val?.replace(/[\r\n\s]+/g, '').trim() || ''
    const appIdRaw = process.env.NEXT_PUBLIC_AGORA_APP_ID
    const appCertificateRaw = process.env.AGORA_APP_CERTIFICATE
    const appId = sanitize(appIdRaw)
    const appCertificate = sanitize(appCertificateRaw)

    const info = {
      appId: appId ? `${appId.substring(0, 10)}...` : '❌ MISSING',
      appCertificate: appCertificate ? `${appCertificate.substring(0, 10)}...` : '❌ MISSING',
      appIdFull: appId || '❌ MISSING',
      certificateFull: appCertificate || '❌ MISSING',
      hadNewlineInAppId: appIdRaw !== appId,
      hadNewlineInCertificate: appCertificateRaw !== appCertificate,
    }

    if (!appId || !appCertificate) {
      return NextResponse.json({
        ...info,
        error: 'Agora credentials missing',
      }, { status: 500 })
    }

    // Try to generate a test token
    const channelName = 'test-channel'
    const uid = 12345
    const expirationTimeInSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      )

      return NextResponse.json({
        ...info,
        success: true,
        token: `${token.substring(0, 30)}...`,
        tokenLength: token.length,
        message: 'Token generated successfully! Agora credentials are correct.',
      })
    } catch (tokenError) {
      return NextResponse.json({
        ...info,
        success: false,
        error: 'Failed to generate token',
        details: tokenError instanceof Error ? tokenError.message : String(tokenError),
      }, { status: 500 })
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
