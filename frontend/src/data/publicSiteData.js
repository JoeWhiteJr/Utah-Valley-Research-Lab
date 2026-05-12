// Public Site Data - All content for public-facing pages
// This file contains all hardcoded text so Wave 2 terminals don't need to edit it

export const siteInfo = {
  name: 'Utah Valley Research Lab',
  shortName: 'UVRL',
  tagline: 'Turning Raw Data into Real Insight',
  description: 'Providing students real-world experience applying statistics and data analytics while helping businesses and communities make data-driven decisions.',
  affiliation: 'Independent non-profit organization',
  contact: {
    email: 'ronald.miller@uvu.edu',
    phone: '(801) 863-8232',
    phoneRaw: '8018638232',
    address: 'MS 119, 800 W. University Parkway',
    city: 'Orem',
    state: 'UT',
    zip: '84058',
    fullAddress: 'MS 119, 800 W. University Parkway, Orem, UT 84058',
    officeHours: 'Monday - Friday: 9:00 AM - 5:00 PM',
    googleMapsUrl: 'https://maps.google.com/?q=800+W+University+Parkway,+Orem,+UT+84058',
  },
  // Social links - set to empty strings until real URLs are available.
  // The footer conditionally renders these only when a valid URL is provided.
  social: {
    linkedin: '',
    twitter: '',
    github: '',
  },
};

export const navigation = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Projects', path: '/projects' },
  { label: 'Team', path: '/team' },
  { label: 'Blog', path: '/blog' },
  { label: 'Participate', path: '/participate' },
  { label: 'Contact', path: '/contact' },
  { label: 'Donate', path: '/donate', isButton: true },
];

export const heroData = {
  title: 'Utah Valley Research Lab',
  tagline: 'Turning Raw Data into Real Insight',
  description: 'Providing students real-world experience applying statistics and data analytics while helping businesses and communities make data-driven decisions.',
  primaryCta: { label: 'View Our Work', path: '/projects' },
  secondaryCta: { label: 'Get In Touch', path: '/contact' },
};

// TODO: These stats are hardcoded and should be updated periodically or
// ideally fetched from the API once a public stats endpoint is available.
export const statsData = [
  { number: '7+', label: 'Active Projects' },
  { number: '22+', label: 'Team Members' },
  { number: '6', label: 'Partner Organizations' },
];

export const partnersData = [
  { name: 'UV Chamber', fullName: 'Utah Valley Chamber of Commerce', icon: 'Building2' },
  { name: 'UVU', fullName: 'Utah Valley University', icon: 'GraduationCap' },
  { name: 'Sawtooth', fullName: 'Sawtooth Software', icon: 'Settings' },
  { name: 'Eagle Mountain', fullName: 'Eagle Mountain City', icon: 'Building' },
  { name: 'iHub', fullName: 'iHub', icon: 'Rocket' },
];

export const aboutSummaryData = {
  label: 'About Us',
  title: 'Empowering Students Through Real-World Analytics',
  description: 'We bridge the gap between academic learning and professional practice. Our team conducts rigorous statistical analysis, data visualization, and research projects for businesses, government, and academic institutions.',
  highlights: [
    'MaxDiff & Conjoint Analysis',
    'UX/Usability Research',
    'Statistical Modeling & Causal Inference',
  ],
  cta: { label: 'Learn More About Us', path: '/about' },
};

export const servicesData = [
  {
    icon: 'BarChart3',
    title: 'Survey Research',
    description: 'MaxDiff, conjoint analysis, and comprehensive survey design and analysis',
  },
  {
    icon: 'MonitorSmartphone',
    title: 'UX Research',
    description: 'Usability studies, SUS scoring, and user experience evaluation',
  },
  {
    icon: 'Workflow',
    title: 'Process Mapping',
    description: 'Workflow documentation, bottleneck identification, and optimization',
  },
  {
    icon: 'Brain',
    title: 'Psychometrics',
    description: 'Instrument development, validation, and reliability testing',
  },
  {
    icon: 'TrendingUp',
    title: 'Impact Measurement',
    description: 'SROI, IRIS+, and comprehensive impact framework analysis',
  },
  {
    icon: 'Calculator',
    title: 'Statistical Modeling',
    description: 'Regression, causal inference, and advanced statistical analysis',
  },
];

