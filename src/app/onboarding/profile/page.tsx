'use client'

import { createClient } from '@/lib/supabase/browser'
import { NICHES, TONES } from '@/lib/constants'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingStep2() {
  const [businessName, setBusinessName] = useState('')
  const [niche, setNiche] = useState('')
  const [tone, setTone] = useState('professional')
  const [bookingLink, setBookingLink] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const safeBookingLink = bookingLink && /^https?:\/\//i.test(bookingLink) ? bookingLink.slice(0, 500) : null

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        business_name: businessName.slice(0, 200) || null,
        niche: niche || null,
        tone,
        booking_link: safeBookingLink,
        custom_instructions: customInstructions.slice(0, 500) || null,
        onboarding_step: 3,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to save profile')
      setLoading(false)
      return
    }

    router.push('/onboarding/email')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="text-sm text-gray-400 mb-1">Step 2 of 3</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Your Business Profile
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        This helps the AI write better replies that match your voice.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business name
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Pixel Studio"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            What do you do? *
          </label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select your niche</option>
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reply tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Booking link
          </label>
          <input
            type="url"
            value={bookingLink}
            onChange={(e) => setBookingLink(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. https://cal.com/you/30min"
          />
          <p className="text-xs text-gray-400 mt-1">
            The AI will include this in suggested replies for high-intent leads.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anything else the AI should know?
          </label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="e.g. We specialize in Shopify stores. Minimum project is $2,000."
          />
          <p className="text-xs text-gray-400 mt-1">
            {customInstructions.length}/500 characters
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  )
}
