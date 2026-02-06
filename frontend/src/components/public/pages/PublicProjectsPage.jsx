// PublicProjectsPage.jsx - Projects page fetching from API with filtering
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import PageHero from '../shared/PageHero';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import { usePublishStore } from '../../../store/publishStore';
import {
  projectsPageData,
  ctaData,
} from '../../../data/publicSiteData';

// Project card for published projects
function ProjectCard({ title, status, description, image }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Image */}
      <div className="h-40 bg-gradient-to-br from-pub-blue-100 to-pub-blue-200 flex items-center justify-center relative">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
            }}
          />
        ) : null}
        {!image && <BarChart3 className="w-12 h-12 text-pub-blue-400" />}
        <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium capitalize ${
          status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {status}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        <h4 className="text-lg font-bold text-gray-900 mt-1 mb-2">{title}</h4>
        <p className="text-gray-600 text-sm line-clamp-3">{description}</p>
      </div>
    </div>
  );
}

export default function PublicProjectsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const { hero, filters } = projectsPageData;
  const { publicProjects, isLoading, fetchPublicProjects } = usePublishStore();

  useEffect(() => {
    document.title = 'Projects | Utah Valley Research Lab';
    fetchPublicProjects();
  }, [fetchPublicProjects]);

  const projectsCta = ctaData.projects;

  // Filter projects based on active filter
  const filteredProjects = publicProjects.filter((project) => {
    if (activeFilter === 'All') return true;
    return project.published_status?.toLowerCase() === activeFilter.toLowerCase();
  });

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

          {/* Loading State */}
          {isLoading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="h-40 bg-gray-100 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Projects Grid */}
          {!isLoading && filteredProjects.length > 0 && (
            <div className="mb-16">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project, index) => (
                  <ScrollAnimateWrapper key={project.id} delay={index * 100}>
                    <ProjectCard
                      title={project.published_title}
                      status={project.published_status}
                      description={project.published_description}
                      image={project.published_image}
                    />
                  </ScrollAnimateWrapper>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProjects.length === 0 && (
            <ScrollAnimateWrapper>
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {activeFilter === 'All'
                    ? 'No projects published yet.'
                    : `No ${activeFilter.toLowerCase()} projects found.`}
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
