import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

interface ConversationResult {
  id: string
  name: string
  type: 'dm' | 'group'
  avatarUrl: string | null
  lastMessage?: string
  lastMessageAt?: string
}

interface MessageResult {
  id: string
  content: string
  conversationId: string
  conversationName: string
  conversationType: 'dm' | 'group'
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  createdAt: string
}

interface SearchResponse {
  conversations: ConversationResult[]
  messages: MessageResult[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    // Require at least 2 characters
    if (!query || query.trim().length < 2) {
      return NextResponse.json<SearchResponse>({
        conversations: [],
        messages: [],
      })
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchTerm = query.trim()

    // Search conversations (DMs and Groups)
    // For DMs: Search by other user's name
    // For Groups: Search by group name
    const conversationsPromise = searchConversations(supabase, user.id, searchTerm)

    // Search message content using full-text search
    const messagesPromise = searchMessages(supabase, user.id, searchTerm)

    // Execute both queries in parallel for performance
    const [conversations, messages] = await Promise.all([
      conversationsPromise,
      messagesPromise,
    ])

    return NextResponse.json<SearchResponse>({
      conversations,
      messages,
    })
  } catch (error) {
    logger.error('Search error:', { error:  error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function searchConversations(
  supabase: any,
  userId: string,
  searchTerm: string
): Promise<ConversationResult[]> {
  // Search DM conversations by user name
  const { data: dmConversations, error: dmError } = await supabase
    .from('Message')
    .select(
      `
      id,
      recipientId,
      senderId,
      content,
      createdAt,
      sender:User!Message_senderId_fkey(id, name, avatarUrl),
      recipient:User!Message_recipientId_fkey(id, name, avatarUrl)
    `
    )
    .or(`senderId.eq.${userId},recipientId.eq.${userId}`)
    .not('recipientId', 'is', null)
    .order('createdAt', { ascending: false })
    .limit(100) // Get recent DMs to filter by name

  if (dmError) {
    logger.error('DM search error:', { error:  dmError })
    return []
  }

  // Search group conversations by name
  const { data: groupConversations, error: groupError } = await supabase
    .from('StudyGroup')
    .select(
      `
      id,
      name,
      avatarUrl,
      members:GroupMember!inner(userId)
    `
    )
    .ilike('name', `%${searchTerm}%`)
    .contains('members', [{ userId }])
    .order('createdAt', { ascending: false })
    .limit(5)

  if (groupError) {
    logger.error('Group search error:', { error:  groupError })
  }

  // Process DM conversations - group by conversation partner
  const dmMap = new Map<string, ConversationResult>()

  if (dmConversations) {
    for (const msg of dmConversations) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId
      const partner = msg.senderId === userId ? msg.recipient : msg.sender

      if (!partner || !partner.name) continue

      // Filter by name match
      if (!partner.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        continue
      }

      if (!dmMap.has(partnerId)) {
        dmMap.set(partnerId, {
          id: partnerId,
          name: partner.name,
          type: 'dm',
          avatarUrl: partner.avatarUrl,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
        })
      }
    }
  }

  // Combine and limit results
  const dmResults = Array.from(dmMap.values()).slice(0, 5)
  const groupResults: ConversationResult[] =
    groupConversations?.map((group: any) => ({
      id: group.id,
      name: group.name,
      type: 'group' as const,
      avatarUrl: group.avatarUrl,
    })) || []

  // Combine and return top 5 total
  return [...dmResults, ...groupResults].slice(0, 5)
}

async function searchMessages(
  supabase: any,
  userId: string,
  searchTerm: string
): Promise<MessageResult[]> {
  // Use PostgreSQL full-text search for message content
  // RLS SECURITY: The Message table has RLS policies that automatically filter messages to only show:
  // - Messages sent by the user
  // - Messages received by the user (DMs)
  // - Group messages where user is a member
  // No manual filtering needed - RLS handles security automatically!

  // Search messages using full-text search with automatic RLS filtering
  const { data: messages, error } = await supabase
    .from('Message')
    .select(
      `
      id,
      content,
      senderId,
      recipientId,
      groupId,
      createdAt,
      sender:User!Message_senderId_fkey(id, name, avatarUrl),
      recipient:User!Message_recipientId_fkey(id, name, avatarUrl),
      group:StudyGroup(id, name)
    `
    )
    .textSearch('content', searchTerm, {
      type: 'websearch',
      config: 'english',
    })
    .order('createdAt', { ascending: false })
    .limit(5)

  if (error) {
    logger.error('Message search error:', { error:  error })
    return []
  }

  if (!messages) return []

  // Format results with conversation information
  const results: MessageResult[] = messages.map((msg: any) => {
    let conversationId: string
    let conversationName: string
    let conversationType: 'dm' | 'group'

    if (msg.groupId) {
      // Group message
      conversationId = msg.groupId
      conversationName = msg.group?.name || 'Unknown Group'
      conversationType = 'group'
    } else {
      // DM message - determine conversation partner
      const isUserSender = msg.senderId === userId
      conversationId = isUserSender ? msg.recipientId : msg.senderId

      // Get conversation partner name from already-fetched data
      if (isUserSender) {
        conversationName = msg.recipient?.name || 'Unknown User'
      } else {
        conversationName = msg.sender?.name || 'Unknown User'
      }

      conversationType = 'dm'
    }

    return {
      id: msg.id,
      content: msg.content,
      conversationId,
      conversationName,
      conversationType,
      senderId: msg.senderId,
      senderName: msg.sender?.name || 'Unknown',
      senderAvatarUrl: msg.sender?.avatarUrl || null,
      createdAt: msg.createdAt,
    }
  })

  return results
}
