import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy | Utah Valley Research Lab';
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-pub-blue-600 to-pub-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-white/80 text-lg">Last updated: February 9, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray max-w-none">
          <p className="text-lg text-gray-600 mb-8">
            Utah Valley Research Lab (&quot;UVRL,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to
            protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard
            your information when you visit our website or use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">1. Information We Collect</h2>
          <p className="text-gray-600 mb-4">We may collect the following types of information:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
            <li>
              <strong>Contact Form Submissions:</strong> When you use our contact form, we collect
              your name, email address, organization, and message content.
            </li>
            <li>
              <strong>Applications:</strong> When you apply to join the lab, we collect your name,
              email, and any information you provide in your application.
            </li>
            <li>
              <strong>Account Information:</strong> If you create an account, we collect your name,
              email address, and login credentials.
            </li>
            <li>
              <strong>Usage Data:</strong> We may collect information about how you access and use
              our website, including your IP address, browser type, pages visited, and time spent on
              the site.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">2. How We Use Your Information</h2>
          <p className="text-gray-600 mb-4">We use the information we collect to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
            <li>Respond to your inquiries and contact form submissions</li>
            <li>Process and evaluate applications to the lab</li>
            <li>Provide and maintain our research project management platform</li>
            <li>Communicate with team members about projects and lab activities</li>
            <li>Improve our website and services</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">3. Cookies and Tracking</h2>
          <p className="text-gray-600 mb-6">
            Our website may use cookies and similar technologies to maintain your session, remember
            your preferences, and improve your experience. You can control cookie settings through
            your browser preferences. Essential cookies required for authentication and security
            cannot be disabled while using the platform.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">4. Third-Party Services</h2>
          <p className="text-gray-600 mb-6">
            We may use third-party services for hosting, analytics, and email delivery. These
            services may have access to your information only to perform tasks on our behalf and are
            obligated not to disclose or use it for other purposes. We do not sell your personal
            information to third parties.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">5. Data Retention</h2>
          <p className="text-gray-600 mb-6">
            We retain your personal information only for as long as necessary to fulfill the purposes
            outlined in this policy, unless a longer retention period is required or permitted by law.
            Contact form submissions are retained for up to two years. Account data is retained for
            the duration of your membership and may be deleted upon request after your participation
            ends.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">6. Data Security</h2>
          <p className="text-gray-600 mb-6">
            We implement appropriate technical and organizational measures to protect your personal
            information against unauthorized access, alteration, disclosure, or destruction. However,
            no method of transmission over the Internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">7. Your Rights</h2>
          <p className="text-gray-600 mb-4">You have the right to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your personal information</li>
            <li>Opt out of non-essential communications</li>
            <li>Withdraw consent where processing is based on consent</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">8. Changes to This Policy</h2>
          <p className="text-gray-600 mb-6">
            We may update this Privacy Policy from time to time. We will notify you of any changes by
            posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued
            use of our website after any changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">9. Contact Us</h2>
          <p className="text-gray-600 mb-6">
            If you have any questions about this Privacy Policy or wish to exercise your rights,
            please contact us:
          </p>
          <ul className="list-none pl-0 text-gray-600 space-y-1 mb-8">
            <li><strong>Email:</strong> ronald.miller@uvu.edu</li>
            <li><strong>Phone:</strong> (801) 863-8232</li>
            <li><strong>Address:</strong> MS 119, 800 W. University Parkway, Orem, UT 84058</li>
          </ul>

          <div className="border-t border-gray-200 pt-8 mt-12">
            <p className="text-gray-500 text-sm">
              See also our{' '}
              <Link to="/terms" className="text-pub-blue-600 hover:text-pub-blue-700">
                Terms of Service
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
