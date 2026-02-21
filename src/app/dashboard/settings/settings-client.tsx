'use client'

import { createClient } from '@/lib/supabase/browser'
import { NICHES, TONES } from '@/lib/constants'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i)
  }
  return buffer
}

interface SettingsClientProps {
  initialProfile: {
    businessName: string
    niche: string
    tone: string
    bookingLink: string
    customInstructions: string
    autoReplyEnabled: boolean
    replyFromName: string
    digestEnabled: boolean
    digestHour: number
    pushEnabled: boolean
  }
  initialEmailAddress: string
  initialSlackTeam: string
  account: {
    email: string
    plan: string
    memberSince: string
  }
}

export default function SettingsClient({
  initialProfile,
  initialEmailAddress,
  initialSlackTeam,
  account,
}: SettingsClientProps) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState(initialProfile.businessName)
  const [niche, setNiche] = useState(initialProfile.niche)
  const [tone, setTone] = useState(initialProfile.tone)
  const [bookingLink, setBookingLink] = useState(initialProfile.bookingLink)
  const [customInstructions, setCustomInstructions] = useState(initialProfile.customInstructions)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(initialProfile.autoReplyEnabled)
  const [replyFromName, setReplyFromName] = useState(initialProfile.replyFromName)
  const [digestEnabled, setDigestEnabled] = useState(initialProfile.digestEnabled)
  const [digestHour, setDigestHour] = useState(initialProfile.digestHour)
  const [pushEnabled, setPushEnabled] = useState(initialProfile.pushEnabled)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribing, setPushSubscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)
  const [showEmailTips, setShowEmailTips] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Detect push notification support on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true)
    }
  }, [])

  const handlePushToggle = useCallback(async () => {
    if (pushSubscribing) return

    if (pushEnabled) {
      // Unsubscribe
      setPushSubscribing(true)
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setPushEnabled(false)
      } catch (err) {
        console.error('Failed to unsubscribe from push:', err)
      } finally {
        setPushSubscribing(false)
      }
      return
    }

    // Subscribe
    setPushSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushSubscribing(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('VAPID public key not configured')
        setPushSubscribing(false)
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setPushEnabled(true)
    } catch (err) {
      console.error('Failed to subscribe to push:', err)
    } finally {
      setPushSubscribing(false)
    }
  }, [pushEnabled, pushSubscribing])

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
          digest_enabled: digestEnabled,
          digest_hour: digestHour,
          push_enabled: pushEnabled,
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

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete account')
        return
      }
      // Clear local session before redirecting
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch {
      setDeleteError('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const planLabel: Record<string, string> = {
    trialing: 'Free Trial',
    active: 'Pro',
    canceled: 'Canceled',
    past_due: 'Past Due',
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure how Adecis scores your leads and drafts replies.
      </p>

      {/* Account Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm text-gray-900">{account.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Plan</span>
            <span className="text-sm text-gray-900">
              {planLabel[account.plan] || account.plan}
            </span>
          </div>
          {account.memberSince && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Member since</span>
              <span className="text-sm text-gray-900">
                {account.memberSince.slice(0, 10)}
              </span>
            </div>
          )}
        </div>
      </div>

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

      {/* Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">
          Notifications
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Control how Adecis keeps you informed about new leads and activity.
        </p>
        <div className="space-y-5">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-700">
                Push notifications
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                {pushSupported
                  ? 'Get notified instantly when a HIGH intent lead arrives.'
                  : 'Push notifications are not supported in this browser.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              disabled={!pushSupported || pushSubscribing}
              onClick={handlePushToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                pushEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  pushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Daily Digest */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-700">
                Daily digest email
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                A daily summary of leads received, replies sent, and items needing review.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={digestEnabled}
              onClick={() => setDigestEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                digestEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  digestEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Digest Hour Selector — only visible when digest is enabled */}
          {digestEnabled && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Digest delivery time (UTC)
              </label>
              <p className="text-xs text-gray-400 mb-1.5">
                The hour of day (UTC) when your daily digest is sent.
              </p>
              <select
                value={digestHour}
                onChange={(e) => setDigestHour(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Save Button — saves all settings above */}
      {saveError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-md p-2.5 mb-4">
          {saveError}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mb-4"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
      </button>

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
                    <li>Gmail will send a confirmation email to your Adecis address — it will appear as a lead on your dashboard</li>
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

      {/* Sign Out Section */}
      <div className="bg-white rounded-lg shadow-sm border p-5 mt-4">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Session</h2>
        <p className="text-xs text-gray-500 mb-3">
          Sign out of your account on this device.
        </p>
        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="text-sm text-gray-700 border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sign out?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 text-sm border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 text-sm bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Section */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-5 mt-4">
        <h2 className="text-sm font-medium text-red-600 mb-2">
          Danger Zone
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Permanently delete your account and all associated data — leads, settings, integrations. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm text-red-600 border border-red-300 rounded-md px-4 py-2 hover:bg-red-50 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete your account?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete your account, all leads, settings, and integrations. This cannot be undone.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Type <strong>delete my account</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
              placeholder="delete my account"
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-500 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                  setDeleteError(null)
                }}
                className="flex-1 text-sm border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'delete my account' || deleting}
                className="flex-1 text-sm bg-red-600 text-white rounded-md px-4 py-2 hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
