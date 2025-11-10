'use client'

import { useState, useEffect } from 'react'

interface LocationData {
  city: string
  state: string
  country: string
  lat: number | null
  lng: number | null
  visibility: 'private' | 'match-only' | 'public'
}

interface LocationFormProps {
  initialLocation?: Partial<LocationData>
  onLocationChange?: (location: LocationData) => void
}

export function LocationForm({ initialLocation, onLocationChange }: LocationFormProps) {
  const [locationData, setLocationData] = useState<LocationData>({
    city: initialLocation?.city || '',
    state: initialLocation?.state || '',
    country: initialLocation?.country || '',
    lat: initialLocation?.lat || null,
    lng: initialLocation?.lng || null,
    visibility: initialLocation?.visibility || 'match-only',
  })

  const [isDetecting, setIsDetecting] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Notify parent of changes
  useEffect(() => {
    if (onLocationChange) {
      onLocationChange(locationData)
    }
  }, [locationData, onLocationChange])

  // Auto-detect location using browser geolocation
  const handleAutoDetect = async () => {
    setIsDetecting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser')
      }

      // Get current position
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords

          try {
            // Reverse geocode to get address
            const response = await fetch('/api/location/reverse-geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
            })

            if (!response.ok) {
              throw new Error('Failed to get address from coordinates')
            }

            const data = await response.json()

            if (data.success && data.location) {
              setLocationData({
                city: data.location.city || '',
                state: data.location.state || '',
                country: data.location.country || '',
                lat: latitude,
                lng: longitude,
                visibility: locationData.visibility,
              })
              setSuccessMessage('Location detected successfully!')
            } else {
              throw new Error('Could not determine your location')
            }
          } catch (error) {
            console.error('Reverse geocode error:', error)
            setErrorMessage('Could not get address from your location. Please enter manually.')
          } finally {
            setIsDetecting(false)
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
          let message = 'Could not detect your location. '
          if (error.code === error.PERMISSION_DENIED) {
            message += 'Please allow location access and try again.'
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message += 'Location information is unavailable.'
          } else if (error.code === error.TIMEOUT) {
            message += 'Request timed out. Please try again.'
          }
          setErrorMessage(message)
          setIsDetecting(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    } catch (error) {
      console.error('Auto-detect error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to detect location')
      setIsDetecting(false)
    }
  }

  // Geocode manual address input to get coordinates
  const handleManualInputBlur = async () => {
    const { city, state, country } = locationData

    // Skip if all fields are empty
    if (!city && !state && !country) {
      setLocationData({ ...locationData, lat: null, lng: null })
      return
    }

    setIsGeocoding(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/location/forward-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, country }),
      })

      if (!response.ok) {
        throw new Error('Failed to geocode address')
      }

      const data = await response.json()

      if (data.success && data.location) {
        setLocationData({
          ...locationData,
          city: data.location.city || city,
          state: data.location.state || state,
          country: data.location.country || country,
          lat: data.location.lat,
          lng: data.location.lng,
        })

        if (data.location.geocoded) {
          setSuccessMessage('Address verified!')
        }
      }
    } catch (error) {
      console.error('Forward geocode error:', error)
      // Don't show error to user - text-only matching will still work
    } finally {
      setIsGeocoding(false)
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Location (Optional)
        </h3>
        <p className="text-sm text-gray-600">
          Location helps you find study partners nearby or in the same school. You can change this anytime.
        </p>
      </div>

      {/* Auto-Detect Button */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAutoDetect}
          disabled={isDetecting}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDetecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Detecting location...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Use my current location (recommended)
            </>
          )}
        </button>
        <p className="text-xs text-gray-500">
          Or fill in the fields below manually
        </p>
      </div>

      {/* Manual Input Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City
          </label>
          <input
            type="text"
            value={locationData.city}
            onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
            onBlur={handleManualInputBlur}
            placeholder="e.g., Boston"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            State / Region
          </label>
          <input
            type="text"
            value={locationData.state}
            onChange={(e) => setLocationData({ ...locationData, state: e.target.value })}
            onBlur={handleManualInputBlur}
            placeholder="e.g., Massachusetts"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <input
            type="text"
            value={locationData.country}
            onChange={(e) => setLocationData({ ...locationData, country: e.target.value })}
            onBlur={handleManualInputBlur}
            placeholder="e.g., United States"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Status Messages */}
      {isGeocoding && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Verifying address...
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Coordinates indicator (for debugging / confirmation) */}
      {locationData.lat && locationData.lng && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Coordinates saved for proximity matching
        </div>
      )}
    </div>
  )
}
