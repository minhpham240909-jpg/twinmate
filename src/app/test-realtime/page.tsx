'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { subscribeToMessages, subscribeToPresence, broadcastPresence } from '@/lib/supabase/realtime'

interface TestMessage {
  id: string
  content: string
  sender: string
  timestamp: string
  createdAt: string
}

interface OnlineUser {
  userId: string
  name: string
  status: string
}

export default function TestRealtimePage() {
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [username, setUsername] = useState('')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Subscribe to presence (who's online)
    const unsubscribePresence = subscribeToPresence('test-room', (presenceState) => {
      const users = Object.values(presenceState).flat() as OnlineUser[]
      setOnlineUsers(users)
    })

    return () => {
      unsubscribePresence()
    }
  }, [])

  const joinRoom = () => {
    if (!username) return

    // Broadcast your presence
    const channel = broadcastPresence('test-room', {
      userId: Math.random().toString(36).substring(7),
      name: username,
      status: 'online',
    })

    setIsConnected(true)
  }

  const sendTestMessage = async () => {
    if (!newMessage || !username) return

    const supabase = createClient()

    // Insert a test message into the database
    const { data, error } = await supabase
      .from('Message')
      .insert({
        content: newMessage,
        type: 'TEXT',
        senderId: 'test-user-id',
        groupId: 'test-group',
      })
      .select()
      .single()

    if (error) {
      console.error('Error sending message:', error)
      alert(`Error: ${error.message}`)
    } else {
      console.log('Message sent:', data)
      setMessages([...messages, data])
      setNewMessage('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔴 Real-time Database Test
          </h1>

          {/* Connection Status */}
          <div className={`p-4 rounded-lg mb-6 ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className={`font-semibold ${isConnected ? 'text-green-800' : 'text-yellow-800'}`}>
              {isConnected ? '✅ Connected to Realtime' : '⚠️ Not Connected'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Database: Supabase PostgreSQL (REAL)
            </p>
          </div>

          {/* Join Room */}
          {!isConnected && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name to join
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
                <button
                  onClick={joinRoom}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Join Room
                </button>
              </div>
            </div>
          )}

          {/* Online Users */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              👥 Online Users ({onlineUsers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {onlineUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">No users online yet</p>
              ) : (
                onlineUsers.map((user, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-2"
                  >
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {user.name}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Send Test Message */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              💬 Send Test Message
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
                disabled={!username}
              />
              <button
                onClick={sendTestMessage}
                disabled={!username || !newMessage}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            {!username && (
              <p className="text-sm text-gray-500 mt-2">Enter your name above to send messages</p>
            )}
          </div>

          {/* Messages */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              📨 Messages ({messages.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages yet. Send one above!</p>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{msg.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">📝 Test Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Enter your name and click &quot;Join Room&quot;</li>
              <li>Open this page in another browser tab</li>
              <li>You&apos;ll see yourself appear in &quot;Online Users&quot;</li>
              <li>Send a message - it will be saved to your REAL Supabase database</li>
              <li>Check your Supabase dashboard to see the data!</li>
            </ol>
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ← Back to Home
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}