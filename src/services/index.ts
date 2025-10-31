/**
 * Service Layer Index
 * 
 * Central export point for all services
 * Services provide a consistent interface to database operations
 * with built-in retry logic, error handling, and performance tracking
 */

// Base service and types
export { 
  DatabaseService,
  ServiceError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  toServiceResult,
  type ServiceResult,
  type RetryOptions,
} from './base.service'

// Auth service
export { AuthService, authService, type SignUpData, type SignInData, type AuthResult, type UserProfile } from './auth.service'

// TODO: Add more services as they're created
// export { UserService, userService } from './user.service'
// export { SessionService, sessionService } from './session.service'
// export { MessageService, messageService } from './message.service'

