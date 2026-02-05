// TeamPage.jsx - Team page with leadership, lab leads, members, and partners
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHero from '../shared/PageHero';
import TeamCard from '../shared/TeamCard';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import { teamData, ctaData } from '../../../data/publicSiteData';

export default function TeamPage() {
  useEffect(() => {
    document.title = 'Our Team | Utah Valley Research Lab';
  }, []);

  const { leadership, labLeads, members, partners } = teamData;
  const teamCta = ctaData.team;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <PageHero title="Our Team" subtitle="Meet the people behind the insights" />

      {/* Team Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Leadership Section */}
          <div className="mb-16">
            <ScrollAnimateWrapper>
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Leadership</h3>
            </ScrollAnimateWrapper>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {leadership.map((member, index) => (
                <ScrollAnimateWrapper key={member.id} delay={index * 100}>
                  <TeamCard
                    name={member.name}
                    role={member.role}
                    bio={member.bio}
                    email={member.email}
                    linkedin={member.linkedin}
                  />
                </ScrollAnimateWrapper>
              ))}
            </div>
          </div>

          {/* Lab Leads Section */}
          <div className="mb-16">
            <ScrollAnimateWrapper>
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Lab Leads</h3>
            </ScrollAnimateWrapper>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {labLeads.map((member, index) => (
                <ScrollAnimateWrapper key={member.id} delay={index * 100}>
                  <TeamCard
                    name={member.name}
                    role={member.role}
                    bio={member.bio}
                    email={member.email}
                    linkedin={member.linkedin}
                  />
                </ScrollAnimateWrapper>
              ))}
            </div>
          </div>

          {/* Active Members Section */}
          <div className="mb-16">
            <ScrollAnimateWrapper>
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Active Project Members</h3>
            </ScrollAnimateWrapper>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {members.map((member, index) => (
                <ScrollAnimateWrapper key={member.id} delay={index * 50}>
                  <TeamCard
                    name={member.name}
                    role={member.role}
                    compact={true}
                  />
                </ScrollAnimateWrapper>
              ))}
            </div>
          </div>

          {/* Professional Partners Section */}
          {partners && partners.length > 0 && (
            <div className="mb-16">
              <ScrollAnimateWrapper>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Professional Partners</h3>
              </ScrollAnimateWrapper>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {partners.map((partner, index) => (
                  <ScrollAnimateWrapper key={partner.id} delay={index * 100}>
                    <TeamCard
                      name={partner.name}
                      role={partner.role}
                      bio={partner.bio}
                    />
                  </ScrollAnimateWrapper>
                ))}
              </div>
            </div>
          )}

          {/* Join CTA Section */}
          <ScrollAnimateWrapper>
            <div className="bg-gradient-to-br from-pub-blue-600 to-pub-blue-700 rounded-2xl p-8 md:p-12 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {teamCta.title}
              </h3>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                {teamCta.description}
              </p>
              <Link
                to={teamCta.cta.path}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-pub-blue-700 font-semibold rounded-lg hover:bg-pub-blue-50 transition-colors"
              >
                {teamCta.cta.label}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
