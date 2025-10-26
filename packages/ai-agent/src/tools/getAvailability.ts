/**
 * Get Availability Tool - Fetch user's availability windows for scheduling
 */

import {
  Tool,
  GetAvailabilityInputSchema,
  GetAvailabilityOutputSchema,
  GetAvailabilityInput,
  GetAvailabilityOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createGetAvailabilityTool(supabase: SupabaseClient): Tool<GetAvailabilityInput, GetAvailabilityOutput> {
  return {
    name: 'getAvailability',
    description: 'Retrieve a user\'s availability windows for scheduling study sessions. Returns weekly schedule with time blocks.',
    category: 'collaboration',
    inputSchema: GetAvailabilityInputSchema,
    outputSchema: GetAvailabilityOutputSchema,
    estimatedLatencyMs: 200,

    async call(input: GetAvailabilityInput, ctx: AgentContext): Promise<GetAvailabilityOutput> {
      const { targetUserId, dow } = input
      const userId = targetUserId || ctx.userId // Default to current user

      // Build query
      let query = supabase
        .from('availability_block')
        .select('dow, start_min, end_min, timezone')
        .eq('user_id', userId)
        .order('dow', { ascending: true })
        .order('start_min', { ascending: true })

      // Filter by day of week if specified
      if (dow !== undefined) {
        query = query.eq('dow', dow)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to fetch availability: ${error.message}`)
      }

      if (!data) {
        return { windows: [] }
      }

      // Convert minutes to human-readable time
      const windows = data.map(block => {
        const startHour = Math.floor(block.start_min / 60)
        const startMinute = block.start_min % 60
        const endHour = Math.floor(block.end_min / 60)
        const endMinute = block.end_min % 60

        const formatTime = (h: number, m: number) => {
          const period = h >= 12 ? 'PM' : 'AM'
          const hour12 = h % 12 || 12
          return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
        }

        return {
          dow: block.dow,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][block.dow],
          startMin: block.start_min,
          endMin: block.end_min,
          startTime: formatTime(startHour, startMinute),
          endTime: formatTime(endHour, endMinute),
          timezone: block.timezone,
        }
      })

      return { windows }
    },
  }
}
