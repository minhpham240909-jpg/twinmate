import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'

const twoFactorSchema = z.object({
  action: z.enum(['enable', 'disable', 'verify']),
  code: z.string().optional(),
})

// Encryption helpers (basic encryption - in production use a proper KMS)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!'
const ALGORITHM = 'aes-256-cbc'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY).slice(0, 32), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY).slice(0, 32), iv)
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
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
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

      // Enable 2FA and store backup codes
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorBackupCodes: backupCodes, // Store plaintext backup codes
        },
      })

      return NextResponse.json({
        success: true,
        message: '2FA enabled successfully! Please save your backup codes in a safe place.',
        backupCodes: backupCodes,
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

      // Check if code is a backup code
      const isBackupCode = dbUser.twoFactorBackupCodes.includes(code.toUpperCase())

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
          (c) => c !== code.toUpperCase()
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
    return NextResponse.json(
      { error: 'Failed to process 2FA request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
