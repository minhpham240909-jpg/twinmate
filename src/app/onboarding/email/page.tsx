'use client'

import { createClient } from '@/lib/supabase/browser'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingStep3() {
  const [inboundAddress, setInboundAddress] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getOrCreateAddress() {
      try {
        const res = await fetch('/api/email/setup', { method: 'POST' })
        const data = await res.json()

        if (!res.ok) {
          console.error('Email setup error:', data.error)
          setError('Could not generate your email address. You can skip this step and set it up later in Settings.')
        } else if (data.address) {
          setInboundAddress(data.address)
        } else {
          setError('Could not generate your email address. You can skip this step and set it up later in Settings.')
        }
      } catch (err) {
        console.error('Email setup error:', err)
        setError('Something went wrong. You can skip this step and set it up later in Settings.')
      }
      setLoading(false)
    }

    getOrCreateAddress()
  }, [])

  async function handleFinish() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setLoading(false)
      setError('Session expired. Please log in again.')
      return
    }

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', session.user.id)

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
        Forward your inquiry emails to this address. Clerva will score them
        automatically.
      </p>

      {loading && (
        <div className="text-center py-4 text-gray-400 text-sm">
          Setting up your email address...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

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
            <h3 className="text-sm font-medium text-blue-900 mb-3">
              How to set up forwarding
            </h3>

            <div className="mb-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">Gmail</p>
              <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
                <li>Go to Settings → Forwarding and POP/IMAP</li>
                <li>Click &quot;Add a forwarding address&quot;</li>
                <li>Paste your Clerva email address above</li>
                <li>Gmail will send a confirmation email to your Clerva address — it will appear as a lead on your dashboard</li>
                <li>Open that lead, find the long confirmation link in the message, and open it in a new browser tab</li>
                <li>Click &quot;Confirm&quot; on the Google page to activate forwarding</li>
                <li>Back in Gmail, select &quot;Forward a copy&quot; and save</li>
                <li>Create a filter to forward only inquiry emails automatically</li>
              </ol>
            </div>

            <div className="mb-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">Outlook</p>
              <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
                <li>Go to Settings → Mail → Forwarding</li>
                <li>Enable forwarding</li>
                <li>Paste your Clerva email address above</li>
                <li>Optionally keep a copy in your inbox</li>
              </ol>
            </div>

            <div className="bg-blue-100/50 rounded p-2.5 mt-2">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> Only forward your inquiry/contact form emails — not your entire inbox. Use a filter so only leads get scored.
              </p>
            </div>
          </div>
        </>
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
          disabled={loading}
          className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          Skip — I&apos;ll set this up later
        </button>
      </div>
    </div>
  )
}
