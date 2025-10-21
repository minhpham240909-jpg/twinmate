'use client'

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

let client: ApolloClient | null = null

export function getApolloClient() {
  if (!client || typeof window === 'undefined') {
    client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: '/api/graphql',
        fetchOptions: { cache: 'no-store' },
      }),
    })
  }

  return client
}
