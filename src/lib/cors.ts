// CORS headers helper for API routes
// Allows requests from the same origin and configured domains

export function corsHeaders(origin?: string | null) {
  // In production, only allow requests from the app domain
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'https://clerva-app.vercel.app',
    'http://localhost:3000',
  ]

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }

  // Check if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  } else if (!origin || origin === 'null') {
    // Same-origin requests or file:// protocol
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

