import { useState, useMemo, useCallback } from 'react';
import {
  featuredProjectsData,
  ongoingProjectsData,
  teamData,
  navigation,
} from '../data/publicSiteData';

export function useSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Build searchable content
  const searchableContent = useMemo(() => {
    const items = [];

    // Add pages
    navigation.forEach((nav) => {
      items.push({
        type: 'page',
        title: nav.label,
        path: nav.path,
        description: `Go to ${nav.label} page`,
      });
    });

    // Add projects
    [...featuredProjectsData, ...ongoingProjectsData].forEach((project) => {
      items.push({
        type: 'project',
        title: project.title,
        path: '/projects',
        description: project.description,
        meta: project.type,
      });
    });

    // Add team members
    const allMembers = [
      ...teamData.leadership,
      ...teamData.labLeads,
      ...teamData.members,
      ...(teamData.partners || []),
    ];
    allMembers.forEach((member) => {
      items.push({
        type: 'team',
        title: member.name,
        path: '/team',
        description: member.role,
        meta: member.bio || '',
      });
    });

    return items;
  }, []);

  // Filter results based on query
  const results = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return searchableContent
      .filter((item) => {
        const searchText = `${item.title} ${item.description} ${item.meta || ''}`.toLowerCase();
        return searchText.includes(lowerQuery);
      })
      .slice(0, 10); // Limit to 10 results
  }, [query, searchableContent]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups = {
      page: [],
      project: [],
      team: [],
    };

    results.forEach((result) => {
      if (groups[result.type]) {
        groups[result.type].push(result);
      }
    });

    return groups;
  }, [results]);

  return {
    isOpen,
    query,
    setQuery,
    results,
    groupedResults,
    open,
    close,
    toggle,
    hasResults: results.length > 0,
  };
}

export default useSearchModal;
