/**
 * Application Startup Script
 * Run validations and initializations before app starts
 */

import { validateOrExit, getEnvironmentInfo } from './env-validator'
import logger from './logger'

/**
 * Run all startup checks
 */
export function runStartupChecks() {
  logger.info('🚀 Starting Clerva application...')
  
  // 1. Validate environment variables
  validateOrExit()
  
  // 2. Log environment info
  const envInfo = getEnvironmentInfo()
  logger.info('Environment configuration:', envInfo)
  
  // 3. Check critical services
  if (!envInfo.hasDatabase) {
    logger.error('❌ Database not configured')
  }
  
  if (!envInfo.hasSupabase) {
    logger.error('❌ Supabase not configured')
  }
  
  if (!envInfo.hasEmail && process.env.NODE_ENV === 'production') {
    logger.warn('⚠️  Email service not configured - notifications will not be sent')
  }
  
  if (!envInfo.hasRedis && process.env.NODE_ENV === 'production') {
    logger.warn('⚠️  Redis not configured - rate limiting will use memory (not recommended for production)')
  }
  
  logger.info('✅ Startup checks complete')
}

// Run on import in API routes
if (typeof window === 'undefined') {
  // Only run on server side
  runStartupChecks()
}
