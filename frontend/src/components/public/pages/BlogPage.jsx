// BlogPage.jsx - Blog & Research page with coming soon content
import { useState, useEffect } from 'react';
import { Newspaper, FlaskConical, Briefcase, GraduationCap, Megaphone, Linkedin } from 'lucide-react';
import PageHero from '../shared/PageHero';
import SectionHeader from '../shared/SectionHeader';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import { blogPageData } from '../../../data/publicSiteData';

// Icon mapping for preview cards
const iconMap = {
  FlaskConical,
  Briefcase,
  GraduationCap,
  Megaphone,
};

export default function BlogPage() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    document.title = 'Blog & Research | Utah Valley Research Lab';
  }, []);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    // Simulate subscription
    if (email) {
      setIsSubscribed(true);
      setEmail('');
    }
  };

  const { hero, comingSoon, previewCards, newsletter, socialFollow } = blogPageData;

  return (
    <div className="min-h-screen">
      {/* Page Hero */}
      <PageHero title={hero.title} subtitle={hero.subtitle} />

      {/* Blog Content Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Coming Soon Message */}
          <ScrollAnimateWrapper animation="fade-up">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="w-20 h-20 bg-pub-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Newspaper className="w-10 h-10 text-pub-blue-600" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {comingSoon.title}
              </h2>
              <p className="text-xl text-gray-600 mb-4">
                {comingSoon.lead}
              </p>
              <p className="text-gray-500">
                {comingSoon.description}
              </p>
            </div>
          </ScrollAnimateWrapper>

          {/* Preview Cards Section */}
          <ScrollAnimateWrapper animation="fade-up" delay={100}>
            <div className="mb-16">
              <SectionHeader
                title="What to Expect"
                centered={true}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {previewCards.map((card, index) => {
                  const IconComponent = iconMap[card.icon];
                  return (
                    <ScrollAnimateWrapper
                      key={index}
                      animation="fade-up"
                      delay={index * 100}
                    >
                      <div className="bg-gray-50 rounded-xl p-6 h-full border border-gray-100 hover:shadow-lg hover:border-pub-blue-200 transition-all duration-300">
                        <div className="w-12 h-12 bg-pub-blue-100 rounded-lg flex items-center justify-center mb-4">
                          {IconComponent && (
                            <IconComponent className="w-6 h-6 text-pub-blue-600" />
                          )}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          {card.title}
                        </h4>
                        <p className="text-gray-600 text-sm">
                          {card.description}
                        </p>
                      </div>
                    </ScrollAnimateWrapper>
                  );
                })}
              </div>
            </div>
          </ScrollAnimateWrapper>

          {/* Newsletter Signup Section */}
          <ScrollAnimateWrapper animation="fade-up" delay={200}>
            <div className="bg-gradient-to-br from-pub-blue-50 to-pub-blue-100 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {newsletter.title}
              </h3>
              <p className="text-gray-600 mb-6">
                {newsletter.description}
              </p>

              {!isSubscribed ? (
                <form onSubmit={handleNewsletterSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={newsletter.placeholder}
                      required
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors"
                    >
                      {newsletter.buttonText}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">
                    {newsletter.note}
                  </p>
                </form>
              ) : (
                <div className="bg-white rounded-lg p-6">
                  <div className="w-12 h-12 bg-pub-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-pub-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">
                    You're subscribed!
                  </h4>
                  <p className="text-gray-600">
                    We'll notify you when new content is available.
                  </p>
                </div>
              )}
            </div>
          </ScrollAnimateWrapper>

          {/* Social Follow Section */}
          <ScrollAnimateWrapper animation="fade-up" delay={300}>
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                {socialFollow.text}
              </p>
              <a
                href={socialFollow.button.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0077B5] text-white font-semibold rounded-lg hover:bg-[#006396] transition-colors"
              >
                <Linkedin className="w-5 h-5" />
                {socialFollow.button.label}
              </a>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
