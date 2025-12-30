import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Clerva',
  description: 'Privacy Policy for Clerva - How we collect, use, and protect your data',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg shadow-lg dark:shadow-xl p-8">
        {/* Termly Privacy Policy */}
        <div className="termly-policy">
          <style dangerouslySetInnerHTML={{ __html: `
            .termly-policy [data-custom-class='body'], .termly-policy [data-custom-class='body'] * {
              background: transparent !important;
            }
            .termly-policy [data-custom-class='title'], .termly-policy [data-custom-class='title'] * {
              font-family: Arial !important;
              font-size: 26px !important;
            }
            .termly-policy [data-custom-class='subtitle'], .termly-policy [data-custom-class='subtitle'] * {
              font-family: Arial !important;
              font-size: 14px !important;
            }
            .termly-policy [data-custom-class='heading_1'], .termly-policy [data-custom-class='heading_1'] * {
              font-family: Arial !important;
              font-size: 19px !important;
            }
            .termly-policy [data-custom-class='heading_2'], .termly-policy [data-custom-class='heading_2'] * {
              font-family: Arial !important;
              font-size: 17px !important;
            }
            .termly-policy [data-custom-class='body_text'], .termly-policy [data-custom-class='body_text'] * {
              font-size: 14px !important;
              font-family: Arial !important;
            }
            .termly-policy [data-custom-class='link'], .termly-policy [data-custom-class='link'] * {
              color: #3030F1 !important;
              font-size: 14px !important;
              font-family: Arial !important;
              word-break: break-word !important;
            }
            /* Light mode styles */
            .termly-policy [data-custom-class='title'], .termly-policy [data-custom-class='title'] * {
              color: #000000 !important;
            }
            .termly-policy [data-custom-class='subtitle'], .termly-policy [data-custom-class='subtitle'] * {
              color: #595959 !important;
            }
            .termly-policy [data-custom-class='heading_1'], .termly-policy [data-custom-class='heading_1'] * {
              color: #000000 !important;
            }
            .termly-policy [data-custom-class='heading_2'], .termly-policy [data-custom-class='heading_2'] * {
              color: #000000 !important;
            }
            .termly-policy [data-custom-class='body_text'], .termly-policy [data-custom-class='body_text'] * {
              color: #595959 !important;
            }
            /* Dark mode overrides */
            .dark .termly-policy [data-custom-class='title'], .dark .termly-policy [data-custom-class='title'] * {
              color: #f1f5f9 !important;
            }
            .dark .termly-policy [data-custom-class='subtitle'], .dark .termly-policy [data-custom-class='subtitle'] * {
              color: #94a3b8 !important;
            }
            .dark .termly-policy [data-custom-class='heading_1'], .dark .termly-policy [data-custom-class='heading_1'] * {
              color: #f1f5f9 !important;
            }
            .dark .termly-policy [data-custom-class='heading_2'], .dark .termly-policy [data-custom-class='heading_2'] * {
              color: #e2e8f0 !important;
            }
            .dark .termly-policy [data-custom-class='body_text'], .dark .termly-policy [data-custom-class='body_text'] * {
              color: #cbd5e1 !important;
            }
            .dark .termly-policy [data-custom-class='link'], .dark .termly-policy [data-custom-class='link'] * {
              color: #60a5fa !important;
            }
            .termly-policy h1, .termly-policy h2, .termly-policy h3 {
              margin-top: 1.5rem;
              margin-bottom: 0.75rem;
            }
            .termly-policy ul {
              list-style-type: disc;
              padding-left: 1.5rem;
              margin: 0.5rem 0;
            }
            .termly-policy li {
              margin: 0.25rem 0;
            }
          `}} />

          <div data-custom-class="body">
            <div>
              <strong>
                <span style={{ fontSize: '26px' }}>
                  <span data-custom-class="title">
                    <h1 className="text-gray-900 dark:text-slate-100">PRIVACY POLICY</h1>
                  </span>
                </span>
              </strong>
            </div>
            <div>
              <span className="text-gray-500 dark:text-slate-400">
                <strong>
                  <span style={{ fontSize: '15px' }}>
                    <span data-custom-class="subtitle">Last updated December 28, 2025</span>
                  </span>
                </strong>
              </span>
            </div>
            <div><br /></div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  This Privacy Notice for Minh Pham (doing business as Clerva) (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how and why we might access, collect, store, use, and/or share (&quot;process&quot;) your personal information when you use our services (&quot;Services&quot;), including when you:
                </span>
              </span>
            </div>
            <ul>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                  <span data-custom-class="body_text">
                    Visit our website at <a href="https://www.clerva.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.clerva.app</a> or any website of ours that links to this Privacy Notice
                  </span>
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                  <span data-custom-class="body_text">
                    Download and use our mobile application (clerva), or any other application of ours that links to this Privacy Notice
                  </span>
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                  <span data-custom-class="body_text">
                    Use clerva - find the perfect partner for studying
                  </span>
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                  <span data-custom-class="body_text">
                    Engage with us in other related ways, including any marketing or events
                  </span>
                </span>
              </li>
            </ul>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:privacy@clerva.app" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@clerva.app</a>.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div><br /></div>

            {/* Summary of Key Points */}
            <div style={{ lineHeight: '1.5' }}>
              <strong>
                <span style={{ fontSize: '15px' }}>
                  <span data-custom-class="heading_1" className="text-gray-900 dark:text-slate-100">
                    <h2>SUMMARY OF KEY POINTS</h2>
                  </span>
                </span>
              </strong>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</em></strong>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Do we process any sensitive personal information?</strong> We do not process sensitive personal information.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Do we collect any information from third parties?</strong> We may collect information from public databases, marketing partners, social media platforms, and other outside sources.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by visiting <a href="https://www.clerva.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.clerva.app</a>, or by contacting us.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div><br /></div>

            {/* Table of Contents */}
            <div id="toc" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>TABLE OF CONTENTS</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#infocollect" className="text-blue-600 dark:text-blue-400 hover:underline">1. WHAT INFORMATION DO WE COLLECT?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#infouse" className="text-blue-600 dark:text-blue-400 hover:underline">2. HOW DO WE PROCESS YOUR INFORMATION?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#whoshare" className="text-blue-600 dark:text-blue-400 hover:underline">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#cookies" className="text-blue-600 dark:text-blue-400 hover:underline">4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#ai" className="text-blue-600 dark:text-blue-400 hover:underline">5. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#sociallogins" className="text-blue-600 dark:text-blue-400 hover:underline">6. HOW DO WE HANDLE YOUR SOCIAL LOGINS?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#inforetain" className="text-blue-600 dark:text-blue-400 hover:underline">7. HOW LONG DO WE KEEP YOUR INFORMATION?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#infosafe" className="text-blue-600 dark:text-blue-400 hover:underline">8. HOW DO WE KEEP YOUR INFORMATION SAFE?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#privacyrights" className="text-blue-600 dark:text-blue-400 hover:underline">9. WHAT ARE YOUR PRIVACY RIGHTS?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#DNT" className="text-blue-600 dark:text-blue-400 hover:underline">10. CONTROLS FOR DO-NOT-TRACK FEATURES</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#uslaws" className="text-blue-600 dark:text-blue-400 hover:underline">11. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#policyupdates" className="text-blue-600 dark:text-blue-400 hover:underline">12. DO WE MAKE UPDATES TO THIS NOTICE?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#contact" className="text-blue-600 dark:text-blue-400 hover:underline">13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</a>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span style={{ fontSize: '15px' }}>
                <a href="#request" className="text-blue-600 dark:text-blue-400 hover:underline">14. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</a>
              </span>
            </div>
            <div><br /></div>
            <div><br /></div>

            {/* Section 1: What Information Do We Collect */}
            <div id="infocollect" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>1. WHAT INFORMATION DO WE COLLECT?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div id="personalinfo" style={{ lineHeight: '1.5' }}>
              <span data-custom-class="heading_2" className="text-gray-900 dark:text-slate-100">
                <strong><h3>Personal information you disclose to us</h3></strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We collect personal information that you provide to us.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:
                </span>
              </span>
            </div>
            <ul>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">email addresses</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">usernames</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">passwords</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">names</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">billing addresses</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">debit/credit card numbers</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">contact or authentication data</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">mailing addresses</span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">location</span>
              </li>
            </ul>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Sensitive Information.</strong> We do not process sensitive information.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Payment Data.</strong> We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by Stripe. You may find their privacy notice link here: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://stripe.com/privacy</a>.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Payment type: Subscription payments for Premium features. Payment processor: Stripe. What users can purchase: Premium subscription plans. Payment data handling: Stripe processes all payment information securely (PCI-DSS compliant).
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Social Media Login Data.</strong> We may provide you with the option to register with us using your existing social media account details, like your Facebook, X, or other social media account. If you choose to register in this way, we will collect certain profile information about you from the social media provider, as described in the section called &quot;HOW DO WE HANDLE YOUR SOCIAL LOGINS?&quot; below.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Application Data.</strong> If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:
                </span>
              </span>
            </div>
            <ul>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <em>Push Notifications.</em> We may request to send you push notifications regarding your account or certain features of the application(s). If you wish to opt out from receiving these types of communications, you may turn them off in your device&apos;s settings.
                </span>
              </li>
            </ul>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Information automatically collected */}
            <div style={{ lineHeight: '1.5' }}>
              <span data-custom-class="heading_2" className="text-gray-900 dark:text-slate-100">
                <strong><h3>Information automatically collected</h3></strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Like many businesses, we also collect information through cookies and similar technologies.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  The information we collect includes:
                </span>
              </span>
            </div>
            <ul>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <em>Log and Usage Data.</em> Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files.
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <em>Device Data.</em> We collect device data such as information about your computer, phone, tablet, or other device you use to access the Services.
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <em>Location Data.</em> We collect location data such as information about your device&apos;s location, which can be either precise or imprecise.
                </span>
              </li>
            </ul>
            <div><br /></div>

            {/* Section 2: How Do We Process Your Information */}
            <div id="infouse" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We process your personal information for a variety of reasons, depending on how you interact with our Services, including:
                </span>
              </span>
            </div>
            <ul>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To facilitate account creation and authentication</strong> and otherwise manage user accounts
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To deliver and facilitate delivery of services</strong> to the user
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To respond to user inquiries/offer support</strong> to users
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To send administrative information</strong> to you
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To fulfill and manage your orders</strong>
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To request feedback</strong>
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To protect our Services</strong>
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To identify usage trends</strong>
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>To save or protect an individual&apos;s vital interest</strong>
                </span>
              </li>
            </ul>
            <div><br /></div>

            {/* Section 3: When and With Whom Do We Share */}
            <div id="whoshare" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We may share information in specific situations described in this section and/or with the following third parties.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We may need to share your personal information in the following situations:
                </span>
              </span>
            </div>
            <ul>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Affiliates.</strong> We may share your information with our affiliates, in which case we will require those affiliates to honor this Privacy Notice.
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Business Partners.</strong> We may share your information with our business partners to offer you certain products, services, or promotions.
                </span>
              </li>
              <li className="text-gray-600 dark:text-slate-300" style={{ lineHeight: '1.5', fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Other Users.</strong> When you share personal information or otherwise interact in the public areas with other users, such information may be viewed by all users and may be publicly distributed outside.
                </span>
              </li>
            </ul>
            <div><br /></div>

            {/* Section 4: Cookies */}
            <div id="cookies" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We may use cookies and other tracking technologies to collect and store your information.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 5: AI */}
            <div id="ai" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>5. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (collectively, &quot;AI Products&quot;). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Our AI Products</strong>
                </span>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Our AI Products are designed for the following functions: AI study partner chatbot for educational assistance, quiz and flashcard generation, and image analysis for educational content.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>How We Process Your Data Using AI</strong>
                </span>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data&apos;s safety.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 6: Social Logins */}
            <div id="sociallogins" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>6. HOW DO WE HANDLE YOUR SOCIAL LOGINS?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Our Services offer you the ability to register and log in using your third-party social media account details (like your Facebook or X logins). Where you choose to do this, we will receive certain profile information about you from your social media provider. The profile information we receive may vary depending on the social media provider concerned, but will often include your name, email address, friends list, and profile picture, as well as other information you choose to make public on such a social media platform.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We will use the information we receive only for the purposes that are described in this Privacy Notice or that are otherwise made clear to you on the relevant Services. Please note that we do not control, and are not responsible for, other uses of your personal information by your third-party social media provider. We recommend that you review their privacy notice to understand how they collect, use, and share your personal information, and how you can set your privacy preferences on their sites and apps.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 7: How Long Do We Keep */}
            <div id="inforetain" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>7. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 8: How Do We Keep Your Information Safe */}
            <div id="infosafe" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>8. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>We aim to protect your personal information through a system of organizational and technical security measures.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 9: What Are Your Privacy Rights */}
            <div id="privacyrights" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>9. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong>Account Information:</strong> If you would at any time like to review or change the information in your account or terminate your account, you can log in to your account settings and update your user account, or contact us using the contact information provided.
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 10: Controls for Do-Not-Track */}
            <div id="DNT" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>10. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (&quot;DNT&quot;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 11: US Residents Rights */}
            <div id="uslaws" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>11. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>If you are a resident of certain US states, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We may also collect other personal information outside of these categories through instances where you interact with us in person, online, or by phone or mail in the context of receiving help through our customer support channels, participation in customer surveys or contests, and facilitation in the delivery of our Services and to respond to your inquiries.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 12: Do We Make Updates */}
            <div id="policyupdates" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>12. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  <strong><em>In Short:</em></strong> <em>Yes, we will update this notice as necessary to stay compliant with relevant laws.</em>
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 13: How Can You Contact Us */}
            <div id="contact" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  If you have questions or comments about this notice, you may email us at <a href="mailto:privacy@clerva.app" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@clerva.app</a> or contact us by post at:
                </span>
              </span>
            </div>
            <div><br /></div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Minh Pham<br />
                  Clerva<br />
                  United States
                </span>
              </span>
            </div>
            <div><br /></div>

            {/* Section 14: How Can You Review, Update, or Delete */}
            <div id="request" style={{ lineHeight: '1.5' }}>
              <span className="text-gray-900 dark:text-slate-100">
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>14. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
                  </span>
                </strong>
              </span>
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <span className="text-gray-600 dark:text-slate-300" style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit: <a href="https://www.clerva.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.clerva.app</a>.
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
