import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Clerva',
  description: 'Terms of Service for Clerva - Study platform',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg shadow-lg dark:shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              By accessing and using Clerva ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              Clerva is a study platform that enables users to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-slate-300 mb-4 space-y-2">
              <li>Find and connect with study partners</li>
              <li>Participate in study sessions with video/audio calls</li>
              <li>Create and join study groups</li>
              <li>Share educational content and engage with the community</li>
              <li>Use collaborative tools like whiteboards and screen sharing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">3. User Accounts</h2>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">3.1 Account Creation</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              You must create an account to use certain features of the Service. You agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-slate-300 mb-4 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password</li>
              <li>Accept all responsibility for activity under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">3.2 Email Verification</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              Certain features require email verification. You agree to verify your email address to access these features.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">3.3 Account Termination</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              We reserve the right to suspend or terminate your account if you violate these Terms or engage in conduct that we deem inappropriate or harmful to other users or the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">4. User Conduct</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-slate-300 mb-4 space-y-2">
              <li>Harass, abuse, threaten, or discriminate against other users</li>
              <li>Post inappropriate, offensive, or illegal content</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Spam or send unsolicited messages to other users</li>
              <li>Attempt to access accounts or data without authorization</li>
              <li>Upload malicious code, viruses, or harmful files</li>
              <li>Scrape, copy, or republish content without permission</li>
              <li>Use the Service for commercial purposes without authorization</li>
              <li>Interfere with or disrupt the Service or servers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">5. Content</h2>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">5.1 Your Content</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              You retain ownership of content you post on Clerva. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content on the Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">5.2 Content Moderation</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              We reserve the right to remove any content that violates these Terms or that we deem inappropriate, at our sole discretion.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">5.3 Copyright</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              You must not post content that infringes on others' intellectual property rights. We will respond to valid DMCA takedown notices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">6. Privacy</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              Your use of the Service is also governed by our <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline">Privacy Policy</a>, which explains how we collect, use, and protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">7. Study Sessions & Video Calls</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              When participating in study sessions with video/audio:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-slate-300 mb-4 space-y-2">
              <li>You are responsible for your own conduct during sessions</li>
              <li>Recording others without consent is prohibited</li>
              <li>You must respect others' privacy and boundaries</li>
              <li>Inappropriate behavior may result in account suspension</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">8. Disclaimers</h2>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">8.1 Service Availability</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              The Service is provided "as is" and "as available." We do not guarantee uninterrupted or error-free service.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">8.2 Educational Content</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              Clerva is a platform for study collaboration. We do not guarantee the accuracy, quality, or effectiveness of any educational content shared by users.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-3">8.3 User Interactions</h3>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              We are not responsible for interactions between users. Exercise caution and good judgment when interacting with others.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              To the maximum extent permitted by law, Clerva and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">10. Changes to Terms</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of significant changes. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">11. Termination</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              You may terminate your account at any time through your account settings. We may terminate or suspend your access immediately, without prior notice, for any breach of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">12. Governing Law</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">13. Contact Information</h2>
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="text-gray-700 dark:text-slate-300">
              Email: <a href="mailto:support@clerva.com" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline">support@clerva.com</a>
            </p>
          </section>

          <section className="mb-8 p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-200 dark:border-slate-600/50">
            <p className="text-sm text-gray-700 dark:text-slate-300">
              By using Clerva, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