export const featuredProjectsData = [
  {
    id: 'growth-summit-2025',
    title: 'Growth Summit 2025',
    type: 'MaxDiff Policy Research',
    status: 'completed',
    client: 'Utah Valley Chamber of Commerce',
    clientIcon: 'Building2',
    description: 'Comprehensive policy priority research for Utah Valley Chamber with 380+ respondents using MaxDiff analysis.',
    fullDescription: 'Comprehensive policy priority research presented at the 5th Annual Growth & Prosperity Summit. Surveyed 380+ respondents using MaxDiff analysis to identify Utah County\'s top priorities across housing, education, transportation, and environment.',
    highlights: [
      { icon: 'Users', text: '380+ Respondents' },
      { icon: 'ClipboardCheck', text: 'IRB Approved' },
      { icon: 'Calendar', text: 'Nov 2025' },
    ],
    findings: [
      'Builder Partnership Incentives ranked #1 priority (102.9 utility score)',
      'Housing affordability emerged as critical concern across demographics',
      '50%+ respondents satisfied with life in Utah County',
    ],
    isFeatured: true,
  },
  {
    id: 'discover-usability',
    title: 'Discover Usability Report',
    type: 'UX/Usability Study',
    status: 'completed',
    client: 'Sawtooth Software',
    clientIcon: 'Building2',
    description: 'Comparative usability study for Sawtooth Software evaluating Discover against Qualtrics and SurveyMonkey.',
    fullDescription: 'Comparative usability study evaluating Sawtooth Discover against Qualtrics and SurveyMonkey among novice users. Delivered directly to CEO Bryan Orme with actionable recommendations.',
    highlights: [
      { icon: 'Users', text: '186 Respondents' },
      { icon: 'TrendingUp', text: 'SUS Scoring' },
      { icon: 'Calendar', text: 'Dec 2025' },
    ],
    findings: [
      'Identified "Novice Penalty" - 26-point SUS gap between novice and experienced users',
      'Login/entry pathway confusion between web and desktop products',
      'Causal inference confirmed usability drives preference (AIC delta: 1707.86)',
    ],
    isFeatured: true,
  },
  {
    id: 'eagle-mountain',
    title: 'Eagle Mountain City',
    type: 'Process Mapping / PBB',
    status: 'ongoing',
    client: 'Eagle Mountain Finance Department',
    clientIcon: 'Building',
    description: 'Process mapping and Priority-Based Budgeting pilot with the Finance Department.',
    fullDescription: 'Process mapping and Priority-Based Budgeting pilot with the Finance Department. Documenting workflows, identifying bottlenecks, and recommending improvements.',
    highlights: [
      { icon: 'Building', text: 'Eagle Mountain' },
      { icon: 'Settings', text: 'In Progress' },
    ],
    isFeatured: true,
  },
];

export const ongoingProjectsData = [
  {
    id: 'moral-framework',
    title: 'Moral Framework (DSIT/DBIT/NMIT)',
    type: 'Psychometric Instruments',
    status: 'ongoing',
    client: 'Academic Research',
    clientIcon: 'FlaskConical',
    description: 'Family of moral reasoning instruments in the Kohlberg-Rest tradition measuring spiritual motivation (DSIT), business ethics (DBIT), and NGO moral reasoning (NMIT).',
  },
  {
    id: 'ihub-impact',
    title: 'iHub Impact Framework',
    type: 'Impact Measurement',
    status: 'ongoing',
    client: 'iHub (Startup Incubator)',
    clientIcon: 'Building2',
    description: 'Comprehensive impact analysis using SROI, IMP, IRIS+, Theory of Change, and Skoll frameworks to measure startup incubator effectiveness.',
  },
  {
    id: 'prisoners-dilemma',
    title: "Prisoner's Dilemma",
    type: 'Behavioral Research',
    status: 'ongoing',
    client: 'Academic Research',
    clientIcon: 'FlaskConical',
    description: "Revisiting sequential theory research on cooperation persistence in iterated Prisoner's Dilemma games. Original research from BYU-Hawaii by Dr. Ronald Miller.",
  },
];

