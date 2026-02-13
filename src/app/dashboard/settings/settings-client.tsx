'use client'

import { NICHES, TONES } from '@/lib/constants'
import { useState } from 'react'

interface SettingsClientProps {
  initialProfile: {
    businessName: string
    niche: string
    tone: string
    bookingLink: string
    customInstructions: string
    autoReplyEnabled: boolean
    replyFromName: string
  }
  initialEmailAddress: string
  initialSlackTeam: string
}

export default function SettingsClient({
  initialProfile,
  initialEmailAddress,
  initialSlackTeam,
}: SettingsClientProps) {
  const [businessName, setBusinessName] = useState(initialProfile.businessName)
  const [niche, setNiche] = useState(initialProfile.niche)
  const [tone, setTone] = useState(initialProfile.tone)
  const [bookingLink, setBookingLink] = useState(initialProfile.bookingLink)
  const [customInstructions, setCustomInstructions] = useState(initialProfile.customInstructions)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(initialProfile.autoReplyEnabled)
  const [replyFromName, setReplyFromName] = useState(initialProfile.replyFromName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)
  const [showEmailTips, setShowEmailTips] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName || null,
          niche: niche || null,
          tone,
          booking_link: bookingLink || null,
          custom_instructions: customInstructions || null,
          auto_reply_enabled: autoReplyEnabled,
          reply_from_name: replyFromName || null,
        }),
      })
      if (!res.ok) {
        setSaveError('Failed to save. Please try again.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCopyEmail() {
    if (initialEmailAddress) {
      navigator.clipboard.writeText(initialEmailAddress)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure how Adecis scores your leads and drafts replies.
      </p>

      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-900 mb-4">
          Business Profile
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Business name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Acme Design Studio"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Niche</label>
            <p className="text-xs text-gray-400 mb-1.5">
              Helps the AI understand your industry and score leads more accurately.
            </p>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
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
            <label className="block text-sm text-gray-700 mb-1">
              Reply tone
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              Sets the voice for AI-drafted replies — professional, casual, or friendly.
            </p>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Booking link
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              Your scheduling page (Calendly, Cal.com, etc.). The AI includes this in replies so leads can book a call directly.
            </p>
            <input
              type="url"
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="https://cal.com/you/30min"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Custom instructions
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              Extra context for the AI — e.g. &quot;I don&apos;t take projects under $2k&quot; or &quot;Always mention our 2-week turnaround.&quot;
            </p>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
              placeholder="Any rules, preferences, or context you want the AI to follow..."
            />
            <p className="text-xs text-gray-300 mt-1 text-right">
              {customInstructions.length}/500
            </p>
          </div>
          {saveError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-md p-2.5">
              {saveError}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Auto Reply Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">
          Auto Reply
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          When enabled, Adecis automatically sends the AI-drafted reply to HIGH and MEDIUM intent leads — via email and Slack. LOW intent leads are never auto-replied to.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-700">
                Enable auto reply
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                Replies are sent instantly when a lead is scored.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoReplyEnabled}
              onClick={() => setAutoReplyEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                autoReplyEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  autoReplyEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Reply name
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              The name shown in the &quot;From&quot; field of email replies and used to sign off messages. E.g. &quot;Sarah from Acme Studio&quot;.
            </p>
            <input
              type="text"
              value={replyFromName}
              onChange={(e) => setReplyFromName(e.target.value)}
              maxLength={100}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Your name or business name"
            />
          </div>
        </div>
      </div>

      {/* Slack Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">
          Slack Integration
        </h2>
        {initialSlackTeam ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-600">
                Connected to <strong>{initialSlackTeam}</strong>
              </span>
            </div>
            <a
              href="/api/slack/install"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Reconnect
            </a>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Connect Slack so Adecis can score messages from your channels in real time.
            </p>
            <a
              href="/api/slack/install"
              className="inline-block bg-[#4A154B] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[#3a1039] transition-colors"
            >
              Connect Slack
            </a>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-900">
            Email Forwarding
          </h2>
          {initialEmailAddress && (
            <button
              onClick={() => setShowEmailTips((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {showEmailTips ? 'Hide tips' : 'Setup tips'}
            </button>
          )}
        </div>
        {initialEmailAddress ? (
          <div>
            <p className="text-sm text-gray-500 mb-2">
              Forward inquiry emails to this address. Adecis will score them automatically.
            </p>
            <div className="bg-gray-50 rounded-md p-3 flex items-center justify-between mb-4">
              <code className="text-sm text-gray-700 break-all">
                {initialEmailAddress}
              </code>
              <button
                onClick={handleCopyEmail}
                className="ml-3 text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                {emailCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {showEmailTips && (
              <div className="bg-blue-50 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  How to set up forwarding
                </h3>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Gmail</p>
                  <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
                    <li>Go to Settings → Forwarding and POP/IMAP</li>
                    <li>Click &quot;Add a forwarding address&quot;</li>
                    <li>Paste your Adecis email address above</li>
                    <li>Confirm via the verification email</li>
                    <li>Create a filter to forward inquiry emails automatically</li>
                  </ol>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Outlook</p>
                  <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
                    <li>Go to Settings → Mail → Forwarding</li>
                    <li>Enable forwarding</li>
                    <li>Paste your Adecis email address above</li>
                    <li>Optionally keep a copy in your inbox</li>
                  </ol>
                </div>

                <div className="bg-blue-100/50 rounded p-2.5 mt-2">
                  <p className="text-xs text-blue-800">
                    <strong>Tip:</strong> Only forward your inquiry/contact form emails — not your entire inbox. Use a filter so only leads get scored.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-2">
              No email address configured yet.
            </p>
            <a
              href="/onboarding/email"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Set up email forwarding
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
