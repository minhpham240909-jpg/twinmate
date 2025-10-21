import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import { NextRequest } from 'next/server'
import { typeDefs } from '@/graphql/schema'
import { resolvers } from '@/graphql/resolvers'
import { createClient } from '@/lib/supabase/server'

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable GraphQL Playground in development
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
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
