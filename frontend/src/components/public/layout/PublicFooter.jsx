import { Link } from 'react-router-dom';
import { TrendingUp, Mail, Phone, MapPin, Linkedin, Twitter, Github } from 'lucide-react';
import { siteInfo } from '../../../data/publicSiteData';

const quickLinks = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Projects', path: '/projects' },
  { label: 'Team', path: '/team' },
  { label: 'Contact', path: '/contact' },
];

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About Column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-pub-blue-600 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="font-semibold text-white">{siteInfo.name}</span>
            </div>
            <p className="text-gray-400 mb-2">{siteInfo.tagline}</p>
            <p className="text-gray-500 text-sm">{siteInfo.affiliation}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-pub-blue-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-pub-blue-500" />
                <a
                  href={`mailto:${siteInfo.contact.email}`}
                  className="text-gray-400 hover:text-pub-blue-400 transition-colors"
                >
                  {siteInfo.contact.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-pub-blue-500" />
                <a
                  href={`tel:${siteInfo.contact.phoneRaw}`}
                  className="text-gray-400 hover:text-pub-blue-400 transition-colors"
                >
                  {siteInfo.contact.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-pub-blue-500 mt-1" />
                <span className="text-gray-400">
                  {siteInfo.contact.city}, {siteInfo.contact.state} {siteInfo.contact.zip}
                </span>
              </li>
            </ul>
          </div>

          {/* Connect - only render social links that have real URLs */}
          {(() => {
            const socialLinks = [
              { url: siteInfo.social.linkedin, label: 'LinkedIn', Icon: Linkedin },
              { url: siteInfo.social.twitter, label: 'Twitter', Icon: Twitter },
              { url: siteInfo.social.github, label: 'GitHub', Icon: Github },
            ].filter(link => link.url && link.url !== '#');

            if (socialLinks.length === 0) return null;

            return (
              <div>
                <h4 className="font-semibold text-white mb-4">Connect</h4>
                <div className="flex gap-3">
                  {socialLinks.map(({ url, label, Icon }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-pub-blue-600 hover:text-white transition-colors"
                      aria-label={label}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; {currentYear} {siteInfo.name}. All rights reserved.</p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/privacy" className="hover:text-pub-blue-400 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-700">|</span>
            <Link to="/terms" className="hover:text-pub-blue-400 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
