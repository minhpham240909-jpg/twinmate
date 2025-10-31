/**
 * Simple endpoint to check which version is deployed
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    deployedAt: new Date().toISOString(),
    commitHash: 'b4ce546', // Latest commit with fixes
    fixes: [
      'Self-search detection with helpful message',
      'matchCandidates minScore lowered to 0.1',
      'Fallback to return top candidates',
      'Improved compatibility scoring for empty profiles',
    ],
    message: 'If you see this, the new code is deployed!'
  })
}
