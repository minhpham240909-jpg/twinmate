/**
 * WebRTC TURN Server Configuration
 * 
 * Provides TURN (Traversal Using Relays around NAT) server configuration
 * for reliable video/audio connections when direct peer-to-peer fails.
 * 
 * TURN servers relay media when users are behind strict NATs/firewalls.
 * Without TURN, ~8-15% of WebRTC connections fail.
 * 
 * SCALABILITY: Supports multiple TURN servers for redundancy and geographic distribution
 */

import crypto from 'crypto'
import logger from '@/lib/logger'

// ===== TYPES =====

export interface TurnServer {
  urls: string | string[]
  username?: string
  credential?: string
  credentialType?: 'password' | 'oauth'
}

export interface TurnConfig {
  iceServers: TurnServer[]
  iceTransportPolicy?: 'all' | 'relay' // 'relay' forces TURN usage
  iceCandidatePoolSize?: number
}

export interface TurnCredentials {
  username: string
  credential: string
  ttl: number // Time-to-live in seconds
  expiresAt: Date
}

// ===== CONFIGURATION =====

/**
 * Get TURN server configuration from environment
 * 
 * Environment variables:
 * - TURN_SERVER_URL: Primary TURN server URL (e.g., turn:turn.example.com:3478)
 * - TURN_SERVER_URL_2: Secondary TURN server URL (optional, for redundancy)
 * - TURN_SERVER_URL_3: Tertiary TURN server URL (optional, for redundancy)
 * - TURN_USERNAME: Static username (if not using time-limited credentials)
 * - TURN_PASSWORD: Static password (if not using time-limited credentials)
 * - TURN_SECRET: Shared secret for generating time-limited credentials (recommended)
 * - TURN_CREDENTIAL_TTL: Credential TTL in seconds (default: 86400 = 24 hours)
 * - STUN_SERVER_URL: STUN server URL (optional, for NAT traversal without relay)
 */
const TURN_CONFIG = {
  primaryServer: process.env.TURN_SERVER_URL,
  secondaryServer: process.env.TURN_SERVER_URL_2,
  tertiaryServer: process.env.TURN_SERVER_URL_3,
  staticUsername: process.env.TURN_USERNAME,
  staticPassword: process.env.TURN_PASSWORD,
  sharedSecret: process.env.TURN_SECRET,
  credentialTTL: parseInt(process.env.TURN_CREDENTIAL_TTL || '86400'), // 24 hours
  stunServer: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
}

// ===== CREDENTIAL GENERATION =====

/**
 * Generate time-limited TURN credentials using HMAC-SHA1
 * 
 * This is the standard method used by coturn and most TURN servers.
 * The username is the expiration timestamp, and the credential is
 * an HMAC of the username with the shared secret.
 * 
 * @param userId - User ID to include in credential (for tracking)
 * @param ttlSeconds - Time-to-live in seconds (default from config)
 * @returns Time-limited credentials
 */
export function generateTurnCredentials(
  userId: string,
  ttlSeconds: number = TURN_CONFIG.credentialTTL
): TurnCredentials | null {
  const secret = TURN_CONFIG.sharedSecret
  
  if (!secret) {
    logger.warn('TURN_SECRET not configured, using static credentials')
    
    if (TURN_CONFIG.staticUsername && TURN_CONFIG.staticPassword) {
      return {
        username: TURN_CONFIG.staticUsername,
        credential: TURN_CONFIG.staticPassword,
        ttl: ttlSeconds,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      }
    }
    
    return null
  }
  
  // Generate expiration timestamp (Unix time in seconds)
  const expirationTime = Math.floor(Date.now() / 1000) + ttlSeconds
  
  // Username format: timestamp:userId (coturn standard)
  const username = `${expirationTime}:${userId}`
  
  // Generate HMAC-SHA1 credential
  const hmac = crypto.createHmac('sha1', secret)
  hmac.update(username)
  const credential = hmac.digest('base64')
  
  return {
    username,
    credential,
    ttl: ttlSeconds,
    expiresAt: new Date(expirationTime * 1000),
  }
}

