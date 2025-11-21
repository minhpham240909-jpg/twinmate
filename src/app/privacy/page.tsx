import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Clerva',
  description: 'Privacy Policy for Clerva - How we collect, use, and protect your data',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-600 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Clerva ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our study platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, password (encrypted)</li>
              <li><strong>Profile Information:</strong> Bio, avatar, subjects of interest, skill level</li>
              <li><strong>Content:</strong> Posts, comments, messages, study session notes</li>
              <li><strong>Preferences:</strong> Study preferences, notification settings, privacy settings</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Usage Data:</strong> Study session duration, features used, interaction patterns</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Cookies:</strong> Authentication cookies, preference cookies, analytics cookies</li>
              <li><strong>Location:</strong> General location (city/country level, if you enable it)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.3 Communication Data</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Messages sent between users</li>
              <li>Group chat messages</li>
              <li>Study session chat logs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Provide and maintain the Service</li>
              <li>Match you with compatible study partners</li>
              <li>Facilitate communication and collaboration</li>
              <li>Send notifications about your study activities</li>
              <li>Improve and personalize your experience</li>
              <li>Analyze usage patterns to enhance features</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
              <li>Send important updates about the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Information Sharing</h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3">4.1 With Other Users</h3>
            <p className="text-gray-700 mb-4">
              Your profile information (name, avatar, bio, subjects) is visible to other users based on your privacy settings. Study partners and group members can see your study activity within shared sessions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">4.2 Service Providers</h3>
            <p className="text-gray-700 mb-4">
              We share information with trusted service providers who help us operate the Service:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Supabase:</strong> Authentication and database hosting</li>
              <li><strong>Agora:</strong> Video/audio calling infrastructure</li>
              <li><strong>Vercel:</strong> Hosting and deployment</li>
              <li><strong>Sentry:</strong> Error tracking and monitoring</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">4.3 Legal Requirements</h3>
            <p className="text-gray-700 mb-4">
              We may disclose information if required by law or to protect our rights, safety, or the rights and safety of others.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">4.4 We Do NOT Sell Your Data</h3>
            <p className="text-gray-700 mb-4">
              We will never sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement security measures to protect your information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Passwords are encrypted using industry-standard methods</li>
              <li>HTTPS encryption for all data transmission</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication requirements</li>
              <li>Rate limiting to prevent abuse</li>
              <li>CSRF protection for state-changing requests</li>
            </ul>
            <p className="text-gray-700 mb-4">
              However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Privacy Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct your information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Download your data in a portable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing emails</li>
              <li><strong>Privacy Settings:</strong> Control who can see your information</li>
            </ul>
            <p className="text-gray-700 mb-4">
              To exercise these rights, go to your account settings or contact us at{' '}
              <a href="mailto:privacy@clerva.com" className="text-blue-600 hover:text-blue-800 underline">
                privacy@clerva.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your information for as long as your account is active or as needed to provide the Service. When you delete your account:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Your profile is immediately deactivated</li>
              <li>Personal information is deleted within 30 days</li>
              <li>Some information may be retained for legal compliance (e.g., transaction records)</li>
              <li>Anonymized usage data may be retained for analytics</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Analyze how you use the Service</li>
              <li>Improve performance and security</li>
            </ul>
            <p className="text-gray-700 mb-4">
              You can control cookies through your browser settings, but some features may not work properly without cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Clerva is intended for users age 13 and older. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Users</h2>
            <p className="text-gray-700 mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to Privacy Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through the Service. Your continued use after changes indicates acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy or your data:
            </p>
            <p className="text-gray-700 mb-2">
              Email: <a href="mailto:privacy@clerva.com" className="text-blue-600 hover:text-blue-800 underline">privacy@clerva.com</a>
            </p>
            <p className="text-gray-700">
              Support: <a href="mailto:support@clerva.com" className="text-blue-600 hover:text-blue-800 underline">support@clerva.com</a>
            </p>
          </section>

          <section className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Your Privacy Matters</h3>
            <p className="text-sm text-blue-800">
              We are committed to protecting your privacy and being transparent about how we use your data. If you have any concerns, please don't hesitate to reach out.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
