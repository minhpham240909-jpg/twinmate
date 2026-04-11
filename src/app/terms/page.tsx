import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms and Conditions — Clerva',
  description: 'Terms and Conditions for Clerva, AI-powered learning platform.',
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: February 13, 2026</p>

        <div className="prose prose-sm prose-gray max-w-none">
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Agreement to Our Legal Terms</h2>
          <p>
            We are Clerva Inc. (&quot;Company,&quot; &quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;).
          </p>
          <p>
            We operate the website{' '}
            <a href="https://www.clerva.app" className="text-blue-600 hover:underline">https://www.clerva.app</a>{' '}
            (the &quot;Site&quot;), as well as any other related products and services that refer or link to
            these legal terms (the &quot;Legal Terms&quot;) (collectively, the &quot;Services&quot;).
          </p>
          <p>
            Clerva is an AI-powered learning platform that helps students learn effectively through
            personalized guidance, flashcards, and interactive study tools.
          </p>
          <p>
            These Legal Terms constitute a legally binding agreement made between you, whether personally or
            on behalf of an entity (&quot;you&quot;), and Clerva Inc., concerning your access to and use of the
            Services. You agree that by accessing the Services, you have read, understood, and agreed to be
            bound by all of these Legal Terms.
          </p>
          <p>
            <strong>IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED
            FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
          </p>
          <p>
            We will provide you with prior notice of any scheduled changes to the Services you are using.
            Changes to Legal Terms will become effective seven (7) days after the notice is given. By
            continuing to use the Services after the effective date of any changes, you agree to be bound
            by the modified terms.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">1. Our Services</h2>
          <p>
            The information provided when using the Services is not intended for distribution to or use by
            any person or entity in any jurisdiction or country where such distribution or use would be
            contrary to law or regulation. Accordingly, those persons who choose to access the Services from
            other locations do so on their own initiative and are solely responsible for compliance with local laws.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">2. Intellectual Property Rights</h2>
          <p>
            We are the owner or the licensee of all intellectual property rights in our Services, including
            all source code, databases, functionality, software, website designs, audio, video, text,
            photographs, and graphics in the Services (collectively, the &quot;Content&quot;), as well as the
            trademarks, service marks, and logos contained therein (the &quot;Marks&quot;).
          </p>
          <p>
            Our Content and Marks are protected by copyright and trademark laws and various other intellectual
            property rights and unfair competition laws.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">3. User Representations</h2>
          <p>By using the Services, you represent and warrant that:</p>
          <ul>
            <li>All registration information you submit will be true, accurate, current, and complete</li>
            <li>You will maintain the accuracy of such information and promptly update such registration information as necessary</li>
            <li>You have the legal capacity and you agree to comply with these Legal Terms</li>
            <li>You are not a minor in the jurisdiction in which you reside</li>
            <li>You will not access the Services through automated or non-human means</li>
            <li>You will not use the Services for any illegal or unauthorized purpose</li>
            <li>Your use of the Services will not violate any applicable law or regulation</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">4. User Registration</h2>
          <p>
            You may be required to register to use the Services. You agree to keep your password confidential
            and will be responsible for all use of your account and password. We reserve the right to remove,
            reclaim, or change a username you select if we determine, in our sole discretion, that such
            username is inappropriate, obscene, or otherwise objectionable.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">5. Purchases and Payment</h2>
          <p>We accept the following forms of payment:</p>
          <ul>
            <li>Visa</li>
            <li>Mastercard</li>
            <li>American Express</li>
            <li>Discover</li>
          </ul>
          <p>
            You agree to provide current, complete, and accurate purchase and account information for all
            purchases made via the Services. You further agree to promptly update account and payment
            information, including email address, payment method, and payment card expiration date, so that
            we can complete your transactions and contact you as needed. Sales tax will be added to the price
            of purchases as deemed required by us. We may change prices at any time. All payments shall be in
            US dollars.
          </p>
          <p>
            You agree to pay all charges at the prices then in effect for your purchases and any applicable
            shipping fees, and you authorize us to charge your chosen payment provider for any such amounts
            upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even
            if we have already requested or received payment.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">6. Subscriptions</h2>
          <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Billing and Renewal</h3>
          <p>
            Your subscription will continue and automatically renew unless canceled. You consent to our
            charging your payment method on a recurring basis without requiring your prior approval for each
            recurring charge, until such time as you cancel the applicable order.
          </p>
          <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Free Trial</h3>
          <p>
            We offer a 7-day free trial to new users who register with the Services. You are not required
            to provide payment information during the free trial. The account will not be charged and the
            subscription will be suspended at the end of the free trial period unless you upgrade to a paid
            subscription.
          </p>
          <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Cancellation</h3>
          <p>
            You can cancel your subscription at any time through your account billing settings or by
            contacting us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">support@clerva.app</a>.
            Your cancellation will take effect at the end of the current paid term. If you are unsatisfied
            with our Services, please email us at{' '}
            <a href="mailto:support@clerva.app" className="text-blue-600 hover:underline">support@clerva.app</a>.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">7. Prohibited Activities</h2>
          <p>
            You may not access or use the Services for any purpose other than that for which we make the
            Services available. The Services may not be used in connection with any commercial endeavors
            except those that are specifically endorsed or approved by us.
          </p>
          <p>As a user of the Services, you agree not to:</p>
          <ul>
            <li>Systematically retrieve data or other content from the Services to create or compile a collection, compilation, database, or directory</li>
            <li>Trick, defraud, or mislead us and other users</li>
            <li>Circumvent, disable, or otherwise interfere with security-related features of the Services</li>
            <li>Use any information obtained from the Services in order to harass, abuse, or harm another person</li>
            <li>Make improper use of our support services or submit false reports of abuse or misconduct</li>
            <li>Use the Services in a manner inconsistent with any applicable laws or regulations</li>
            <li>Engage in unauthorized framing of or linking to the Services</li>
            <li>Upload or transmit viruses, Trojan horses, or other material that interferes with any party&apos;s uninterrupted use and enjoyment of the Services</li>
            <li>Use the Services to advertise or offer to sell goods and services</li>
            <li>Sell or otherwise transfer your profile</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">8. Third-Party Websites and Content</h2>
          <p>
            The Services may contain links to other websites (&quot;Third-Party Websites&quot;) as well as
            articles, photographs, text, graphics, pictures, designs, music, sound, video, information,
            applications, software, and other content or items belonging to or originating from third parties.
            We are not responsible for any Third-Party Websites accessed through the Services.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">9. Services Management</h2>
          <p>We reserve the right, but not the obligation, to:</p>
          <ul>
            <li>Monitor the Services for violations of these Legal Terms</li>
            <li>Take appropriate legal action against anyone who violates the law or these Legal Terms</li>
            <li>Refuse, restrict access to, limit the availability of, or disable any of your contributions or any portion thereof</li>
            <li>Remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems</li>
            <li>Otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">10. Privacy Policy</h2>
          <p>
            We care about data privacy and security. Please review our Privacy Policy at{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">https://www.clerva.app/privacy</Link>.
            By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into
            these Legal Terms.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">11. Term and Termination</h2>
          <p>
            These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT
            LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE
            DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES TO ANY
            PERSON FOR ANY REASON OR FOR NO REASON.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">12. Modifications and Interruptions</h2>
          <p>
            We reserve the right to change, modify, or remove the contents of the Services at any time or
            for any reason at our sole discretion without notice. We are not obligated to update any
            information on our Services. We will not be liable to you or any third party for any
            modification, price change, suspension, or discontinuance of the Services.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">13. Dispute Resolution</h2>
          <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Informal Negotiations</h3>
          <p>
            To expedite resolution and control the cost of any dispute, controversy, or claim related to
            these Legal Terms, the Parties agree to first attempt to negotiate any Dispute informally for
            at least thirty (30) days before initiating arbitration.
          </p>
          <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Binding Arbitration</h3>
          <p>
            Any dispute arising out of or in connection with these Legal Terms shall be resolved through
            binding arbitration. The arbitration shall be held in the state where the Company is located.
            If your claim is deemed frivolous, you agree to reimburse us for attorney&apos;s fees.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">14. Limitation of Liability</h2>
          <p>
            IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY
            FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES,
            INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE
            SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR LIABILITY TO YOU
            FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION WILL AT ALL TIMES BE LIMITED
            TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF
            ACTION ARISING.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">15. Disclaimer</h2>
          <p>
            THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE
            SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL
            WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">16. Contact Us</h2>
          <p>
            In order to resolve a complaint regarding the Services or to receive further information regarding
            use of the Services, please contact us at{' '}
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
