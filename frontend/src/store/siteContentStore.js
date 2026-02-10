import { create } from 'zustand'
import { publicApi } from '../services/api'
import {
  heroData,
  statsData,
  aboutSummaryData,
  aboutPageData,
  servicesData,
  siteInfo,
  faqData,
  donatePageData,
  teamData,
} from '../data/publicSiteData'

export const useSiteContentStore = create((set, get) => ({
  sections: {},
  team: null,
  loading: {},

  fetchSection: async (section) => {
    const state = get()
    // Skip if already loaded
    if (state.sections[section] || state.loading[section]) return

    set(s => ({ loading: { ...s.loading, [section]: true } }))
    try {
      const { data } = await publicApi.getSiteContent(section)
      set(s => ({
        sections: { ...s.sections, [section]: data.content },
        loading: { ...s.loading, [section]: false },
      }))
    } catch {
      set(s => ({ loading: { ...s.loading, [section]: false } }))
    }
  },

  fetchTeam: async () => {
    const state = get()
    if (state.team || state.loading.team) return

    set(s => ({ loading: { ...s.loading, team: true } }))
    try {
      const { data } = await publicApi.getTeam()
      set(s => ({
        team: data.team,
        loading: { ...s.loading, team: false },
      }))
    } catch {
      set(s => ({ loading: { ...s.loading, team: false } }))
    }
  },

  // Getters with static fallback
  getHeroData: () => {
    const content = get().sections.hero?.main
    return content || heroData
  },

  getStatsData: () => {
    const content = get().sections.stats?.main
    return content || statsData
  },

  getAboutSummary: () => {
    const content = get().sections.about?.summary
    return content || aboutSummaryData
  },

  getAboutPage: () => {
    const content = get().sections.about?.page
    return content || aboutPageData
  },

  getServicesData: () => {
    const content = get().sections.services?.main
    return content || servicesData
  },

  getContactData: () => {
    const content = get().sections.contact?.main
    return content || siteInfo.contact
  },

  getFaqData: () => {
    const content = get().sections.faq?.main
    return content || faqData
  },

  getDonateData: () => {
    const content = get().sections.donate?.main
    return content || { hero: donatePageData.hero, intro: donatePageData.intro }
  },

  getTeamData: () => {
    const team = get().team
    if (!team) return teamData
    return {
      leadership: team.leadership || [],
      labLeads: team.lab_lead || [],
      members: team.member || [],
      partners: team.partner || [],
    }
  },
}))
