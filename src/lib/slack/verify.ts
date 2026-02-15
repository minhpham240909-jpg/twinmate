import { createHmac, timingSafeEqual } from 'crypto'

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!

export function verifySlackSignature(
  headers: Headers,
  rawBody: string
): boolean {
  const timestamp = headers.get('x-slack-request-timestamp')
  const signature = headers.get('x-slack-signature')

  if (!timestamp || !signature) return false

  // Reject requests older than 5 minutes (replay attack prevention)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 60 * 5) return false

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature =
    'v0=' +
    createHmac('sha256', SLACK_SIGNING_SECRET)
      .update(sigBasestring, 'utf8')
      .digest('hex')

  const myBuf = Buffer.from(mySignature, 'utf8')
  const sigBuf = Buffer.from(signature, 'utf8')
  if (myBuf.length !== sigBuf.length) return false
  return timingSafeEqual(myBuf, sigBuf)
}
