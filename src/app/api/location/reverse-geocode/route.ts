import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import logger from '@/lib/logger'
import { fetchWithBackoff } from '@/lib/api/timeout'

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * POST /api/location/reverse-geocode
 * Convert coordinates (lat/lng) to address (city, state, country)
 * Uses Google Maps Geocoding API
 */
export async function POST(request: NextRequest) {
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
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid coordinates', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { lat, lng } = validation.data

    // Check for Google Maps API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      logger.error('[Reverse Geocode] GOOGLE_MAPS_API_KEY not configured')
      return NextResponse.json(
        { error: 'Location service not configured' },
        { status: 500 }
      )
    }

    // Call Google Maps Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`

    const geocodeResponse = await fetchWithBackoff(geocodeUrl, {}, { timeoutPerAttemptMs: 8000, maxRetries: 3 })
    const geocodeData = await geocodeResponse.json()

    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      logger.error('[Reverse Geocode] API error', { status: geocodeData.status, message: geocodeData.error_message })
      return NextResponse.json(
        { error: 'Unable to find address for coordinates' },
        { status: 404 }
      )
    }

    // Extract address components from first result
    const result = geocodeData.results[0]
    const components = result.address_components

    let city = ''
    let state = ''
    let country = ''

    for (const component of components) {
      const types = component.types

      // City: locality or administrative_area_level_2
      if (types.includes('locality')) {
        city = component.long_name
      } else if (types.includes('administrative_area_level_2') && !city) {
        city = component.long_name
      }

      // State: administrative_area_level_1
      if (types.includes('administrative_area_level_1')) {
        state = component.long_name
      }

      // Country
      if (types.includes('country')) {
        country = component.long_name
      }
    }

    // Format response
    return NextResponse.json({
      success: true,
      location: {
        city: city || null,
        state: state || null,
        country: country || null,
        formatted_address: result.formatted_address,
      },
    })

  } catch (error) {
    logger.error('[Reverse Geocode] Error', { error })
    return NextResponse.json(
      {
        error: 'Failed to reverse geocode location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
