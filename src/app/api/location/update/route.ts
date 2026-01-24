import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import logger from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const updateLocationSchema = z.object({
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  visibility: z.enum(['private', 'match-only', 'public']).default('match-only'),
})

/**
 * POST /api/location/update
 * Update user's location information
 * Normalizes text, stores coordinates, sets visibility
 */
export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit location updates (moderate preset)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validation = updateLocationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid location data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { city, state, country, lat, lng, visibility } = validation.data

    // Normalize text fields (capitalize properly)
    const normalizeLocation = (text: string | null | undefined): string | null => {
      if (!text) return null
      return text
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }

    const normalizedCity = normalizeLocation(city || null)
    const normalizedState = normalizeLocation(state || null)
    const normalizedCountry = normalizeLocation(country || null)

    // Update profile in database
    const { data: profile, error: updateError } = await supabase
      .from('Profile')
      .update({
        location_city: normalizedCity,
        location_state: normalizedState,
        location_country: normalizedCountry,
        location_lat: lat || null,
        location_lng: lng || null,
        location_visibility: visibility,
        location_last_updated: new Date().toISOString(),
      })
      .eq('userId', user.id)
      .select()
      .single()

    if (updateError) {
      logger.error('[Update Location] Database error:', { error:  updateError })
      return NextResponse.json(
        { error: 'Failed to update location', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      location: {
        city: normalizedCity,
        state: normalizedState,
        country: normalizedCountry,
        lat: lat || null,
        lng: lng || null,
        visibility,
        lastUpdated: profile.location_last_updated,
      },
    })

  } catch (error) {
    logger.error('[Update Location] Error:', { error:  error })
    return NextResponse.json(
      {
        error: 'Failed to update location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/location/update
 * Get current user's location information
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Fetch user's location from profile
    const { data: profile, error: fetchError } = await supabase
      .from('Profile')
      .select('location_city, location_state, location_country, location_lat, location_lng, location_visibility, location_last_updated')
      .eq('userId', user.id)
      .single()

    if (fetchError) {
      logger.error('[Get Location] Database error:', { error:  fetchError })
      return NextResponse.json(
        { error: 'Failed to fetch location', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      location: {
        city: profile.location_city,
        state: profile.location_state,
        country: profile.location_country,
        lat: profile.location_lat,
        lng: profile.location_lng,
        visibility: profile.location_visibility || 'match-only',
        lastUpdated: profile.location_last_updated,
      },
    })

  } catch (error) {
    logger.error('[Get Location] Error:', { error:  error })
    return NextResponse.json(
      {
        error: 'Failed to fetch location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
