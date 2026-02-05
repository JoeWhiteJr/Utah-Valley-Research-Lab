// AboutPage.jsx - About page with mission, capabilities, and partners
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  Wrench,
  Search,
  Users,
  ArrowRight,
  Building2,
  GraduationCap,
  Settings,
  Building,
  Rocket,
  CheckCircle,
} from 'lucide-react';
import PageHero from '../shared/PageHero';
import SectionHeader from '../shared/SectionHeader';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import { aboutPageData, partnersData } from '../../../data/publicSiteData';

// Icon mapping
const iconMap = {
  Target,
  Wrench,
  Search,
  Users,
};

const partnerIconMap = {
  Building2,
  GraduationCap,
  Settings,
  Building,
  Rocket,
};

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About Us | Utah Valley Research Lab';
  }, []);

  const { hero, mission, cards, cta } = aboutPageData;

  return (
    <div className="min-h-screen">
      {/* Page Hero */}
      <PageHero title={hero.title} subtitle={hero.subtitle} />

      {/* Main Content */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mission Section */}
          <ScrollAnimateWrapper>
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  {mission.title}
                </h2>
                <p className="text-xl text-gray-600 mb-4 leading-relaxed">
                  {mission.lead}
                </p>
                <p className="text-gray-600">
                  {mission.description}
                </p>
              </div>
              <div className="h-80 lg:h-[400px] bg-gradient-to-br from-pub-blue-100 to-pub-blue-200 rounded-2xl flex items-center justify-center">
                <Target className="w-24 h-24 text-pub-blue-400" />
              </div>
            </div>
          </ScrollAnimateWrapper>

          {/* About Cards Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {cards.map((card, index) => {
              const IconComponent = iconMap[card.icon];
              return (
                <ScrollAnimateWrapper key={index} delay={index * 100}>
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow h-full">
                    {/* Card header with icon */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-pub-blue-100 rounded-xl flex items-center justify-center">
                          {IconComponent && (
                            <IconComponent className="w-7 h-7 text-pub-blue-600" />
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{card.title}</h3>
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="p-6">
                      {card.description && (
                        <p className="text-gray-600">{card.description}</p>
                      )}
                      {card.list && (
                        <ul className="space-y-3">
                          {card.list.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                              <CheckCircle className="w-5 h-5 text-pub-blue-600 flex-shrink-0" />
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </ScrollAnimateWrapper>
              );
            })}
          </div>

          {/* Partners Section */}
          <ScrollAnimateWrapper>
            <div className="mb-20">
              <SectionHeader
                title="Our Partners"
                subtitle="Trusted by leading organizations"
                centered={true}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {partnersData.map((partner, index) => {
                  const IconComponent = partnerIconMap[partner.icon];
                  return (
                    <ScrollAnimateWrapper key={index} delay={index * 75}>
                      <div className="flex flex-col items-center p-6 bg-gray-50 rounded-xl hover:bg-pub-blue-50 hover:shadow-md transition-all">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                          {IconComponent && (
                            <IconComponent className="w-8 h-8 text-pub-blue-600" />
                          )}
                        </div>
                        <span className="text-gray-700 font-medium text-center text-sm">
                          {partner.fullName}
                        </span>
                      </div>
                    </ScrollAnimateWrapper>
                  );
                })}
              </div>
            </div>
          </ScrollAnimateWrapper>

          {/* CTA Section */}
          <ScrollAnimateWrapper>
            <div className="bg-gradient-to-br from-pub-blue-600 to-pub-blue-700 rounded-2xl p-8 md:p-12 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {cta.title}
              </h3>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                {cta.description}
              </p>
              <Link
                to={cta.button.path}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-pub-blue-700 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                {cta.button.label}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
