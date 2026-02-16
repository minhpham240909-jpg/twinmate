import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { feedback } = body

  if (!feedback || !['positive', 'negative'].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
  }

  // Update lead
  const { error } = await supabase
    .from('leads')
    .update({ feedback, feedback_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert feedback log
  await supabase.from('feedback_log').insert({
    lead_id: id,
    user_id: user.id,
    feedback,
  })

  return NextResponse.json({ ok: true })
}
