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
  const rawText = (formData.get('text') as string) || ''
  const rawHtml = (formData.get('html') as string) || ''
  // Use plain text if available; otherwise strip HTML tags for a rough text version
  const textBody = rawText || rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const spamScore = parseFloat((formData.get('spam_score') as string) || '0')

  console.log('[parse] Raw fields — to:', to, '| from:', from, '| envelope:', envelope)

  // Extract sender name from "Name <email>" format
  const nameMatch = from.match(/^(.+?)\s*</)
  const senderName = nameMatch ? nameMatch[1].trim().replace(/"/g, '') : from.split('@')[0]

  // Extract clean sender email from "Name <email>" format
  const fromEmailMatch = from.match(/<(.+?)>/)
  const fromAddress = fromEmailMatch ? fromEmailMatch[1].trim().toLowerCase() : from.trim().toLowerCase()

  // Find the Clerva inbound address from all recipients.
  // When Gmail/Outlook forwards, the To: header keeps the original recipient (user@gmail.com)
  // but the SMTP envelope contains the actual forwarding destination (leads-xxx@inbound.clerva.app).
  // We check envelope first, then fall back to the To: header.
  let toAddress = ''

  // Collect all candidate addresses from envelope and To: header
  const candidates: string[] = []

  if (envelope) {
    try {
      const env = JSON.parse(envelope)
      const envelopeTo = Array.isArray(env.to) ? env.to : env.to ? [env.to] : []
      for (const addr of envelopeTo) {
        if (typeof addr === 'string') candidates.push(addr.trim().toLowerCase())
      }
    } catch {
      // Fall through to header-based parsing
    }
  }

  // Also extract addresses from the To: header (may have multiple: "a@x.com, b@y.com")
  if (to) {
    const headerAddresses = to.match(/[\w.+-]+@[\w.-]+/g)
    if (headerAddresses) {
      for (const addr of headerAddresses) {
        candidates.push(addr.trim().toLowerCase())
      }
    }
  }

  // Prefer the @inbound.clerva.app address — that's the Clerva inbound address
  toAddress = candidates.find(a => a.includes('@inbound.clerva.app')) || candidates[0] || ''

  console.log('[parse] Candidates:', candidates, '| resolved to:', toAddress)

  return {
    to: toAddress,
    from: fromAddress,
    senderName,
    subject,
    textBody,
    spamScore,
  }
}
