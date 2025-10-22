import {
  validateRequest,
  validateRequestAsync,
  sendMessageSchema,
  callMessageSchema,
  deleteNotificationSchema,
  createMatchSchema,
  createGroupSchema,
  createStudySessionSchema,
  updateProfileSchema,
  paginationSchema
} from '../validation'

describe('Validation Library', () => {
  describe('validateRequest', () => {
    it('should return success with valid data', () => {
      const schema = sendMessageSchema
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
      }

      const result = validateRequest(schema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('Test message')
      }
    })

    it('should return error with invalid data', () => {
      const schema = sendMessageSchema
      const data = {
        content: '',
        conversationId: 'invalid-uuid',
        conversationType: 'invalid' as const,
      }

      const result = validateRequest(schema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('sendMessageSchema', () => {
    it('should validate correct message data', () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('Test message')
        expect(result.data.conversationId).toBe('550e8400-e29b-41d4-a716-446655440000')
        expect(result.data.conversationType).toBe('partner')
      }
    })

    it('should reject empty content', () => {
      const data = {
        content: '',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Message cannot be empty')
      }
    })

    it('should reject content exceeding max length', () => {
      const data = {
        content: 'a'.repeat(5001),
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Message too long')
      }
    })

    it('should reject invalid UUID format', () => {
      const data = {
        content: 'Test message',
        conversationId: 'invalid-uuid',
        conversationType: 'partner' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid conversation ID')
      }
    })

    it('should reject invalid conversation type', () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'invalid' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(false)
    })

    it('should accept valid group conversation', () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'group' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(true)
    })

    it('should accept optional type field', () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
        type: 'IMAGE' as const,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('IMAGE')
      }
    })

    it('should accept optional file fields', () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
        fileUrl: 'https://example.com/file.pdf',
        fileName: 'document.pdf',
        fileSize: 1024,
      }

      const result = validateRequest(sendMessageSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileUrl).toBe('https://example.com/file.pdf')
        expect(result.data.fileName).toBe('document.pdf')
        expect(result.data.fileSize).toBe(1024)
      }
    })
  })

  describe('callMessageSchema', () => {
    it('should validate correct call data', () => {
      const data = {
        action: 'start' as const,
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
        callType: 'AUDIO' as const,
      }

      const result = validateRequest(callMessageSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.conversationId).toBe('550e8400-e29b-41d4-a716-446655440000')
        expect(result.data.callType).toBe('AUDIO')
      }
    })

    it('should reject invalid call type', () => {
      const data = {
        action: 'start' as const,
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
        callType: 'INVALID' as const,
      }

      const result = validateRequest(callMessageSchema, data)

      expect(result.success).toBe(false)
    })

    it('should accept VIDEO call type', () => {
      const data = {
        action: 'start' as const,
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
        callType: 'VIDEO' as const,
      }

      const result = validateRequest(callMessageSchema, data)

      expect(result.success).toBe(true)
    })
  })

  describe('deleteNotificationSchema', () => {
    it('should validate correct notification deletion data', () => {
      const data = {
        notificationIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
      }

      const result = validateRequest(deleteNotificationSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.notificationIds).toHaveLength(2)
      }
    })

    it('should reject empty array', () => {
      const data = {
        notificationIds: [],
      }

      const result = validateRequest(deleteNotificationSchema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('At least one notification ID required')
      }
    })

    it('should reject non-array input', () => {
      const data = {
        notificationIds: 'not-an-array',
      }

      const result = validateRequest(deleteNotificationSchema, data)

      expect(result.success).toBe(false)
    })
  })

  describe('createMatchSchema', () => {
    it('should validate correct connection request', () => {
      const data = {
        receiverId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Hi, let\'s connect!',
      }

      const result = validateRequest(createMatchSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.receiverId).toBe('550e8400-e29b-41d4-a716-446655440000')
        expect(result.data.message).toBe('Hi, let\'s connect!')
      }
    })

    it('should accept optional message', () => {
      const data = {
        receiverId: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = validateRequest(createMatchSchema, data)

      expect(result.success).toBe(true)
    })

    it('should reject message exceeding max length', () => {
      const data = {
        receiverId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'a'.repeat(501),
      }

      const result = validateRequest(createMatchSchema, data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Message too long')
      }
    })
  })

  describe('validateRequestAsync', () => {
    it('should return success asynchronously', async () => {
      const data = {
        content: 'Test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        conversationType: 'partner' as const,
      }

      const result = await validateRequestAsync(sendMessageSchema, data)

      expect(result.success).toBe(true)
    })

    it('should return error asynchronously', async () => {
      const data = {
        content: '',
        conversationId: 'invalid',
        conversationType: 'partner' as const,
      }

      const result = await validateRequestAsync(sendMessageSchema, data)

      expect(result.success).toBe(false)
    })
  })

  describe('createGroupSchema', () => {
    it('should validate correct group data', () => {
      const data = {
        name: 'Math Study Group',
        description: 'Group for studying mathematics',
        subject: 'Mathematics',
        skillLevel: 'INTERMEDIATE' as const,
        privacy: 'PUBLIC' as const,
        maxMembers: 10,
      }

      const result = validateRequest(createGroupSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Math Study Group')
        expect(result.data.maxMembers).toBe(10)
      }
    })

    it('should reject group with empty name', () => {
      const data = {
        name: '',
        subject: 'Mathematics',
        privacy: 'PUBLIC' as const,
        maxMembers: 10,
      }

      const result = validateRequest(createGroupSchema, data)

      expect(result.success).toBe(false)
    })

    it('should reject group with invalid max members', () => {
      const data = {
        name: 'Test Group',
        subject: 'Math',
        privacy: 'PUBLIC' as const,
        maxMembers: 1, // Less than minimum of 2
      }

      const result = validateRequest(createGroupSchema, data)

      expect(result.success).toBe(false)
    })
  })

  describe('createStudySessionSchema', () => {
    it('should validate correct session data', () => {
      const data = {
        title: 'Study Session',
        description: 'Let\'s study together',
        type: 'GROUP' as const,
        maxParticipants: 5,
      }

      const result = validateRequest(createStudySessionSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Study Session')
        expect(result.data.type).toBe('GROUP')
      }
    })

    it('should accept SOLO session type', () => {
      const data = {
        title: 'Personal Study',
        type: 'SOLO' as const,
        maxParticipants: 1,
      }

      const result = validateRequest(createStudySessionSchema, data)

      expect(result.success).toBe(true)
    })

    it('should accept ONE_ON_ONE session type', () => {
      const data = {
        title: 'Partner Study',
        type: 'ONE_ON_ONE' as const,
        maxParticipants: 2,
      }

      const result = validateRequest(createStudySessionSchema, data)

      expect(result.success).toBe(true)
    })

    it('should reject session with empty title', () => {
      const data = {
        title: '',
        type: 'GROUP' as const,
        maxParticipants: 5,
      }

      const result = validateRequest(createStudySessionSchema, data)

      expect(result.success).toBe(false)
    })
  })

  describe('updateProfileSchema', () => {
    it('should validate profile updates', () => {
      const data = {
        bio: 'Student studying computer science',
        timezone: 'America/New_York',
        location: 'New York, NY',
        subjects: ['Math', 'Computer Science'],
        skillLevel: 'INTERMEDIATE' as const,
        studyStyle: 'COLLABORATIVE' as const,
      }

      const result = validateRequest(updateProfileSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.bio).toBe('Student studying computer science')
        expect(result.data.skillLevel).toBe('INTERMEDIATE')
      }
    })

    it('should accept empty profile update', () => {
      const data = {}

      const result = validateRequest(updateProfileSchema, data)

      expect(result.success).toBe(true)
    })

    it('should reject bio exceeding max length', () => {
      const data = {
        bio: 'a'.repeat(1001),
      }

      const result = validateRequest(updateProfileSchema, data)

      expect(result.success).toBe(false)
    })

    it('should validate latitude and longitude ranges', () => {
      const validData = {
        latitude: 40.7128,
        longitude: -74.0060,
      }

      const result = validateRequest(updateProfileSchema, validData)
      expect(result.success).toBe(true)

      const invalidLatitude = {
        latitude: 100, // Out of range
        longitude: 0,
      }

      const result2 = validateRequest(updateProfileSchema, invalidLatitude)
      expect(result2.success).toBe(false)

      const invalidLongitude = {
        latitude: 0,
        longitude: 200, // Out of range
      }

      const result3 = validateRequest(updateProfileSchema, invalidLongitude)
      expect(result3.success).toBe(false)
    })
  })

  describe('paginationSchema', () => {
    it('should validate pagination parameters', () => {
      const data = {
        page: 1,
        limit: 50,
      }

      const result = validateRequest(paginationSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should use default values', () => {
      const data = {}

      const result = validateRequest(paginationSchema, data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should reject page less than 1', () => {
      const data = {
        page: 0,
        limit: 50,
      }

      const result = validateRequest(paginationSchema, data)

      expect(result.success).toBe(false)
    })

    it('should reject limit exceeding 100', () => {
      const data = {
        page: 1,
        limit: 101,
      }

      const result = validateRequest(paginationSchema, data)

      expect(result.success).toBe(false)
    })
  })
})
