import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import logger from '@/lib/logger'

const requestSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(), // Full address string as fallback
})

/**
 * POST /api/location/forward-geocode
 * Convert address text to coordinates (lat/lng)
 * Uses Google Maps Geocoding API
 * For manual entry: User types city/state/country → we get coordinates for matching
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
        { error: 'Invalid address data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { city, state, country, address } = validation.data

    // Build address string for geocoding
    let addressString = address || ''

    if (!addressString) {
      const parts = [city, state, country].filter(Boolean)
      if (parts.length === 0) {
        return NextResponse.json(
          { error: 'At least one address component is required' },
          { status: 400 }
        )
      }
      addressString = parts.join(', ')
    }

    // Check for Google Maps API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      logger.error('[Forward Geocode] GOOGLE_MAPS_API_KEY not configured')
      // Return success with null coordinates - text-only matching will be used
      return NextResponse.json({
        success: true,
        location: {
          lat: null,
          lng: null,
          city: city || null,
          state: state || null,
          country: country || null,
          formatted_address: addressString,
          geocoded: false,
        },
      })
    }

    // Call Google Maps Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${apiKey}`

    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = await geocodeResponse.json()

    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      logger.warn('[Forward Geocode] Could not geocode:', { data: { arg2: addressString, arg3: 'Status:', arg4: geocodeData.status } })

      // Return success with null coordinates - text-only matching will be used
      return NextResponse.json({
        success: true,
        location: {
          lat: null,
          lng: null,
          city: city || null,
          state: state || null,
          country: country || null,
          formatted_address: addressString,
          geocoded: false,
        },
      })
    }

    // Extract coordinates and normalized address components
    const result = geocodeData.results[0]
    const { lat, lng } = result.geometry.location
    const components = result.address_components

    let normalizedCity = city || ''
    let normalizedState = state || ''
    let normalizedCountry = country || ''

    for (const component of components) {
      const types = component.types

      // City: locality or administrative_area_level_2
      if (types.includes('locality')) {
        normalizedCity = component.long_name
      } else if (types.includes('administrative_area_level_2') && !normalizedCity) {
        normalizedCity = component.long_name
      }

      // State: administrative_area_level_1
      if (types.includes('administrative_area_level_1')) {
        normalizedState = component.long_name
      }

      // Country
      if (types.includes('country')) {
        normalizedCountry = component.long_name
      }
    }

    return NextResponse.json({
      success: true,
      location: {
        lat,
        lng,
        city: normalizedCity || null,
        state: normalizedState || null,
        country: normalizedCountry || null,
        formatted_address: result.formatted_address,
        geocoded: true,
      },
    })

  } catch (error) {
    logger.error('[Forward Geocode] Error:', { error:  error })

    // Return graceful fallback - text-only matching will be used
    const { city, state, country } = await request.json()
    return NextResponse.json({
      success: true,
      location: {
        lat: null,
        lng: null,
        city: city || null,
        state: state || null,
        country: country || null,
        formatted_address: [city, state, country].filter(Boolean).join(', '),
        geocoded: false,
      },
    })
  }
}
