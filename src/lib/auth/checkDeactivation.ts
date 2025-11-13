import { prisma } from '@/lib/prisma'

/**
 * Check if user account is deactivated
 * @param userId - User ID to check
 * @returns Object with isDeactivated flag and deactivatedAt date if applicable
 */
export async function checkAccountDeactivation(userId: string): Promise<{
  isDeactivated: boolean
  deactivatedAt: Date | null
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      deactivatedAt: true,
    },
  })

  if (!user) {
    return { isDeactivated: false, deactivatedAt: null }
  }

  return {
    isDeactivated: user.deactivatedAt !== null,
    deactivatedAt: user.deactivatedAt,
  }
}
