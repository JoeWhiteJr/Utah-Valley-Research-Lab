// DonatePage.jsx - Donation page with impact cards, donation options, and transparency
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  GraduationCap,
  HelpingHand,
  PieChart,
  Presentation,
  Workflow,
  Laptop,
  Users,
  Share2,
  Check,
} from 'lucide-react';
import PageHero from '../shared/PageHero';
import SectionHeader from '../shared/SectionHeader';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import DonationAmountSelector from '../shared/DonationAmountSelector';
import { donatePageData } from '../../../data/publicSiteData';

// Icon mapping - maps data file icon names to lucide-react components
const iconMap = {
  GraduationCap,
  HandHelping: HelpingHand,  // lucide uses HelpingHand, data uses HandHelping
  PieChart,
  Presentation,
  Workflow,
  Laptop,
  Users,
  Share2,
};

export default function DonatePage() {
  useEffect(() => {
    document.title = 'Donate | Utah Valley Research Lab';
  }, []);

  const [oneTimeAmount, setOneTimeAmount] = useState(100);
  const [monthlyAmount, setMonthlyAmount] = useState(25);

  const { hero, intro, impactCards, oneTime, monthly, corporate, otherWays, transparency } = donatePageData;

  return (
    <div className="min-h-screen">
      {/* Page Hero - Using donate variant for different color */}
      <PageHero title={hero.title} subtitle={hero.subtitle} variant="donate" />

      {/* Intro Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimateWrapper animation="fade-up">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {intro.title}
              </h2>
              <p className="text-xl text-gray-600">
                {intro.lead}
              </p>
            </div>
          </ScrollAnimateWrapper>

          {/* Impact Cards */}
          <ScrollAnimateWrapper animation="fade-up" delay={100}>
            <div className="mb-20">
              <SectionHeader title="Your Impact" centered={true} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {impactCards.map((card, index) => {
                  const IconComponent = iconMap[card.icon];
                  return (
                    <ScrollAnimateWrapper
                      key={index}
                      animation="fade-up"
                      delay={index * 100}
                    >
                      <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg hover:border-pub-accent-300 transition-all duration-300 h-full">
                        <div className="w-14 h-14 bg-pub-accent-100 rounded-xl flex items-center justify-center mb-4">
                          {IconComponent && (
                            <IconComponent className="w-7 h-7 text-pub-accent-600" />
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

          {/* Donation Options */}
          <ScrollAnimateWrapper animation="fade-up" delay={200}>
            <div className="mb-20">
              <SectionHeader title="Make a Donation" centered={true} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* One-Time Gift Card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">
                    {oneTime.title}
                  </h4>
                  <p className="text-gray-600 mb-6">
                    {oneTime.description}
                  </p>
                  <DonationAmountSelector
                    amounts={oneTime.amounts}
                    defaultAmount={100}
                    onAmountChange={setOneTimeAmount}
                  />
                  <button className="w-full mt-6 py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Heart className="w-5 h-5" />
                    {oneTime.buttonText}
                  </button>
                  <p className="text-sm text-gray-500 text-center mt-3">
                    {oneTime.note}
                  </p>
                </div>

                {/* Monthly Giving Card - Featured */}
                <div className="relative bg-white rounded-2xl p-6 border-2 border-pub-accent-400 hover:shadow-lg transition-shadow">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-pub-accent-500 text-white text-sm font-semibold rounded-full">
                      {monthly.badge}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2 mt-2">
                    {monthly.title}
                  </h4>
                  <p className="text-gray-600 mb-6">
                    {monthly.description}
                  </p>
                  <DonationAmountSelector
                    amounts={monthly.amounts}
                    defaultAmount={25}
                    isMonthly={true}
                    onAmountChange={setMonthlyAmount}
                  />
                  <button className="w-full mt-6 py-3 bg-pub-accent-600 text-white font-semibold rounded-lg hover:bg-pub-accent-700 transition-colors flex items-center justify-center gap-2">
                    <Heart className="w-5 h-5" />
                    {monthly.buttonText}
                  </button>
                  <p className="text-sm text-gray-500 text-center mt-3">
                    {monthly.note}
                  </p>
                </div>

                {/* Corporate Sponsorship Card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">
                    {corporate.title}
                  </h4>
                  <p className="text-gray-600 mb-6">
                    {corporate.description}
                  </p>
                  <ul className="space-y-3 mb-6">
                    {corporate.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-pub-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={corporate.buttonPath}
                    className="block w-full py-3 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-center"
                  >
                    {corporate.buttonText}
                  </Link>
                </div>
              </div>
            </div>
          </ScrollAnimateWrapper>

          {/* Other Ways to Support */}
          <ScrollAnimateWrapper animation="fade-up" delay={300}>
            <div className="mb-20">
              <SectionHeader title="Other Ways to Support" centered={true} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {otherWays.map((item, index) => {
                  const IconComponent = iconMap[item.icon];
                  return (
                    <ScrollAnimateWrapper
                      key={index}
                      animation="fade-up"
                      delay={index * 75}
                    >
                      <div className="text-center p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="w-12 h-12 bg-pub-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                          {IconComponent && (
                            <IconComponent className="w-6 h-6 text-pub-blue-600" />
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      </div>
                    </ScrollAnimateWrapper>
                  );
                })}
              </div>
            </div>
          </ScrollAnimateWrapper>

          {/* Transparency Section */}
          <ScrollAnimateWrapper animation="fade-up" delay={400}>
            <div className="bg-gradient-to-br from-pub-blue-50 to-pub-blue-100 rounded-2xl p-8 md:p-12">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {transparency.title}
                </h3>
                <p className="text-gray-600">
                  {transparency.description}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-lg mx-auto">
                {transparency.stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-pub-blue-700 mb-1">
                      {stat.percentage}
                    </div>
                    <div className="text-sm text-gray-600">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
