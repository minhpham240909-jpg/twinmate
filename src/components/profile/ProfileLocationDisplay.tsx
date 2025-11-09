'use client'

interface ProfileLocationDisplayProps {
  city?: string | null
  state?: string | null
  country?: string | null
  visibility?: string | null
  className?: string
}

export function ProfileLocationDisplay({
  city,
  state,
  country,
  visibility,
  className = '',
}: ProfileLocationDisplayProps) {
  // Only show if visibility is 'public' and at least one field has data
  if (visibility !== 'public' || (!city && !state && !country)) {
    return null
  }

  // Build location string
  const locationParts = [city, state, country].filter(Boolean)
  const locationString = locationParts.join(', ')

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <span>{locationString}</span>
    </div>
  )
}
