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
// Set SENDGRID_FROM_EMAIL to the exact verified sender address in your SendGrid account.
// Defaults to noreply@clerva.app — but this MUST be verified in SendGrid for sending to work.
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@clerva.app'

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

  console.log('[email-send] Sending reply:', {
    to,
    from: SENDGRID_FROM_EMAIL,
    replyTo: fromAddress,
    subject: subject.replace(/[\r\n]/g, ''),
    bodyLength: body.length,
  })

  try {
    await sgMail.send({
      to,
      from: { email: SENDGRID_FROM_EMAIL, name: safeName },
      replyTo: { email: fromAddress, name: safeName },
      subject: subject.replace(/[\r\n]/g, ''),
      text: body,
    })
    console.log('[email-send] Success — reply sent to', to)
  } catch (err: unknown) {
    const sgErr = err as { response?: { body?: unknown; statusCode?: number }; message?: string }
    console.error('[email-send] SendGrid error:', {
      statusCode: sgErr?.response?.statusCode,
      body: JSON.stringify(sgErr?.response?.body),
      message: sgErr?.message,
    })
    throw err
  }
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
