// HomePage.jsx - Full home page with all sections
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Users,
  Building2,
  GraduationCap,
  Settings,
  Building,
  Rocket,
  BarChart3,
  MonitorSmartphone,
  Workflow,
  Brain,
  Calculator,
} from 'lucide-react';
import SectionHeader from '../shared/SectionHeader';
import ServiceCard from '../shared/ServiceCard';
import FeaturedProjectCard from '../shared/FeaturedProjectCard';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import {
  heroData,
  statsData,
  partnersData,
  aboutSummaryData,
  servicesData,
  featuredProjectsData,
  teamHighlightsData,
  ctaData,
} from '../../../data/publicSiteData';

// Icon mapping for partners
const partnerIconMap = {
  Building2,
  GraduationCap,
  Settings,
  Building,
  Rocket,
};

export default function HomePage() {
  useEffect(() => {
    document.title = 'Utah Valley Research Lab | UVRL';
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-pub-blue-700 via-pub-blue-600 to-pub-blue-800 pt-20">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 animate-fade-in-up">
              {heroData.title}
            </h1>
            <p className="text-xl md:text-2xl text-pub-blue-100 mb-4 animate-fade-in-up animation-delay-100">
              {heroData.tagline}
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8 animate-fade-in-up animation-delay-200">
              {heroData.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
              <Link
                to={heroData.primaryCta.path}
                className="px-8 py-3 bg-white text-pub-blue-700 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                {heroData.primaryCta.label}
              </Link>
              <Link
                to={heroData.secondaryCta.path}
                className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                {heroData.secondaryCta.label}
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-12 animate-fade-in-up animation-delay-400">
            {statsData.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-1">
                  {stat.number}
                </div>
                <div className="text-pub-blue-200 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Partners */}
          <div className="text-center animate-fade-in-up animation-delay-500">
            <p className="text-pub-blue-200 text-sm mb-4">Trusted by</p>
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              {partnersData.map((partner, index) => {
                const IconComponent = partnerIconMap[partner.icon];
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors"
                    title={partner.fullName}
                  >
                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                      {IconComponent && <IconComponent className="w-6 h-6" />}
                    </div>
                    <span className="text-xs">{partner.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* About Summary Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Image placeholder */}
            <ScrollAnimateWrapper animation="fade-right">
              <div className="h-80 lg:h-[400px] bg-gradient-to-br from-pub-blue-100 to-pub-blue-200 rounded-2xl flex items-center justify-center">
                <Users className="w-24 h-24 text-pub-blue-400" />
              </div>
            </ScrollAnimateWrapper>

            {/* Content */}
            <ScrollAnimateWrapper animation="fade-left" delay={100}>
              <div>
                <span className="inline-block px-4 py-1.5 bg-pub-blue-100 text-pub-blue-700 rounded-full text-sm font-medium mb-4">
                  {aboutSummaryData.label}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {aboutSummaryData.title}
                </h2>
                <p className="text-gray-600 mb-6">{aboutSummaryData.description}</p>
                <ul className="space-y-3 mb-8">
                  {aboutSummaryData.highlights.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-pub-blue-600" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={aboutSummaryData.cta.path}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors"
                >
                  {aboutSummaryData.cta.label}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </ScrollAnimateWrapper>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimateWrapper>
            <SectionHeader
              label="Our Work"
              title="Featured Projects"
              subtitle="Research and analytics that make a difference"
            />
          </ScrollAnimateWrapper>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {featuredProjectsData.slice(0, 3).map((project, index) => (
              <ScrollAnimateWrapper key={project.id} delay={index * 100}>
                <FeaturedProjectCard
                  title={project.title}
                  type={project.type}
                  status={project.status}
                  client={project.client}
                  clientIcon={project.clientIcon}
                  description={project.description}
                  highlights={project.highlights?.slice(0, 2)}
                />
              </ScrollAnimateWrapper>
            ))}
          </div>

          <ScrollAnimateWrapper delay={300}>
            <div className="text-center">
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors"
              >
                View All Projects
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>

      {/* Team Preview Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <ScrollAnimateWrapper animation="fade-right">
              <div>
                <span className="inline-block px-4 py-1.5 bg-pub-blue-100 text-pub-blue-700 rounded-full text-sm font-medium mb-4">
                  {teamHighlightsData.label}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {teamHighlightsData.title}
                </h2>
                <p className="text-gray-600 mb-8">{teamHighlightsData.description}</p>

                <div className="flex gap-8 mb-8">
                  {teamHighlightsData.stats.map((stat, index) => (
                    <div key={index}>
                      <div className="text-3xl font-bold text-pub-blue-700">{stat.number}</div>
                      <div className="text-sm text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <Link
                  to={teamHighlightsData.cta.path}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors"
                >
                  {teamHighlightsData.cta.label}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </ScrollAnimateWrapper>

            {/* Image placeholder */}
            <ScrollAnimateWrapper animation="fade-left" delay={100}>
              <div className="h-80 lg:h-[400px] bg-gradient-to-br from-pub-blue-100 to-pub-blue-200 rounded-2xl flex items-center justify-center relative">
                <Users className="w-24 h-24 text-pub-blue-400" />
                {/* Avatar group overlay */}
                <div className="absolute bottom-6 left-6 flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-12 h-12 rounded-full bg-pub-blue-300 border-2 border-white flex items-center justify-center"
                    >
                      <Users className="w-5 h-5 text-pub-blue-700" />
                    </div>
                  ))}
                  <div className="w-12 h-12 rounded-full bg-pub-blue-600 border-2 border-white flex items-center justify-center text-white text-sm font-medium">
                    +19
                  </div>
                </div>
              </div>
            </ScrollAnimateWrapper>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimateWrapper>
            <SectionHeader label="What We Offer" title="Our Services" />
          </ScrollAnimateWrapper>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {servicesData.map((service, index) => (
              <ScrollAnimateWrapper key={index} delay={index * 75}>
                <ServiceCard
                  icon={service.icon}
                  title={service.title}
                  description={service.description}
                />
              </ScrollAnimateWrapper>
            ))}
          </div>

          <ScrollAnimateWrapper delay={400}>
            <div className="text-center">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-pub-blue-600 text-pub-blue-600 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                Learn More About Our Capabilities
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-pub-blue-600 to-pub-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimateWrapper>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {ctaData.home.title}
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              {ctaData.home.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={ctaData.home.primaryCta.path}
                className="px-8 py-3 bg-white text-pub-blue-700 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                {ctaData.home.primaryCta.label}
              </Link>
              <Link
                to={ctaData.home.secondaryCta.path}
                className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                {ctaData.home.secondaryCta.label}
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
