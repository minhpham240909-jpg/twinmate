'use client'

import Link from 'next/link'

export default function OnboardingStep1() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="text-sm text-gray-400 mb-1">Step 1 of 3</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Connect Slack</h2>
      <p className="text-gray-500 text-sm mb-6">
        Clerva will listen for lead messages in your Slack channels and
        instantly score them with AI.
      </p>

      <a
        href="/api/slack/install"
        className="block w-full text-center bg-[#4A154B] text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-[#3a1039] transition-colors"
      >
        Connect Slack
      </a>

      <div className="mt-4 text-center">
        <Link
          href="/onboarding/profile"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Skip for now
        </Link>
      </div>
    </div>
  )
}
