// Fix for #451: search/filter/sort artists, with a tiny TTL cache
// standing in for a 5-minute Redis cache of results.
export interface SearchableArtist {
  id: string;
  name: string;
  bio: string;
  tagline: string;
  skills: string[];
  category: string;
  averageRating: number;
  reviewCount: number;
  createdAt: number;
}

export interface ArtistSearchQuery {
  q?: string;
  skills?: string[];
  category?: string;
  minRating?: number;
  sortBy?: 'newest' | 'top-rated' | 'most-reviewed';
}

export function searchArtists(artists: SearchableArtist[], query: ArtistSearchQuery): SearchableArtist[] {
  let results = artists.filter((a) => {
    const text = `${a.name} ${a.bio} ${a.tagline}`.toLowerCase();
    const matchesText = !query.q || text.includes(query.q.toLowerCase());
    const matchesSkills = !query.skills || query.skills.every((s) => a.skills.includes(s));
    const matchesCategory = !query.category || a.category === query.category;
    const matchesRating = query.minRating === undefined || a.averageRating >= query.minRating;
    return matchesText && matchesSkills && matchesCategory && matchesRating;
  });

  if (query.sortBy === 'top-rated') {
    results = results.sort((a, b) => b.averageRating - a.averageRating);
  } else if (query.sortBy === 'most-reviewed') {
    results = results.sort((a, b) => b.reviewCount - a.reviewCount);
  } else {
    results = results.sort((a, b) => b.createdAt - a.createdAt);
  }
  return results;
}
