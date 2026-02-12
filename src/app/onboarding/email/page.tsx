'use client'

import { createClient } from '@/lib/supabase/browser'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingStep3() {
  const [inboundAddress, setInboundAddress] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getOrCreateAddress() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if address already exists
      const { data: existing } = await supabase
        .from('email_addresses')
        .select('inbound_address')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setInboundAddress(existing.inbound_address)
        setLoading(false)
        return
      }

      // Generate a new address
      const hash = user.id.replace(/-/g, '').substring(0, 10)
      const address = `leads-${hash}@inbound.clerva.app`

      const { error } = await supabase.from('email_addresses').insert({
        user_id: user.id,
        inbound_address: address,
      })

      if (!error) {
        setInboundAddress(address)
      } else if (error.code === '23505') {
        // Unique constraint — another request already created it, re-fetch
        const { data: refetched } = await supabase
          .from('email_addresses')
          .select('inbound_address')
          .eq('user_id', user.id)
          .single()
        if (refetched) setInboundAddress(refetched.inbound_address)
      }
      setLoading(false)
    }

    getOrCreateAddress()
  }, [supabase])

  async function handleFinish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id)

    router.push('/dashboard')
  }

  function handleCopy() {
    if (inboundAddress) {
      navigator.clipboard.writeText(inboundAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="text-sm text-gray-400 mb-1">Step 3 of 3</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Set Up Email Forwarding
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Forward your inquiry emails to this address. Adecis will score them
        automatically.
      </p>

      {!loading && inboundAddress && (
        <>
          <div className="bg-gray-50 rounded-md p-3 flex items-center justify-between mb-4">
            <code className="text-sm text-gray-800 break-all">
              {inboundAddress}
            </code>
            <button
              onClick={handleCopy}
              className="ml-2 text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="bg-blue-50 rounded-md p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              How to set up forwarding
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>
                Go to your email settings (Gmail, Outlook, etc.)
              </li>
              <li>
                Set up a forwarding rule for your inquiry/contact emails
              </li>
              <li>
                Forward them to the address above
              </li>
              <li>
                That&apos;s it — leads will appear in your dashboard and Slack
              </li>
            </ol>
          </div>
        </>
      )}

      {loading && (
        <div className="text-center py-4 text-gray-400 text-sm">
          Setting up your email address...
        </div>
      )}

      <button
        onClick={handleFinish}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        Finish Setup
      </button>

      <div className="mt-3 text-center">
        <button
          onClick={handleFinish}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Skip — I&apos;ll set this up later
        </button>
      </div>
    </div>
  )
}
