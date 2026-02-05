// PublicProjectsPage.jsx - Projects page with filtering and project cards
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { FlaskConical, Heart, Anchor, ArrowRight, Building2 } from 'lucide-react';
import PageHero from '../shared/PageHero';
import FeaturedProjectCard from '../shared/FeaturedProjectCard';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import {
  projectsPageData,
  featuredProjectsData,
  ongoingProjectsData,
  earlyStageProjectsData,
  ctaData,
} from '../../../data/publicSiteData';

// Icon mapping for early stage projects
const iconMap = {
  FlaskConical,
  Heart,
  Anchor,
};

// Simpler project card for ongoing projects
function ProjectCard({ title, type, status, client, clientIcon, description }) {
  const ClientIcon = LucideIcons[clientIcon] || Building2;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Image placeholder */}
      <div className="h-40 bg-gradient-to-br from-pub-blue-100 to-pub-blue-200 flex items-center justify-center relative">
        <LucideIcons.BarChart3 className="w-12 h-12 text-pub-blue-400" />
        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium capitalize bg-amber-100 text-amber-700">
          {status}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        <span className="text-sm text-gray-500">{type}</span>
        <h4 className="text-lg font-bold text-gray-900 mt-1 mb-2">{title}</h4>
        <p className="flex items-center gap-2 text-gray-600 text-sm mb-3">
          <ClientIcon className="w-4 h-4" />
          {client}
        </p>
        <p className="text-gray-600 text-sm line-clamp-3">{description}</p>
      </div>
    </div>
  );
}

export default function PublicProjectsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const { hero, filters } = projectsPageData;

  useEffect(() => {
    document.title = 'Projects | Utah Valley Research Lab';
  }, []);
  const projectsCta = ctaData.projects;

  // Combine all projects for filtering
  const allFeatured = featuredProjectsData;
  const allOngoing = ongoingProjectsData;

  // Filter projects based on active filter
  const filteredFeatured = allFeatured.filter((project) => {
    if (activeFilter === 'All') return true;
    return project.status.toLowerCase() === activeFilter.toLowerCase();
  });

  const filteredOngoing = allOngoing.filter((project) => {
    if (activeFilter === 'All') return true;
    return project.status.toLowerCase() === activeFilter.toLowerCase();
  });

  // Show sections based on filter
  const showFeatured = activeFilter === 'All' || activeFilter === 'Completed' || filteredFeatured.length > 0;
  const showOngoing = activeFilter === 'All' || activeFilter === 'Ongoing' || filteredOngoing.length > 0;
  const showEarlyStage = activeFilter === 'All';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <PageHero title={hero.title} subtitle={hero.subtitle} />

      {/* Projects Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Buttons */}
          <ScrollAnimateWrapper>
            <div className="flex justify-center gap-3 mb-12">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeFilter === filter
                      ? 'bg-pub-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-pub-blue-300 hover:text-pub-blue-600'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </ScrollAnimateWrapper>

          {/* Featured Projects */}
          {showFeatured && filteredFeatured.length > 0 && (
            <div className="mb-16">
              <ScrollAnimateWrapper>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Featured Projects</h3>
              </ScrollAnimateWrapper>
              <div className="space-y-8">
                {filteredFeatured.map((project, index) => (
                  <ScrollAnimateWrapper key={project.id} delay={index * 100}>
                    <FeaturedProjectCard
                      title={project.title}
                      type={project.type}
                      status={project.status}
                      client={project.client}
                      clientIcon={project.clientIcon}
                      description={project.fullDescription || project.description}
                      highlights={project.highlights}
                      findings={project.findings}
                      isFeatured={project.isFeatured}
                    />
                  </ScrollAnimateWrapper>
                ))}
              </div>
            </div>
          )}

          {/* Ongoing Projects */}
          {showOngoing && filteredOngoing.length > 0 && (
            <div className="mb-16">
              <ScrollAnimateWrapper>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Ongoing Projects</h3>
              </ScrollAnimateWrapper>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOngoing.map((project, index) => (
                  <ScrollAnimateWrapper key={project.id} delay={index * 100}>
                    <ProjectCard
                      title={project.title}
                      type={project.type}
                      status={project.status}
                      client={project.client}
                      clientIcon={project.clientIcon}
                      description={project.description}
                    />
                  </ScrollAnimateWrapper>
                ))}
              </div>
            </div>
          )}

          {/* Early Stage Projects */}
          {showEarlyStage && (
            <div className="mb-16">
              <ScrollAnimateWrapper>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Early Stage</h3>
              </ScrollAnimateWrapper>
              <ScrollAnimateWrapper delay={100}>
                <div className="flex flex-wrap gap-4">
                  {earlyStageProjectsData.map((project, index) => {
                    const Icon = iconMap[project.icon] || FlaskConical;
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 px-5 py-3 bg-white rounded-full border border-gray-200 hover:border-pub-blue-300 hover:shadow-md transition-all duration-200"
                      >
                        <Icon className="w-5 h-5 text-pub-blue-600" />
                        <span className="text-gray-700 font-medium">{project.name}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollAnimateWrapper>
            </div>
          )}

          {/* No Results Message */}
          {filteredFeatured.length === 0 && filteredOngoing.length === 0 && (
            <ScrollAnimateWrapper>
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  No {activeFilter.toLowerCase()} projects found.
                </p>
              </div>
            </ScrollAnimateWrapper>
          )}

          {/* CTA Section */}
          <ScrollAnimateWrapper>
            <div className="bg-gradient-to-br from-pub-blue-600 to-pub-blue-700 rounded-2xl p-8 md:p-12 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {projectsCta.title}
              </h3>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                {projectsCta.description}
              </p>
              <Link
                to={projectsCta.cta.path}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-pub-blue-700 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                {projectsCta.cta.label}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
