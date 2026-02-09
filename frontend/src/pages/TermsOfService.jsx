import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  useEffect(() => {
    document.title = 'Terms of Service | Utah Valley Research Lab';
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-pub-blue-600 to-pub-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-white/80 text-lg">Last updated: February 9, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray max-w-none">
          <p className="text-lg text-gray-600 mb-8">
            Welcome to Utah Valley Research Lab (&quot;UVRL,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By
            accessing or using our website and services, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-6">
            By accessing our website at utahvalleyresearchlab.com or using any of our services, you
            acknowledge that you have read, understood, and agree to be bound by these Terms of
            Service and our{' '}
            <Link to="/privacy" className="text-pub-blue-600 hover:text-pub-blue-700">
              Privacy Policy
            </Link>
            . These terms apply to all visitors, users, and members of the lab.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">2. Description of Services</h2>
          <p className="text-gray-600 mb-6">
            UVRL provides a research project management platform for lab members, a public-facing
            website with information about our research, and related services. Access to certain
            features requires an approved account.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">3. Acceptable Use</h2>
          <p className="text-gray-600 mb-4">When using our services, you agree not to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-6">
            <li>Use the platform for any unlawful purpose or in violation of any applicable laws</li>
            <li>Attempt to gain unauthorized access to any part of the platform or its systems</li>
            <li>Interfere with or disrupt the integrity or performance of the services</li>
            <li>Upload or transmit viruses, malware, or other harmful code</li>
            <li>Harass, abuse, or harm other users or lab members</li>
            <li>Share your account credentials with unauthorized individuals</li>
            <li>Misrepresent your identity or affiliation with the lab</li>
            <li>Scrape, crawl, or collect data from the platform without authorization</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">4. User Accounts</h2>
          <p className="text-gray-600 mb-6">
            Access to the research management platform requires an approved account. You are
            responsible for maintaining the confidentiality of your account credentials and for all
            activities that occur under your account. You agree to notify us immediately of any
            unauthorized use of your account.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">5. Account Termination</h2>
          <p className="text-gray-600 mb-6">
            We reserve the right to suspend or terminate your account at any time, with or without
            notice, for conduct that we believe violates these Terms of Service, is harmful to other
            users, or is otherwise inappropriate. Upon termination, your right to access the platform
            will immediately cease. You may also request account deletion at any time by contacting
            us.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">6. Intellectual Property</h2>
          <p className="text-gray-600 mb-6">
            All content on this website, including text, graphics, logos, and software, is the
            property of Utah Valley Research Lab or its content suppliers and is protected by
            applicable intellectual property laws. Research outputs and data generated through the
            platform are subject to separate agreements between the lab and its members.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">7. Limitation of Liability</h2>
          <p className="text-gray-600 mb-6">
            To the fullest extent permitted by applicable law, UVRL and its directors, employees,
            and affiliates shall not be liable for any indirect, incidental, special, consequential,
            or punitive damages, including but not limited to loss of data, revenue, or profits,
            arising out of or related to your use of our services. Our total liability for any claims
            arising from these terms or your use of the services shall not exceed the amount you paid
            us, if any, during the twelve months preceding the claim. The services are provided
            &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">8. Indemnification</h2>
          <p className="text-gray-600 mb-6">
            You agree to indemnify, defend, and hold harmless UVRL, its officers, directors,
            employees, and agents from any claims, liabilities, damages, losses, or expenses
            (including reasonable attorneys&apos; fees) arising from your use of the services or
            violation of these terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">9. Governing Law</h2>
          <p className="text-gray-600 mb-6">
            These Terms of Service shall be governed by and construed in accordance with the laws of
            the State of Utah, without regard to its conflict of law provisions. Any disputes arising
            from these terms or your use of our services shall be resolved in the state or federal
            courts located in Utah County, Utah.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">10. Changes to Terms</h2>
          <p className="text-gray-600 mb-6">
            We reserve the right to modify these Terms of Service at any time. We will notify users
            of significant changes by posting the updated terms on this page and updating the
            &quot;Last updated&quot; date. Your continued use of our services after changes are posted
            constitutes acceptance of the revised terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">11. Contact Us</h2>
          <p className="text-gray-600 mb-6">
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <ul className="list-none pl-0 text-gray-600 space-y-1 mb-8">
            <li><strong>Email:</strong> ronald.miller@uvu.edu</li>
            <li><strong>Phone:</strong> (801) 863-8232</li>
            <li><strong>Address:</strong> MS 119, 800 W. University Parkway, Orem, UT 84058</li>
          </ul>

          <div className="border-t border-gray-200 pt-8 mt-12">
            <p className="text-gray-500 text-sm">
              See also our{' '}
              <Link to="/privacy" className="text-pub-blue-600 hover:text-pub-blue-700">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
