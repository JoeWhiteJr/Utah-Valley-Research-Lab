-- Site Content CMS tables
-- Stores editable public site content with JSON values

CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, key)
);

CREATE TABLE IF NOT EXISTS public_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  title VARCHAR(255),
  bio TEXT DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'member',
  email VARCHAR(255),
  linkedin_url VARCHAR(500),
  photo_url VARCHAR(500),
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content(section);
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_content_section_key ON site_content(section, key);
CREATE INDEX IF NOT EXISTS idx_public_team_category ON public_team_members(category);
CREATE INDEX IF NOT EXISTS idx_public_team_visible ON public_team_members(is_visible);
CREATE INDEX IF NOT EXISTS idx_public_team_order ON public_team_members(display_order);

-- Updated-at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_content_updated_at ON site_content;
CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS public_team_members_updated_at ON public_team_members;
CREATE TRIGGER public_team_members_updated_at
  BEFORE UPDATE ON public_team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed hero content
INSERT INTO site_content (section, key, value) VALUES
  ('hero', 'main', '{"title": "Utah Valley Research Lab", "tagline": "Turning Raw Data into Real Insight", "description": "Providing students real-world experience applying statistics and data analytics while helping businesses and communities make data-driven decisions.", "primaryCta": {"label": "View Our Work", "path": "/projects"}, "secondaryCta": {"label": "Get In Touch", "path": "/contact"}}'),
  ('stats', 'main', '[{"number": "7+", "label": "Active Projects"}, {"number": "22+", "label": "Team Members"}, {"number": "6", "label": "Partner Organizations"}]'),
  ('about', 'summary', '{"label": "About Us", "title": "Empowering Students Through Real-World Analytics", "description": "We bridge the gap between academic learning and professional practice. Our team conducts rigorous statistical analysis, data visualization, and research projects for businesses, government, and academic institutions.", "highlights": ["MaxDiff & Conjoint Analysis", "UX/Usability Research", "Statistical Modeling & Causal Inference"], "cta": {"label": "Learn More About Us", "path": "/about"}}'),
  ('about', 'page', '{"hero": {"title": "About Us", "subtitle": "Empowering students through real-world analytics"}, "mission": {"title": "Our Mission", "lead": "The Utah Valley Research Lab bridges the gap between academic learning and professional practice by providing students with hands-on experience in statistical analysis and data science.", "description": "We partner with businesses, government agencies, and non-profit organizations to deliver rigorous, actionable research while training the next generation of data professionals."}}'),
  ('contact', 'main', '{"email": "ronald.miller@uvu.edu", "phone": "(801) 863-8232", "phoneRaw": "8018638232", "address": "MS 119, 800 W. University Parkway", "city": "Orem", "state": "UT", "zip": "84058", "officeHours": "Monday - Friday: 9:00 AM - 5:00 PM", "googleMapsUrl": "https://maps.google.com/?q=800+W+University+Parkway,+Orem,+UT+84058"}'),
  ('faq', 'main', '[{"question": "How long does a typical project take?", "answer": "Project timelines vary based on scope and complexity. Simple analyses may take 2-4 weeks, while comprehensive research projects can span several months."}, {"question": "What does it cost to work with the Stats Lab?", "answer": "As a non-profit focused on student education, we offer competitive rates. We''ll provide a detailed quote after understanding your project requirements."}, {"question": "How can I join as a student member?", "answer": "We welcome motivated students interested in statistics and data analytics. Use the contact form above with \"Join the Lab\" selected to express your interest."}, {"question": "What industries do you work with?", "answer": "We work across sectors including government, software, education, non-profits, and business. If you have data challenges, we''d love to discuss how we can help."}]'),
  ('donate', 'main', '{"hero": {"title": "Support Our Mission", "subtitle": "Help us empower the next generation of data professionals"}, "intro": {"title": "Why Your Support Matters", "lead": "The Utah Valley Research Lab bridges academic learning with real-world impact. Your contribution directly supports student researchers and community-focused projects."}}'),
  ('services', 'main', '[{"icon": "BarChart3", "title": "Survey Research", "description": "MaxDiff, conjoint analysis, and comprehensive survey design and analysis"}, {"icon": "MonitorSmartphone", "title": "UX Research", "description": "Usability studies, SUS scoring, and user experience evaluation"}, {"icon": "Workflow", "title": "Process Mapping", "description": "Workflow documentation, bottleneck identification, and optimization"}, {"icon": "Brain", "title": "Psychometrics", "description": "Instrument development, validation, and reliability testing"}, {"icon": "TrendingUp", "title": "Impact Measurement", "description": "SROI, IRIS+, and comprehensive impact framework analysis"}, {"icon": "Calculator", "title": "Statistical Modeling", "description": "Regression, causal inference, and advanced statistical analysis"}]')
ON CONFLICT (section, key) DO NOTHING;

-- Seed team members
INSERT INTO public_team_members (name, role, title, bio, category, email, linkedin_url, display_order) VALUES
  ('Dr. Ronald Miller', 'Director', NULL, 'Leading the Stats Lab with expertise in statistical methodology and psychometric research.', 'leadership', 'ronald.miller@uvu.edu', '#', 1),
  ('Dr. David Benson', 'Director', NULL, 'Co-director providing strategic guidance and research oversight.', 'leadership', 'david.benson@uvu.edu', '#', 2),
  ('Dr. Phil Witt', 'Leadership', NULL, 'Faculty advisor supporting student research initiatives.', 'leadership', NULL, '#', 3),
  ('Prof. Greg Cronin', 'Leadership', NULL, 'Faculty advisor with expertise in business analytics.', 'leadership', NULL, '#', 4),
  ('Sam Johnston', 'Lab Lead', NULL, 'Student leader coordinating project teams and client relationships.', 'lab_lead', 'sam.johnston@uvu.edu', '#', 1),
  ('Joseph White', 'Lab Lead', NULL, 'Student leader managing research operations and team development.', 'lab_lead', NULL, '#', 2),
  ('Jared Williams', 'Project Member', NULL, '', 'member', NULL, NULL, 1),
  ('Emery Holden', 'Project Member', NULL, '', 'member', NULL, NULL, 2),
  ('Parris Holden', 'Project Member', NULL, '', 'member', NULL, NULL, 3),
  ('Isaac Davis', 'Project Member', NULL, '', 'member', NULL, NULL, 4),
  ('Park Anderson', 'Project Member', NULL, '', 'member', NULL, NULL, 5),
  ('Connor Ross', 'Project Member', NULL, '', 'member', NULL, NULL, 6),
  ('Harry Nemelka', 'Project Member', NULL, '', 'member', NULL, NULL, 7),
  ('James Douglas', 'Project Member', NULL, '', 'member', NULL, NULL, 8),
  ('Landon Memmott', 'Project Member', NULL, '', 'member', NULL, NULL, 9),
  ('Weston Hutchings', 'Project Member', NULL, '', 'member', NULL, NULL, 10),
  ('Wyatt Richard', 'Project Member', NULL, '', 'member', NULL, NULL, 11),
  ('Zach Peterson', 'Project Member', NULL, '', 'member', NULL, NULL, 12),
  ('Vasu Chetty', 'Professional Acquaintance', NULL, 'Industry partner supporting Stats Lab initiatives.', 'partner', NULL, NULL, 1)
ON CONFLICT (name, category) DO NOTHING;