export const earlyStageProjectsData = [
  { icon: 'FlaskConical', name: 'Effort Justification' },
  { icon: 'Heart', name: 'Dating Compatibility' },
  { icon: 'Anchor', name: 'Navy Research' },
];

export const teamHighlightsData = {
  label: 'Our Team',
  title: 'Meet the People Behind the Insights',
  description: 'Our team combines experienced faculty leadership with motivated student researchers. Together, we deliver professional-quality analytics while providing invaluable learning opportunities.',
  stats: [
    { number: '4', label: 'Faculty Advisors' },
    { number: '2', label: 'Lab Leads' },
    { number: '12+', label: 'Active Members' },
  ],
  cta: { label: 'Meet the Team', path: '/team' },
};

export const teamData = {
  leadership: [
    {
      id: 'ronald-miller',
      name: 'Dr. Ronald Miller',
      role: 'Director',
      bio: 'Leading the Stats Lab with expertise in statistical methodology and psychometric research.',
      email: 'ronald.miller@uvu.edu',
      linkedin: '#',
    },
    {
      id: 'david-benson',
      name: 'Dr. David Benson',
      role: 'Director',
      bio: 'Co-director providing strategic guidance and research oversight.',
      email: 'david.benson@uvu.edu',
      linkedin: '#',
    },
    {
      id: 'phil-witt',
      name: 'Dr. Phil Witt',
      role: 'Leadership',
      bio: 'Faculty advisor supporting student research initiatives.',
      linkedin: '#',
    },
    {
      id: 'greg-cronin',
      name: 'Prof. Greg Cronin',
      role: 'Leadership',
      bio: 'Faculty advisor with expertise in business analytics.',
      linkedin: '#',
    },
  ],
  labLeads: [
    {
      id: 'sam-johnston',
      name: 'Sam Johnston',
      role: 'Lab Lead',
      bio: 'Student leader coordinating project teams and client relationships.',
      email: 'sam.johnston@uvu.edu',
      linkedin: '#',
    },
    {
      id: 'joseph-white',
      name: 'Joseph White',
      role: 'Lab Lead',
      bio: 'Student leader managing research operations and team development.',
      linkedin: '#',
    },
  ],
  members: [
    { id: 'jared-williams', name: 'Jared Williams', role: 'Project Member' },
    { id: 'emery-holden', name: 'Emery Holden', role: 'Project Member' },
    { id: 'parris-holden', name: 'Parris Holden', role: 'Project Member' },
    { id: 'isaac-davis', name: 'Isaac Davis', role: 'Project Member' },
    { id: 'park-anderson', name: 'Park Anderson', role: 'Project Member' },
    { id: 'connor-ross', name: 'Connor Ross', role: 'Project Member' },
    { id: 'harry-nemelka', name: 'Harry Nemelka', role: 'Project Member' },
    { id: 'james-douglas', name: 'James Douglas', role: 'Project Member' },
    { id: 'landon-memmott', name: 'Landon Memmott', role: 'Project Member' },
    { id: 'weston-hutchings', name: 'Weston Hutchings', role: 'Project Member' },
    { id: 'wyatt-richard', name: 'Wyatt Richard', role: 'Project Member' },
    { id: 'zach-peterson', name: 'Zach Peterson', role: 'Project Member' },
  ],
  partners: [
    {
      id: 'vasu-chetty',
      name: 'Vasu Chetty',
      role: 'Professional Acquaintance',
      bio: 'Industry partner supporting Stats Lab initiatives.',
    },
  ],
};

