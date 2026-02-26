/**
 * Stage 1: Keyword pre-filter for obvious spam/junk.
 * Pure function — no API calls, no Redis, no database.
 * Returns true if the message should be skipped (no AI scoring needed).
 */

// Patterns that indicate the message is NOT a real lead.
// Each pattern is tested case-insensitively against the full message text.
const SPAM_PATTERNS: RegExp[] = [
  // Sales pitches TO the freelancer
  /\b(we offer|our (services|agency|company) (provides|offers|specializes))\b/i,
  /\b(special (offer|discount|deal|promotion))\b/i,
  /\b(limited.time (offer|deal|discount))\b/i,
  /\b(act now|don'?t miss out|exclusive offer)\b/i,
  /\b(buy \d+ get \d+)\b/i,

  // Link spam / SEO spam
  /\b(buy (backlinks|links|followers|likes|views))\b/i,
  /\b(guest post opportunity|link exchange|link building service)\b/i,
  /\b(increase your (traffic|ranking|seo))\b/i,
  /\b(guaranteed (first page|top ranking|seo results))\b/i,

  // Job seekers (not clients)
  /\b(attached (is )?(my|the) (resume|cv|portfolio))\b/i,
  /\b(i'?m (looking for|seeking) (a )?(job|position|role|employment|work|opportunity))\b/i,
  /\b(please (consider|review) my (application|resume|cv))\b/i,
  /\b(i (would like to|want to) apply)\b/i,

  // Newsletter / mailing list
  /\bunsubscribe\b.*\b(click|here|link)\b/i,
  /\b(you (are|'re) receiving this (because|email))\b/i,
  /\b(manage (your )?subscription|email preferences)\b/i,

  // Auto-responders / out-of-office
  /\b(out of (the )?office|on (vacation|holiday|leave))\b/i,
  /\b(auto.?reply|automatic reply|auto.?response)\b/i,
  /\b(i (will|'ll) (be back|return) (on|by))\b/i,

  // Transactional / system emails
  /\b(password reset|verify your (email|account))\b/i,
  /\b(your (order|shipment|delivery|invoice|receipt) (has been|is|#))\b/i,
  /\b(payment (confirmed|received|processed))\b/i,
]

// Very short messages that are clearly not leads
const MIN_MESSAGE_LENGTH = 15

export interface PreFilterResult {
  filtered: boolean
  reason?: string
}

export function preFilterMessage(message: string): PreFilterResult {
  if (!message || message.trim().length < MIN_MESSAGE_LENGTH) {
    return { filtered: true, reason: 'Message too short to be a lead' }
  }

  const text = message.trim()

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { filtered: true, reason: `Matched spam pattern: ${pattern.source.substring(0, 50)}` }
    }
  }

  return { filtered: false }
}
