import sgMail from '@sendgrid/mail'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

interface SendEmailReplyParams {
  to: string
  fromAddress: string
  fromName: string
  subject: string
  body: string
}

// SendGrid requires the "from" address to be on a verified/authenticated domain.
// The inbound subdomain (inbound.clerva.app) may not be authenticated for sending.
// Use noreply@clerva.app as the sender and set reply-to as the user's inbound address
// so customer replies still route back through the system.
const VERIFIED_SEND_DOMAIN = process.env.SENDGRID_VERIFIED_DOMAIN || 'clerva.app'

export async function sendEmailReply({
  to,
  fromAddress,
  fromName,
  subject,
  body,
}: SendEmailReplyParams): Promise<void> {
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured')
  }

  // Sanitize fromName to prevent email header injection
  const safeName = fromName.replace(/[\r\n]/g, '').slice(0, 100)

  // Use verified domain for "from", and the user's inbound address as reply-to
  const sendFrom = `noreply@${VERIFIED_SEND_DOMAIN}`

  await sgMail.send({
    to,
    from: { email: sendFrom, name: safeName },
    replyTo: { email: fromAddress, name: safeName },
    subject: subject.replace(/[\r\n]/g, ''),
    text: body,
  })
}

/**
 * Extract the original subject from a raw email message that starts with "Subject: ..."
 * Returns "Re: <subject>" or "Re: your inquiry" as fallback.
 */
export function extractReplySubject(rawMessage: string): string {
  const match = rawMessage.match(/^Subject:\s*(.+)/m)
  const original = match?.[1]?.trim()
  if (!original) return 'Re: your inquiry'
  // Avoid double "Re:" if already present
  if (/^re:/i.test(original)) return original
  return `Re: ${original}`
}
