export const typeDefs = `#graphql
  type User {
    id: String!
    name: String!
    email: String!
    avatarUrl: String
  }

  type Participant {
    id: String!
    userId: String!
    role: String!
    joinedAt: String!
    user: User!
  }

  type Message {
    id: String!
    content: String!
    createdAt: String!
    sender: User!
  }

  type StudySession {
    id: String!
    title: String!
    description: String
    type: String!
    status: String!
    subject: String
    tags: [String!]
    scheduledAt: String
    waitingExpiresAt: String
    startedAt: String
    endedAt: String
    durationMinutes: Int
    agoraChannel: String
    maxParticipants: Int
    createdBy: User!
    participants: [Participant!]!
    messages: [Message!]!
  }

  type Query {
    # Get a specific study session by ID
    getStudySession(sessionId: String!): StudySession

    # Get all study sessions for current user
    getMyStudySessions: [StudySession!]!
  }

  type Mutation {
    # Send a message in a study session
    sendMessage(sessionId: String!, content: String!): Message

    # Create a new study session
    createStudySession(
      title: String!
      description: String
      type: String!
      subject: String
      tags: [String!]
      scheduledAt: String
      durationMinutes: Int
    ): StudySession
  }

  type Subscription {
    # Subscribe to new messages in a study session
    messageAdded(sessionId: String!): Message
  }
`
