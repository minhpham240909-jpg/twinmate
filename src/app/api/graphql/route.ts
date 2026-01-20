import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import { NextRequest, NextResponse } from 'next/server'
import { typeDefs } from '@/graphql/schema'
import { resolvers } from '@/graphql/resolvers'
import { createClient } from '@/lib/supabase/server'

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // SECURITY: Only enable introspection in development - prevents API structure exposure
  introspection: process.env.NODE_ENV === 'development',
})

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => {
    // Get Supabase user authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return { userId: user?.id, req }
  },
})

export async function GET(request: NextRequest) {
  try {
    return await handler(request)
  } catch (error) {
    console.error('[GraphQL] GET error:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handler(request)
  } catch (error) {
    console.error('[GraphQL] POST error:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}
