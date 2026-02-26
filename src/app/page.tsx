import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
            Adecis
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/login"
              className="text-gray-500 hover:text-gray-900 transition-colors font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 text-white rounded-lg px-5 py-2.5 font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6">
        <section className="pt-24 pb-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              AI-powered lead filtering for freelancers
            </div>
            <h1 className="text-5xl font-bold text-gray-900 leading-[1.15] tracking-tight">
              Your AI deal filter for
              <br />
              <span className="text-blue-600">inbound leads.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg">
              Every message that hits your Slack or email gets scored, summarized,
              and answered in seconds. You only spend time on deals worth closing.
            </p>
            <div className="mt-10 flex items-center gap-5">
              <Link
                href="/signup"
                className="bg-blue-600 text-white rounded-lg px-7 py-3.5 text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25"
              >
                Start Free Trial
              </Link>
              <span className="text-sm text-gray-400">
                25 free leads &middot; No credit card
              </span>
            </div>
          </div>

          {/* Live example card */}
          <div className="mt-20 max-w-xl">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-medium mb-4">
              What you see when a lead arrives
            </p>
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden border-l-4 border-l-green-500">
              <div className="px-5 py-4">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                      HIGH
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                      $2-10k
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      Sarah from Maple Bakery
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      Slack
                    </span>
                    <span className="text-xs text-gray-400">
                      Today
                    </span>
                  </div>
                </div>

                {/* Response priority */}
                <div className="flex items-center gap-1.5 mb-3 text-xs">
                  <span className="text-orange-500">&#9889;</span>
                  <span className="text-orange-600 font-medium">Respond today</span>
                  <span className="text-gray-400 mx-1">&mdash;</span>
                  <span className="text-gray-400">Budget and timeline confirmed, high close probability</span>
                </div>

                {/* Signal bullets */}
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">&#8226;</span>
                    Budget confirmed: $3-5k for full redesign
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">&#8226;</span>
                    Timeline: launch by March
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">&#8226;</span>
                    Decision-maker: business owner, direct contact
                  </li>
                </ul>

                {/* AI-drafted reply */}
                <div className="bg-gray-50 rounded-lg p-3.5 text-sm text-gray-500 italic border border-gray-100">
                  &quot;Hi Sarah, thanks for reaching out. A full redesign with
                  your March timeline is very doable. I&apos;d love to see your
                  current site and discuss your vision — are you free for
                  a quick call this week?&quot;
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button className="text-xs bg-blue-600 text-white px-3.5 py-1.5 rounded-md font-medium hover:bg-blue-700 transition-colors">
                    Send Reply
                  </button>
                  <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Copy reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 border-t border-gray-100">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-gray-500">
              Set up in 2 minutes. Get value from your first inbound message.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Lead arrives',
                desc: 'Someone messages your Slack or emails your contact form. Adecis picks it up in seconds — no manual forwarding needed.',
              },
              {
                step: '2',
                title: 'AI filters it',
                desc: 'High, Medium, or Low — scored instantly with a clear summary and a draft reply ready to send. No guessing, no wasted reads.',
              },
              {
                step: '3',
                title: 'You close faster',
                desc: 'Reply in one click, get nudged if a hot lead goes cold, and see your weekly stats every Monday. Never miss a deal again.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6 hover:border-gray-200 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-sm font-bold text-white mb-4">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-20 border-t border-gray-100">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Built for freelancers who pick their clients
            </h2>
            <p className="mt-3 text-gray-500">
              If you get more inbound leads than you can respond to, Adecis tells you which ones deserve your attention.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-10">
            {[
              'Web & app developers',
              'UI/UX & brand designers',
              'Marketing consultants',
              'Growth & ads specialists',
              'SEO agencies',
              'Tech consultants',
              'No-code builders',
              'Productized service founders',
            ].map((role) => (
              <div
                key={role}
                className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50/80 rounded-xl px-4 py-3 border border-gray-100"
              >
                <svg
                  className="w-4 h-4 text-blue-500 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{role}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 border-t border-gray-100">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Simple pricing
            </h2>
            <p className="mt-3 text-gray-500">
              One plan. Everything included. No usage surprises.
            </p>
          </div>
          <div className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">$29</span>
                <span className="text-lg text-gray-400 font-medium">/mo</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Everything you need to filter and close leads</p>
            </div>
            <div className="mt-8 space-y-3">
              {[
                '500 leads scored per month',
                'Unlimited AI-drafted replies',
                'Slack + email integration',
                'Deal size & urgency signals',
                'Smart response priorities',
                'Push notifications for hot leads',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm text-gray-600">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="mt-8 block text-center bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">
              Try free with 25 leads &middot; No credit card
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <span>Adecis — AI deal filter for freelancers and agencies.</span>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-gray-600 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-gray-600 transition-colors">
                Terms
              </Link>
              <Link href="/login" className="hover:text-gray-600 transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-gray-600 transition-colors">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
