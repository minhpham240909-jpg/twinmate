export interface ParsedEmail {
  to: string
  from: string
  senderName: string
  subject: string
  textBody: string
  spamScore: number
}

export function parseInboundEmail(formData: FormData): ParsedEmail {
  const to = (formData.get('to') as string) || ''
  const from = (formData.get('from') as string) || ''
  const envelope = (formData.get('envelope') as string) || ''
  const subject = (formData.get('subject') as string) || ''
  const textBody = (formData.get('text') as string) || ''
  const spamScore = parseFloat((formData.get('spam_score') as string) || '0')

  console.log('[parse] Raw fields — to:', to, '| from:', from, '| envelope:', envelope)

  // Extract sender name from "Name <email>" format
  const nameMatch = from.match(/^(.+?)\s*</)
  const senderName = nameMatch ? nameMatch[1].trim().replace(/"/g, '') : from.split('@')[0]

  // Extract clean sender email from "Name <email>" format
  const fromEmailMatch = from.match(/<(.+?)>/)
  const fromAddress = fromEmailMatch ? fromEmailMatch[1].trim().toLowerCase() : from.trim().toLowerCase()

  // Use envelope.to for the actual SMTP recipient — this is the Adecis inbound address.
  // When Gmail/Outlook forwards to leads-xxx@inbound.clerva.app, the To: header still
  // contains the original recipient (e.g. user@gmail.com), but the envelope has the real
  // forwarding destination. Fall back to parsing the To: header if envelope is missing.
  let toAddress = ''
  if (envelope) {
    try {
      const env = JSON.parse(envelope)
      const envelopeTo = Array.isArray(env.to) ? env.to[0] : env.to
      if (envelopeTo) toAddress = envelopeTo.trim().toLowerCase()
    } catch {
      // Fall through to header-based parsing
    }
  }
  if (!toAddress) {
    const toMatch = to.match(/<(.+?)>/) || [null, to]
    toAddress = (toMatch[1] || to).trim().toLowerCase()
  }

  return {
    to: toAddress,
    from: fromAddress,
    senderName,
    subject,
    textBody,
    spamScore,
  }
}
