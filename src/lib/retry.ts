/**
 * Retries an async function with exponential backoff.
 * Delays: 500ms, 1000ms, 2000ms (by default).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = 'operation' } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  // Unreachable — TypeScript needs this
  throw new Error(`[retry] ${label} exhausted all ${maxAttempts} attempts`)
}