export const aboutPageData = {
  hero: {
    title: 'About Us',
    subtitle: 'Empowering students through real-world analytics',
  },
  mission: {
    title: 'Our Mission',
    lead: 'The Utah Valley Research Lab bridges the gap between academic learning and professional practice by providing students with hands-on experience in statistical analysis and data science.',
    description: 'We partner with businesses, government agencies, and non-profit organizations to deliver rigorous, actionable research while training the next generation of data professionals.',
  },
  cards: [
    {
      icon: 'Target',
      title: 'What We Do',
      description: 'We conduct rigorous statistical analysis, data visualization, and research projects for businesses, government entities, and academic institutions. Our work spans survey research, usability studies, process mapping, psychometric instrument development, and impact measurement.',
    },
    {
      icon: 'Wrench',
      title: 'What We Can Do',
      list: [
        'MaxDiff & Conjoint Analysis',
        'UX/Usability Research',
        'Process Mapping & Optimization',
        'Psychometric Instrument Development',
        'Impact Measurement (SROI, IRIS+)',
        'Statistical Modeling & Causal Inference',
      ],
    },
    {
      icon: 'Search',
      title: "What We're Looking For",
      description: "We're always seeking new projects that challenge our team and provide meaningful learning opportunities. Whether you're a business needing data insights, a government agency seeking process improvement, or a researcher requiring statistical expertise, we'd love to collaborate.",
    },
    {
      icon: 'Users',
      title: 'Membership',
      description: 'We welcome motivated students interested in statistics, data analytics, and research. Members gain hands-on experience with real clients, professional mentorship from faculty advisors, and the opportunity to present findings to stakeholders.',
    },
  ],
  cta: {
    title: 'Ready to work with us?',
    description: "Let's turn your data into actionable insights.",
    button: { label: 'Start a Project', path: '/contact' },
  },
};

export const blogPageData = {
  hero: {
    title: 'Blog & Research',
    subtitle: 'Insights, publications, and updates from our team',
  },
  comingSoon: {
    title: 'Coming Soon',
    lead: "We're working on bringing you valuable research insights, project updates, and thought leadership from our team.",
    description: 'Stay tuned for research publications, methodology deep-dives, case studies, and practical applications of statistical analysis.',
  },
  previewCards: [
    {
      icon: 'FlaskConical',
      title: 'Research Publications',
      description: 'Academic papers, white papers, and research findings from our projects',
    },
    {
      icon: 'Briefcase',
      title: 'Case Studies',
      description: "In-depth looks at how we've helped organizations make data-driven decisions",
    },
    {
      icon: 'GraduationCap',
      title: 'Tutorials & Guides',
      description: 'Practical guides on statistical methods, tools, and best practices',
    },
    {
      icon: 'Megaphone',
      title: 'Lab Updates',
      description: 'News about our team, events, and accomplishments',
    },
  ],
  newsletter: {
    title: 'Stay Updated',
    description: 'Be the first to know when we publish new content',
    placeholder: 'Enter your email address',
    buttonText: 'Subscribe',
    note: 'We respect your privacy. Unsubscribe at any time.',
  },
  socialFollow: {
    text: 'In the meantime, follow Dr. Ronald Miller on LinkedIn for the latest updates:',
    button: { label: 'Follow on LinkedIn', url: '#' },
  },
};

export const contactPageData = {
  hero: {
    title: 'Contact Us',
    subtitle: "Let's discuss how we can help with your project",
  },
  intro: {
    title: 'Get In Touch',
    description: "Have a project in mind? Want to join our team? We'd love to hear from you.",
  },
  form: {
    title: 'Send Us a Message',
    fields: {
      name: { label: 'Name *', placeholder: '', required: true },
      email: { label: 'Email *', placeholder: '', required: true },
      organization: { label: 'Organization', placeholder: '', required: false },
      subject: {
        label: 'Subject',
        placeholder: 'Select a topic',
        options: [
          { value: '', label: 'Select a topic' },
          { value: 'project', label: 'New Project Inquiry' },
          { value: 'partnership', label: 'Partnership Opportunity' },
          { value: 'membership', label: 'Join the Lab' },
          { value: 'other', label: 'Other' },
        ],
      },
      message: { label: 'Message *', placeholder: '', required: true },
    },
    submitButton: 'Send Message',
  },
};

