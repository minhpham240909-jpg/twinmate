const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkGroups() {
  try {
    console.log('🔍 Checking all groups in database...\n')

    const allGroups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            messages: true,
            invites: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📊 Total groups in database: ${allGroups.length}\n`)

    if (allGroups.length === 0) {
      console.log('✅ No groups found in database - all deletions worked!')
    } else {
      console.log('📋 Groups found:\n')
      allGroups.forEach((group, index) => {
        console.log(`${index + 1}. "${group.name}"`)
        console.log(`   ID: ${group.id}`)
        console.log(`   Owner: ${group.ownerId}`)
        console.log(`   Created: ${group.createdAt.toISOString()}`)
        console.log(`   Members: ${group._count.members}`)
        console.log(`   Messages: ${group._count.messages}`)
        console.log(`   Invites: ${group._count.invites}`)
        console.log('')
      })
    }

    // Check for orphaned group members
    const orphanedMembers = await prisma.groupMember.findMany({
      where: {
        group: null
      }
    })

    if (orphanedMembers.length > 0) {
      console.log(`⚠️  WARNING: Found ${orphanedMembers.length} orphaned group members!`)
    } else {
      console.log('✅ No orphaned group members')
    }

    // Check for orphaned invites
    const orphanedInvites = await prisma.groupInvite.findMany({
      where: {
        group: null
      }
    })

    if (orphanedInvites.length > 0) {
      console.log(`⚠️  WARNING: Found ${orphanedInvites.length} orphaned group invites!`)
    } else {
      console.log('✅ No orphaned group invites')
    }

  } catch (error) {
    console.error('❌ Error checking groups:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkGroups()
