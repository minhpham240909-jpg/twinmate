import { verifySlackSignature } from '@/lib/slack/verify'
import { createSlackClient } from '@/lib/slack/client'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verifySlackSignature(request.headers, rawBody)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // Slack sends interactions as URL-encoded form data with a "payload" field
  const params = new URLSearchParams(rawBody)
  const payloadStr = params.get('payload')
  if (!payloadStr) {
    return new Response('Missing payload', { status: 400 })
  }

  const payload = JSON.parse(payloadStr)

  if (payload.type === 'block_actions' && payload.actions?.length > 0) {
    const action = payload.actions[0]
    const actionId = action.action_id
    const leadId = action.value

    if (!leadId) return new Response('OK', { status: 200 })

    const isPositive = actionId === 'feedback_positive'
    const feedback = isPositive ? 'positive' : 'negative'

    const supabase = createAdminClient()

    // Single query to get user_id and bot_token
    const teamId = payload.team?.id
    const { data: installation } = await supabase
      .from('slack_installations')
      .select('user_id, bot_token')
      .eq('team_id', teamId)
      .single()

    if (!installation) return new Response('OK', { status: 200 })

    // Update the lead
    await supabase
      .from('leads')
      .update({ feedback, feedback_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('user_id', installation.user_id)

    // Insert feedback log
    await supabase.from('feedback_log').insert({
      lead_id: leadId,
      user_id: installation.user_id,
      feedback,
    })

    // Update the original Slack message to show acknowledgment
    try {
      const slack = createSlackClient(installation.bot_token)

      const originalBlocks = payload.message?.blocks || []
      const updatedBlocks = originalBlocks.filter(
        (b: { type: string }) => b.type !== 'actions'
      )
      updatedBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: isPositive
              ? ':white_check_mark: Marked as helpful'
              : ':pencil2: Marked as not helpful — we\'ll improve',
          },
        ],
      })

      await slack.chat.update({
        channel: payload.channel?.id,
        ts: payload.message?.ts,
        blocks: updatedBlocks,
        text: 'Feedback recorded',
      })
    } catch (err) {
      console.error('Failed to update Slack message:', err)
    }
  }

  return new Response('OK', { status: 200 })
}