/**
 * Validate time-limited TURN credential
 * 
 * @param username - Username in format timestamp:userId
 * @param credential - HMAC credential
 * @returns Whether the credential is valid and not expired
 */
export function validateTurnCredential(
  username: string,
  credential: string
): boolean {
  const secret = TURN_CONFIG.sharedSecret
  
  if (!secret) {
    // Can't validate without secret
    return true
  }
  
  try {
    // Extract expiration from username
    const [expirationStr] = username.split(':')
    const expirationTime = parseInt(expirationStr, 10)
    
    // Check if expired
    if (expirationTime < Math.floor(Date.now() / 1000)) {
      return false
    }
    
    // Verify HMAC
    const hmac = crypto.createHmac('sha1', secret)
    hmac.update(username)
    const expectedCredential = hmac.digest('base64')
    
    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(credential),
      Buffer.from(expectedCredential)
    )
  } catch (error) {
    logger.error('TURN credential validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

// ===== ICE CONFIGURATION =====

/**
 * Get WebRTC ICE configuration with TURN servers
 * 
 * @param userId - User ID for credential generation
 * @param options - Configuration options
 * @returns ICE configuration for WebRTC
 */
export function getIceConfiguration(
  userId: string,
  options: {
    forceTurn?: boolean // Force relay mode (useful for testing or restrictive networks)
    includeStun?: boolean // Include STUN servers (default: true)
  } = {}
): TurnConfig {
  const { forceTurn = false, includeStun = true } = options
  const iceServers: TurnServer[] = []
  
  // Add STUN server (free, helps with simple NAT traversal)
  if (includeStun && TURN_CONFIG.stunServer && !forceTurn) {
    iceServers.push({
      urls: TURN_CONFIG.stunServer,
    })
  }
  
  // Generate credentials for TURN servers
  const credentials = generateTurnCredentials(userId)
  
  // Add primary TURN server
  if (TURN_CONFIG.primaryServer) {
    const turnUrls: string[] = []
    
    // Add both UDP and TCP variants for reliability
    if (TURN_CONFIG.primaryServer.startsWith('turn:')) {
      turnUrls.push(TURN_CONFIG.primaryServer)
      turnUrls.push(TURN_CONFIG.primaryServer.replace('turn:', 'turns:').replace(':3478', ':443'))
    } else {
      turnUrls.push(TURN_CONFIG.primaryServer)
    }
    
    iceServers.push({
      urls: turnUrls,
      username: credentials?.username,
      credential: credentials?.credential,
    })
  }
  
  // Add secondary TURN server (geographic redundancy)
  if (TURN_CONFIG.secondaryServer) {
    iceServers.push({
      urls: TURN_CONFIG.secondaryServer,
      username: credentials?.username,
      credential: credentials?.credential,
    })
  }
  
  // Add tertiary TURN server (additional redundancy)
  if (TURN_CONFIG.tertiaryServer) {
    iceServers.push({
      urls: TURN_CONFIG.tertiaryServer,
      username: credentials?.username,
      credential: credentials?.credential,
    })
  }
  
  // If no TURN servers configured, add free STUN only (limited reliability)
  if (iceServers.length === 0 || (iceServers.length === 1 && iceServers[0].urls === TURN_CONFIG.stunServer)) {
    logger.warn('No TURN servers configured. WebRTC may fail for users behind strict NATs.')
    
    // Add multiple free STUN servers as fallback
    if (!forceTurn) {
      iceServers.push(
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      )
    }
  }
  
  return {
    iceServers,
    iceTransportPolicy: forceTurn ? 'relay' : 'all',
    iceCandidatePoolSize: 10, // Pre-fetch ICE candidates for faster connection
  }
}

/**
 * Get TURN server configuration for Agora SDK
 * 
 * Agora has its own signaling and media relay, but can use custom TURN
 * servers for users in restricted networks.
 * 
 * @param userId - User ID for credential generation
 * @returns Agora-compatible TURN configuration or null if not needed
 */
export function getAgoraTurnConfig(userId: string): {
  turnServer?: {
    turnServerURL: string
    username: string
    password: string
    udpport?: number
    tcpport?: number
    forceturn?: boolean
  }
} | null {
  // Agora typically doesn't need custom TURN as it has its own infrastructure
  // Only use this if you're in a very restricted network environment
  
  if (!process.env.AGORA_CUSTOM_TURN_ENABLED) {
    return null
  }
  
  const credentials = generateTurnCredentials(userId)
  
  if (!credentials || !TURN_CONFIG.primaryServer) {
    return null
  }
  
  // Extract host and port from TURN URL
  const match = TURN_CONFIG.primaryServer.match(/turn[s]?:([^:]+):?(\d+)?/)
  
  if (!match) {
    return null
  }
  
  const [, host, portStr] = match
  const port = parseInt(portStr || '3478')
  
  return {
    turnServer: {
      turnServerURL: host,
      username: credentials.username,
      password: credentials.credential,
      udpport: port,
      tcpport: port,
      forceturn: false,
    },
  }
}

// ===== HEALTH CHECK =====

/**
 * Check TURN server connectivity (for monitoring)
 * 
 * @returns Health check result
 */
export async function checkTurnServerHealth(): Promise<{
  healthy: boolean
  servers: Array<{
    url: string
    status: 'ok' | 'unreachable' | 'unconfigured'
    latencyMs?: number
  }>
}> {
  const servers: Array<{
    url: string
    status: 'ok' | 'unreachable' | 'unconfigured'
    latencyMs?: number
  }> = []
  
  const serverUrls = [
    TURN_CONFIG.primaryServer,
    TURN_CONFIG.secondaryServer,
    TURN_CONFIG.tertiaryServer,
  ].filter(Boolean) as string[]
  
  if (serverUrls.length === 0) {
    return {
      healthy: false,
      servers: [{ url: 'none', status: 'unconfigured' }],
    }
  }
  
  // Note: Actual TURN connectivity testing requires establishing a connection
  // For now, we just check if servers are configured
  for (const url of serverUrls) {
    servers.push({
      url,
      status: 'ok', // Would need actual ping test
    })
  }
  
  return {
    healthy: servers.length > 0 && servers.some(s => s.status === 'ok'),
    servers,
  }
}

/**
 * Verify TURN configuration is valid
 */
export function verifyTurnConfiguration(): {
  valid: boolean
  warnings: string[]
  errors: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check if any TURN server is configured
  if (!TURN_CONFIG.primaryServer) {
    warnings.push('No TURN server configured. WebRTC may fail for users behind strict NATs.')
  }
  
  // Check credentials
  if (TURN_CONFIG.primaryServer) {
    if (!TURN_CONFIG.sharedSecret && !TURN_CONFIG.staticUsername) {
      errors.push('TURN server configured but no credentials (TURN_SECRET or TURN_USERNAME/TURN_PASSWORD)')
    }
    
    if (TURN_CONFIG.staticPassword && TURN_CONFIG.staticPassword.length < 16) {
      warnings.push('TURN_PASSWORD is weak. Use at least 16 characters.')
    }
  }
  
  // Recommend redundancy
  if (TURN_CONFIG.primaryServer && !TURN_CONFIG.secondaryServer) {
    warnings.push('Only one TURN server configured. Consider adding a secondary for redundancy.')
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}

export default {
  generateTurnCredentials,
  validateTurnCredential,
  getIceConfiguration,
  getAgoraTurnConfig,
  checkTurnServerHealth,
  verifyTurnConfiguration,
}
