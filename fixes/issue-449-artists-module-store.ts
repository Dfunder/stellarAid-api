// Fix for #449: minimal artists model - public paginated/filterable
// listing, a public profile, and self-service profile updates gated to
// the ARTIST role.
export interface ArtistProfile {
  id: string;
  role: 'ARTIST' | 'CLIENT';
  skills: string[];
  category: string;
  bio: string;
  tagline: string;
  coverPhotoUrl: string;
}

export class ArtistsStore {
  constructor(private artists: ArtistProfile[]) {}

  list(filter: { skill?: string; category?: string }, page: number, pageSize: number) {
    const filtered = this.artists.filter(
      (a) =>
        (!filter.skill || a.skills.includes(filter.skill)) &&
        (!filter.category || a.category === filter.category),
    );
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }

  getById(id: string): ArtistProfile | undefined {
    return this.artists.find((a) => a.id === id);
  }

  updateOwnProfile(
    callerId: string,
    callerRole: ArtistProfile['role'],
    patch: Partial<Pick<ArtistProfile, 'bio' | 'tagline' | 'skills' | 'coverPhotoUrl'>>,
  ): ArtistProfile {
    if (callerRole !== 'ARTIST') {
      throw new Error('Only artists can update their own profile');
    }
    const artist = this.getById(callerId);
    if (!artist) throw new Error('Artist profile not found');
    Object.assign(artist, patch);
    return artist;
  }
}
