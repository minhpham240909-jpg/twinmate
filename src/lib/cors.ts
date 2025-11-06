// CORS headers helper for API routes
// Allows requests from the same origin and configured domains

export function corsHeaders(origin?: string | null) {
  // In production, only allow requests from the app domain
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://clerva-app.vercel.app',
    'http://localhost:3000',
    'https://localhost:3000',
  ].filter(Boolean) as string[]

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }

  // Check if the origin is allowed
  if (origin) {
    // Allow Vercel preview deployments (*.vercel.app) and configured origins
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost')
    ) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
      console.log('[CORS] Allowing origin:', origin)
    } else {
      console.warn('[CORS] Origin not allowed:', origin, 'Allowed:', allowedOrigins)
      headers['Access-Control-Allow-Origin'] = '*'
    }
  } else {
    // Same-origin requests or no origin header
    headers['Access-Control-Allow-Origin'] = '*'
  }

  return headers
}

export function handleCorsPreFlight(req: Request) {
  const origin = req.headers.get('origin')
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin)
  })
}

