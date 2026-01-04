'use client'

import { useQuery, useMutation } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { useState } from 'react'

// GraphQL Query - Get study session
const GET_STUDY_SESSION = gql`
  query GetStudySession($sessionId: String!) {
    getStudySession(sessionId: $sessionId) {
      id
      title
      description
      status
      createdBy {
        name
        avatarUrl
      }
      participants {
        user {
          name
          avatarUrl
        }
      }
      messages {
        id
        content
        createdAt
        sender {
          name
        }
      }
    }
  }
`

// GraphQL Mutation - Send message
const SEND_MESSAGE = gql`
  mutation SendMessage($sessionId: String!, $content: String!) {
    sendMessage(sessionId: $sessionId, content: $content) {
      id
      content
      createdAt
      sender {
        name
      }
    }
  }
`

interface Props {
  sessionId: string
}

interface GetStudySessionData {
  getStudySession: {
    id: string
    title: string
    description?: string
    status: string
    createdBy: {
      name: string
      avatarUrl?: string
    }
    participants: Array<{
      user: {
        name: string
        avatarUrl?: string
      }
    }>
    messages: Array<{
      id: string
      content: string
      createdAt: string
      sender: {
        name: string
      }
    }>
  } | null
}

export default function GraphQLExample({ sessionId }: Props) {
  const [newMessage, setNewMessage] = useState('')

  // Query - Fetch session data
  const { data, loading, error, refetch } = useQuery<GetStudySessionData>(GET_STUDY_SESSION, {
    variables: { sessionId },
    pollInterval: 3000, // Poll every 3 seconds for updates
  })

  // Mutation - Send message
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE, {
    onCompleted: () => {
      setNewMessage('')
      refetch() // Refresh data after sending
    },
  })

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    await sendMessage({
      variables: {
        sessionId,
        content: newMessage.trim(),
      },
    })
  }

  if (loading) return <div className="p-4">Loading session...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error.message}</div>
  if (!data?.getStudySession) return <div className="p-4">Session not found</div>

  const session = data.getStudySession

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header - GraphQL Badge */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{session.title}</h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          🚀 GraphQL Powered
        </span>
      </div>

      {/* Session Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-2">{session.description}</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">Status: {session.status}</span>
          <span>Created by: {session.createdBy.name}</span>
          <span>{session.participants.length} participants</span>
        </div>
      </div>

      {/* Messages */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Messages ({session.messages.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
          {session.messages.length === 0 ? (
            <p className="text-gray-400 text-center">No messages yet</p>
          ) : (
            session.messages.map((msg: any) => (
              <div key={msg.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{msg.sender.name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-700">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Send Message */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message... (GraphQL mutation)"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sending}
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {sending ? 'Sending...' : 'Send via GraphQL'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">📚 GraphQL Features Demo:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Query: Fetching session data with nested fields (creator, participants, messages)</li>
          <li>✅ Mutation: Sending messages</li>
          <li>✅ Polling: Auto-refresh every 3 seconds</li>
          <li>✅ Type Safety: All data is properly typed</li>
          <li>✅ Efficient: Only fetches needed fields</li>
        </ul>
      </div>
    </div>
  )
}
