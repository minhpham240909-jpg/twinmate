import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const twoFactorSchema = z.object({
  action: z.enum(['enable', 'disable', 'verify']),
  code: z.string().optional(),
})

// Encryption helpers (basic encryption - in production use a proper KMS)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-cbc'

// Validate encryption key at startup
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for 2FA')
  }
  if (ENCRYPTION_KEY === 'your-32-character-secret-key-here!' || ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters and not the default value')
  }
  return Buffer.from(ENCRYPTION_KEY).slice(0, 32)
}

function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const key = getEncryptionKey()
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

// Generate backup codes
function generateBackupCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(code)
  }
  return codes
}

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit 2FA operations (auth preset - sensitive security operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const validation = twoFactorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { action, code } = validation.data

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (action === 'enable') {
      // Step 1: Generate TOTP secret and QR code
      const secret = authenticator.generateSecret()
      const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Clerva'
      const otpauthUrl = authenticator.keyuri(dbUser.email, appName, secret)

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

      // Store the secret temporarily (encrypted) - will be confirmed in verify step
      // For now, we'll store it in the session or return it to be verified
      // Best practice: Store in a temporary table with expiration

      // Encrypt the secret before storing
      const encryptedSecret = encrypt(secret)

      // Update user with pending 2FA secret (not enabled yet)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: encryptedSecret,
          // Don't enable yet - will enable after verification
        },
      })

      return NextResponse.json({
        success: true,
        message: '2FA setup initiated. Please scan the QR code with your authenticator app.',
        qrCode: qrCodeDataUrl,
        secret: secret, // Send plaintext secret for manual entry (user should never store this)
        manualEntryKey: secret.match(/.{1,4}/g)?.join(' '), // Formatted for easier manual entry
      })
    } else if (action === 'verify') {
      // Step 2: Verify the TOTP code to enable 2FA
      if (!code) {
        return NextResponse.json(
          { error: 'Verification code is required' },
          { status: 400 }
        )
      }

      if (!dbUser.twoFactorSecret) {
        return NextResponse.json(
          { error: '2FA setup not initiated. Please start the setup process first.' },
          { status: 400 }
        )
      }

      // Decrypt the secret
      const decryptedSecret = decrypt(dbUser.twoFactorSecret)

      // Verify the TOTP code
      const isValid = authenticator.verify({
        token: code,
        secret: decryptedSecret,
      })

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid verification code. Please try again.' },
          { status: 400 }
        )
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes(8)

      // Hash backup codes before storing (like passwords)
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 10))
      )

      // Enable 2FA and store hashed backup codes
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorBackupCodes: hashedBackupCodes,
        },
      })

      return NextResponse.json({
        success: true,
        message: '2FA enabled successfully! Please save your backup codes in a safe place.',
        backupCodes: backupCodes, // Return plaintext codes only once for user to save
      })
    } else if (action === 'disable') {
      // Verify with code before disabling
      if (!code) {
        return NextResponse.json(
          { error: 'Verification code is required to disable 2FA' },
          { status: 400 }
        )
      }

      if (!dbUser.twoFactorEnabled || !dbUser.twoFactorSecret) {
        return NextResponse.json(
          { error: '2FA is not enabled on your account' },
          { status: 400 }
        )
      }

      // Decrypt the secret
      const decryptedSecret = decrypt(dbUser.twoFactorSecret)

      // Check if code is a valid TOTP code
      const isValidTOTP = authenticator.verify({
        token: code,
        secret: decryptedSecret,
      })

      // Check if code is a backup code by comparing hashes
      let matchedBackupCodeIndex = -1
      if (!isValidTOTP) {
        for (let i = 0; i < dbUser.twoFactorBackupCodes.length; i++) {
          const isMatch = await bcrypt.compare(
            code.toUpperCase(),
            dbUser.twoFactorBackupCodes[i]
          )
          if (isMatch) {
            matchedBackupCodeIndex = i
            break
          }
        }
      }

      const isBackupCode = matchedBackupCodeIndex !== -1

      if (!isValidTOTP && !isBackupCode) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        )
      }

      // If backup code was used, remove it
      let updatedBackupCodes = dbUser.twoFactorBackupCodes
      if (isBackupCode) {
        updatedBackupCodes = dbUser.twoFactorBackupCodes.filter(
          (_, index) => index !== matchedBackupCodeIndex
        )
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: updatedBackupCodes,
        },
      })

      return NextResponse.json({
        success: true,
        message: '2FA disabled successfully',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('2FA error:', error)

    // Check for specific error types
    if (error instanceof Error) {
      // Check for encryption key issues
      if (error.message.includes('ENCRYPTION_KEY')) {
        return NextResponse.json(
          { error: 'Server configuration error: 2FA encryption not properly configured. Please contact support.' },
          { status: 500 }
        )
      }

      // Return more specific error in development
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          { error: `2FA Error: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process 2FA request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit 2FA status check (lenient - read operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get 2FA status from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      enabled: dbUser.twoFactorEnabled,
      backupCodesRemaining: dbUser.twoFactorBackupCodes.length,
    })
  } catch (error) {
    console.error('Get 2FA status error:', error)
    return NextResponse.json(
      { error: 'Failed to get 2FA status' },
      { status: 500 }
    )
  }
}
