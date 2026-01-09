/**
 * Key Management Service (KMS)
 * 
 * Provides secure key management for:
 * - 2FA TOTP secrets encryption
 * - Device token signing
 * - Session encryption
 * 
 * SECURITY: In production, consider using AWS KMS, Google Cloud KMS, or HashiCorp Vault
 * This implementation provides a secure local fallback with key rotation support.
 */

import crypto from 'crypto'
import logger from '@/lib/logger'

// ===== CONFIGURATION =====

const ALGORITHM = 'aes-256-gcm' // GCM for authenticated encryption
const KEY_DERIVATION_ITERATIONS = 100000 // PBKDF2 iterations
const SALT_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// Key rotation tracking
interface KeyVersion {
  version: number
  key: Buffer
  createdAt: Date
  expiresAt: Date | null
}

// In-memory key cache (in production, use secure vault)
const keyCache = new Map<string, KeyVersion[]>()

// ===== KEY DERIVATION =====

/**
 * Derive encryption key from master key using PBKDF2
 * This provides additional security by deriving purpose-specific keys
 */
function deriveKey(masterKey: string, purpose: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    `${masterKey}:${purpose}`,
    salt,
    KEY_DERIVATION_ITERATIONS,
    32, // 256 bits
    'sha512'
  )
}

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.KMS_MASTER_KEY
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY or KMS_MASTER_KEY environment variable is required')
  }
  
  if (key.length < 32) {
    throw new Error('Master encryption key must be at least 32 characters')
  }
  
  // Warn about default/weak keys in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    const weakPatterns = [
      'your-32-character-secret-key-here',
      'test-key',
      'development-key',
      '12345678901234567890123456789012',
    ]
    
    if (weakPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
      logger.warn('Using weak or default encryption key - this is insecure for production')
    }
  }
  
  return key
}

// ===== ENCRYPTION/DECRYPTION =====

/**
 * Encrypt data using AES-256-GCM with authenticated encryption
 * 
 * Output format: version:salt:iv:authTag:ciphertext (all hex encoded)
 * 
 * @param plaintext - Data to encrypt
 * @param purpose - Key purpose (e.g., '2fa', 'device-token', 'session')
 * @returns Encrypted string with all components for decryption
 */
export function encrypt(plaintext: string, purpose: string = '2fa'): string {
  const masterKey = getMasterKey()
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(masterKey, purpose, salt)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Version 1 format: v1:salt:iv:authTag:ciphertext
  return `v1:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt data encrypted with encrypt()
 * 
 * @param encryptedData - Data encrypted with encrypt()
 * @param purpose - Key purpose (must match encryption)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string, purpose: string = '2fa'): string {
  const masterKey = getMasterKey()
  
  // Parse the encrypted data format
  const parts = encryptedData.split(':')
  
  // Handle legacy format (v0): iv:ciphertext
  if (parts.length === 2) {
    return decryptLegacy(encryptedData, purpose)
  }
  
  // Handle versioned format
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted data format')
  }
  
  const [, saltHex, ivHex, authTagHex, ciphertext] = parts
  
  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = deriveKey(masterKey, purpose, salt)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Decrypt legacy format (for backward compatibility)
 * Legacy format: iv:ciphertext using AES-256-CBC
 */
function decryptLegacy(encryptedData: string, purpose: string): string {
  const masterKey = getMasterKey()
  const parts = encryptedData.split(':')
  
  if (parts.length !== 2) {
    throw new Error('Invalid legacy encrypted data format')
  }
  
  const [ivHex, ciphertext] = parts
  const iv = Buffer.from(ivHex, 'hex')
  
  // Legacy used simple key derivation
  const key = Buffer.from(masterKey).slice(0, 32)
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Re-encrypt data with current encryption format
 * Use this to migrate legacy encrypted data to new format
 */
export function reencrypt(encryptedData: string, purpose: string = '2fa'): string {
  const plaintext = decrypt(encryptedData, purpose)
  return encrypt(plaintext, purpose)
}

/**
 * Check if data is encrypted with legacy format
 */
export function isLegacyEncryption(encryptedData: string): boolean {
  const parts = encryptedData.split(':')
  return parts.length === 2
}

// ===== KEY ROTATION =====

/**
 * Rotate encryption key (for scheduled key rotation)
 * This should be called during maintenance windows
 * 
 * @param oldData - Array of encrypted data to re-encrypt
 * @param purpose - Key purpose
 * @returns Array of re-encrypted data
 */
export async function rotateKeys(
  oldData: string[],
  purpose: string = '2fa'
): Promise<string[]> {
  const results: string[] = []
  
  for (const data of oldData) {
    try {
      // Decrypt with old key and re-encrypt with new format
      const reencrypted = reencrypt(data, purpose)
      results.push(reencrypted)
    } catch (error) {
      logger.error('Key rotation failed for data', {
        purpose,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Keep original data if rotation fails
      results.push(data)
    }
  }
  
  return results
}

// ===== DEVICE TOKEN SIGNING =====

/**
 * Sign a device token using HMAC-SHA256
 * Used for device session validation
 */
export function signDeviceToken(payload: {
  userId: string
  deviceId: string
  issuedAt: number
  expiresAt: number
}): string {
  const masterKey = getMasterKey()
  const data = JSON.stringify(payload)
  
  const hmac = crypto.createHmac('sha256', masterKey)
  hmac.update(data)
  const signature = hmac.digest('hex')
  
  // Return token as base64 encoded JSON with signature
  const token = Buffer.from(JSON.stringify({
    ...payload,
    sig: signature,
  })).toString('base64url')
  
  return token
}

/**
 * Verify and decode a signed device token
 */
export function verifyDeviceToken(token: string): {
  valid: boolean
  payload?: {
    userId: string
    deviceId: string
    issuedAt: number
    expiresAt: number
  }
  error?: string
} {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    const { sig, ...payload } = decoded
    
    const masterKey = getMasterKey()
    const data = JSON.stringify(payload)
    
    const hmac = crypto.createHmac('sha256', masterKey)
    hmac.update(data)
    const expectedSig = hmac.digest('hex')
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { valid: false, error: 'Invalid signature' }
    }
    
    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'Token expired' }
    }
    
    return { valid: true, payload }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token format'
    }
  }
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash a value using SHA-256 (for non-reversible hashing)
 */
export function hashValue(value: string, salt?: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(salt ? `${salt}:${value}` : value)
  return hash.digest('hex')
}

// ===== HEALTH CHECK =====

/**
 * Verify KMS configuration is valid
 */
export function verifyKMSConfiguration(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    getMasterKey()
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
  }
  
  // Test encryption/decryption
  if (errors.length === 0) {
    try {
      const testData = 'test-encryption-' + Date.now()
      const encrypted = encrypt(testData, 'test')
      const decrypted = decrypt(encrypted, 'test')
      
      if (decrypted !== testData) {
        errors.push('Encryption/decryption round-trip failed')
      }
    } catch (error) {
      errors.push(`Encryption test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Check key strength
  const key = process.env.ENCRYPTION_KEY || process.env.KMS_MASTER_KEY || ''
  if (key.length < 64) {
    warnings.push('Consider using a 64+ character key for enhanced security')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export default {
  encrypt,
  decrypt,
  reencrypt,
  isLegacyEncryption,
  rotateKeys,
  signDeviceToken,
  verifyDeviceToken,
  generateSecureToken,
  hashValue,
  verifyKMSConfiguration,
}