export const faqData = [
  {
    question: 'How long does a typical project take?',
    answer: 'Project timelines vary based on scope and complexity. Simple analyses may take 2-4 weeks, while comprehensive research projects can span several months.',
  },
  {
    question: 'What does it cost to work with the Stats Lab?',
    answer: "As a non-profit focused on student education, we offer competitive rates. We'll provide a detailed quote after understanding your project requirements.",
  },
  {
    question: 'How can I join as a student member?',
    answer: 'We welcome motivated students interested in statistics and data analytics. Use the contact form above with "Join the Lab" selected to express your interest.',
  },
  {
    question: 'What industries do you work with?',
    answer: "We work across sectors including government, software, education, non-profits, and business. If you have data challenges, we'd love to discuss how we can help.",
  },
];

export const donatePageData = {
  hero: {
    title: 'Support Our Mission',
    subtitle: 'Help us empower the next generation of data professionals',
  },
  intro: {
    title: 'Why Your Support Matters',
    lead: 'The Utah Valley Research Lab bridges academic learning with real-world impact. Your contribution directly supports student researchers and community-focused projects.',
  },
  impactCards: [
    {
      icon: 'GraduationCap',
      title: 'Fund Student Research',
      description: 'Enable students to gain hands-on experience with real-world data analysis projects',
    },
    {
      icon: 'HandHelping',
      title: 'Support Community Projects',
      description: 'Help local businesses and organizations make data-driven decisions',
    },
    {
      icon: 'PieChart',
      title: 'Enable Advanced Analytics',
      description: 'Provide access to professional statistical software and tools',
    },
    {
      icon: 'Presentation',
      title: 'Professional Development',
      description: 'Fund workshops, conferences, and training opportunities for team members',
    },
  ],
  oneTime: {
    title: 'One-Time Gift',
    description: 'Make an immediate impact with a single contribution',
    amounts: [25, 50, 100, 250, 500],
    buttonText: 'Donate Now',
    note: 'Payment processing coming soon',
  },
  monthly: {
    title: 'Monthly Giving',
    description: 'Provide sustained support with a recurring gift',
    badge: 'Most Popular',
    amounts: [10, 25, 50, 100],
    buttonText: 'Give Monthly',
    note: 'Payment processing coming soon',
  },
  corporate: {
    title: 'Corporate Sponsorship',
    description: 'Partner with us for larger impact',
    benefits: [
      'Logo on website & materials',
      'Priority project consultation',
      'Annual impact report',
      'Speaking opportunities',
    ],
    buttonText: 'Contact Us',
    buttonPath: '/contact',
  },
  otherWays: [
    { icon: 'Workflow', title: 'Sponsor a Project', description: 'Fund a specific research initiative or community project' },
    { icon: 'Laptop', title: 'Donate Equipment', description: 'Contribute computers, software licenses, or other resources' },
    { icon: 'Users', title: 'Volunteer Expertise', description: 'Share your professional skills as a mentor or advisor' },
    { icon: 'Share2', title: 'Spread the Word', description: 'Share our mission with your network and community' },
  ],
  transparency: {
    title: 'Our Commitment to Transparency',
    description: 'As a non-profit organization, we are committed to using every dollar responsibly. We provide regular updates on how donations are used and the impact they create.',
    stats: [
      { percentage: '85%', label: 'Goes to Programs' },
      { percentage: '10%', label: 'Operations' },
      { percentage: '5%', label: 'Fundraising' },
    ],
  },
};

export const ctaData = {
  home: {
    title: 'Ready to Turn Your Data Into Insights?',
    description: "Whether you need research support, data analysis, or strategic insights, we're here to help.",
    primaryCta: { label: 'Start a Project', path: '/contact' },
    secondaryCta: { label: 'Support Our Mission', path: '/donate' },
  },
  projects: {
    title: 'Have a project in mind?',
    description: "We're always looking for new challenges and opportunities to apply our expertise.",
    cta: { label: 'Discuss Your Project', path: '/contact' },
  },
  team: {
    title: 'Join Our Team',
    description: "We're always looking for motivated students interested in statistics, data analytics, and research.",
    cta: { label: 'Apply to Join', path: '/contact' },
  },
};

export const projectsPageData = {
  hero: {
    title: 'Our Projects',
    subtitle: 'Research and analytics that make a difference',
  },
  filters: ['All', 'Completed', 'Ongoing'],
};
