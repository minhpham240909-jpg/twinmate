import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Clerva',
  description: 'Privacy Policy for Clerva, AI-powered learning platform.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
            Clerva
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: February 13, 2026</p>

        <div className="prose prose-sm prose-gray max-w-none">
          <p>
            This Privacy Notice for Clerva Inc.
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how and why we might
            access, collect, store, use, and/or share (&quot;process&quot;) your personal
            information when you use our services (&quot;Services&quot;), including when you:
          </p>
          <ul>
            <li>Visit our website at <a href="https://www.clerva.app" className="text-blue-600 hover:underline">https://www.clerva.app</a> or any website of ours that links to this Privacy Notice</li>
            <li>Engage with us in other related ways, including any marketing or events</li>
          </ul>
          <p>
            <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you
            understand your privacy rights and choices. If you do not agree with our policies
            and practices, please do not use our Services. If you still have any questions or
            concerns, please contact us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">
              support@clerva.app
            </a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">1. What Information Do We Collect?</h2>

          <h3 className="text-base font-semibold text-gray-900 mt-6 mb-3">Personal information you disclose to us</h3>
          <p><em>In Short: We collect personal information that you provide to us.</em></p>
          <p>
            We collect personal information that you voluntarily provide to us when you register
            on the Services, express an interest in obtaining information about us or our products
            and Services, when you participate in activities on the Services, or otherwise when you
            contact us.
          </p>
          <p><strong>Personal Information Provided by You.</strong> The personal information we collect may include:</p>
          <ul>
            <li>Names</li>
            <li>Email addresses</li>
          </ul>
          <p><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
          <p>
            <strong>Payment Data.</strong> We may collect data necessary to process your payment if
            you choose to make purchases, such as your payment instrument number, and the security
            code associated with your payment instrument. All payment data is handled and stored by{' '}
            <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline">Stripe</a>.
          </p>
          <p>
            <strong>Social Media Login Data.</strong> We may provide you with the option to register
            with us using your existing social media account details, like your Google account. If you
            choose to register in this way, we will collect certain profile information about you from
            the social media provider.
          </p>

          <h3 className="text-base font-semibold text-gray-900 mt-6 mb-3">Information automatically collected</h3>
          <p><em>In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.</em></p>
          <p>
            We automatically collect certain information when you visit, use, or navigate the Services.
            This information does not reveal your specific identity but may include device and usage
            information, such as your IP address, browser and device characteristics, operating system,
            language preferences, referring URLs, device name, country, location, information about how
            and when you use our Services, and other technical information.
          </p>
          <p>The information we collect includes:</p>
          <ul>
            <li><em>Usage data / activity data</em></li>
            <li><em>Content data / user-generated content</em> (Slack messages and emails processed for AI scoring)</li>
            <li><em>Data derived from other data</em> (AI scoring output including intent scores, summaries, and suggested replies)</li>
          </ul>

          <p><strong>Google API.</strong> Our use of information received from Google APIs will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
            including the Limited Use requirements.
          </p>

          <h3 className="text-base font-semibold text-gray-900 mt-6 mb-3">Information collected from other sources</h3>
          <p><em>In Short: We may collect limited data from social media platforms and other outside sources.</em></p>
          <p>
            We may obtain information about you from other sources, such as social media platforms
            (Google OAuth), messaging platforms (Slack), and email services (SendGrid) to provide
            our lead scoring and analysis services.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">2. How Do We Process Your Information?</h2>
          <p><em>In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</em></p>
          <p>We process your personal information for a variety of reasons, including:</p>
          <ul>
            <li>To deliver and facilitate delivery of services to users</li>
            <li>To process and analyze inbound messages using artificial intelligence for lead scoring and response generation</li>
            <li>To fulfill and manage user orders and subscriptions</li>
            <li>To send administrative information to users (weekly summaries, lead reminders)</li>
            <li>To protect our Services</li>
            <li>To respond to user inquiries and offer support</li>
            <li>To comply with our legal obligations</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">3. When and With Whom Do We Share Your Personal Information?</h2>
          <p><em>In Short: We may share information in specific situations described below.</em></p>
          <p>We may need to share your personal information with the following third-party service providers:</p>
          <ul>
            <li><strong>AI Processing:</strong> Anthropic (Claude) — for analyzing and scoring inbound messages</li>
            <li><strong>Payment Processing:</strong> Stripe — for handling subscription payments</li>
            <li><strong>Authentication:</strong> Google Sign-In — for account registration and login</li>
            <li><strong>Messaging Platform:</strong> Slack — for ingesting and processing lead messages</li>
            <li><strong>Email Delivery:</strong> SendGrid — for sending emails and processing inbound emails</li>
            <li><strong>Database &amp; Data Storage:</strong> Supabase — for storing application data</li>
            <li><strong>Rate Limiting:</strong> Upstash — for API rate limiting</li>
            <li><strong>Application Hosting:</strong> Vercel — for hosting and serving the application</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">4. Do We Offer Artificial Intelligence-Based Products?</h2>
          <p><em>In Short: We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</em></p>
          <p>
            Our core service uses Anthropic&apos;s Claude AI to analyze inbound messages from Slack and email.
            The AI processes message content to generate intent scores, deal assessments, summary bullets,
            suggested replies, and response priority recommendations. Message content is sent to Anthropic&apos;s
            API for processing and is subject to{' '}
            <a href="https://www.anthropic.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Anthropic&apos;s Privacy Policy</a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">5. How Do We Handle Your Social Logins?</h2>
          <p><em>In Short: If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</em></p>
          <p>
            We offer you the ability to register and log in using your Google account. When you do so,
            we receive your name, email address, and profile picture from Google. We use this information
            solely to create and manage your account on our Services.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">6. How Long Do We Keep Your Information?</h2>
          <p><em>In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>
          <p>
            We will only keep your personal information for as long as it is necessary for the purposes
            set out in this Privacy Notice, unless a longer retention period is required or permitted by
            law. When we have no ongoing legitimate business need to process your personal information,
            we will either delete or anonymize such information.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">7. How Do We Keep Your Information Safe?</h2>
          <p><em>In Short: We aim to protect your personal information through a system of organizational and technical security measures.</em></p>
          <p>
            We have implemented appropriate and reasonable technical and organizational security measures
            designed to protect the security of any personal information we process. However, despite our
            safeguards and efforts to secure your information, no electronic transmission over the Internet
            or information storage technology can be guaranteed to be 100% secure.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">8. Do We Collect Information From Minors?</h2>
          <p><em>In Short: We do not knowingly collect data from or market to children under 18 years of age.</em></p>
          <p>
            We do not knowingly collect, solicit data from, or market to children under 18 years of age,
            nor do we knowingly sell such personal information. If we learn that personal information from
            users less than 18 years of age has been collected, we will take reasonable measures to promptly
            delete such data from our records.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">9. What Are Your Privacy Rights?</h2>
          <p><em>In Short: You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</em></p>
          <p>
            In some regions, you have certain rights under applicable data protection laws, including the
            right to request access to and obtain a copy of your personal information, request rectification
            or erasure, restrict the processing of your personal information, and if applicable, data portability.
          </p>
          <p>
            If you wish to exercise any of these rights, please contact us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">support@clerva.app</a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">10. Controls for Do-Not-Track Features</h2>
          <p>
            Most web browsers and some mobile operating systems include a Do-Not-Track (&quot;DNT&quot;) feature
            or setting. At this stage, no uniform technology standard for recognizing and implementing
            DNT signals has been finalized.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">11. Do United States Residents Have Specific Privacy Rights?</h2>
          <p><em>In Short: If you are a resident of certain US states, you may have additional privacy rights.</em></p>
          <p>
            If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa,
            Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island,
            Tennessee, Texas, Utah, or Virginia, you may have specific rights regarding your personal
            information under applicable state privacy laws.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">12. Do We Make Updates to This Notice?</h2>
          <p><em>In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
          <p>
            We may update this Privacy Notice from time to time. The updated version will be indicated by
            an updated &quot;Last updated&quot; date at the top of this Privacy Notice.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">13. How Can You Contact Us About This Notice?</h2>
          <p>
            If you have questions or comments about this notice, you may email us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">support@clerva.app</a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">14. How Can You Review, Update, or Delete the Data We Collect From You?</h2>
          <p>
            Based on the applicable laws of your country or state of residence, you may have the right to
            request access to the personal information we collect from you, details about how we have
            processed it, correct inaccuracies, or delete your personal information. To request to review,
            update, or delete your personal information, please contact us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">support@clerva.app</a>.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          Clerva &mdash; AI-powered learning platform.
        </div>
      </footer>
    </div>
  )
}
