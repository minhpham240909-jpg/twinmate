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

  await sgMail.send({
    to,
    from: { email: fromAddress, name: safeName },
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
