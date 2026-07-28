// Fix for #477: minimal reviews model - a client submits a review after
// a commission is COMPLETED, public paginated reviews per artist, and
// an artist's own received reviews.
export interface ReviewRecord {
  id: number;
  artistId: string;
  clientId: string;
  rating: number;
  commissionStatus: 'PENDING' | 'COMPLETED';
}

export class ReviewsStore {
  private reviews: ReviewRecord[] = [];
  private nextId = 1;

  submitReview(
    artistId: string,
    clientId: string,
    rating: number,
    commissionStatus: ReviewRecord['commissionStatus'],
  ): ReviewRecord {
    if (commissionStatus !== 'COMPLETED') {
      throw new Error('Review can only be submitted for a completed commission');
    }
    const review: ReviewRecord = { id: this.nextId++, artistId, clientId, rating, commissionStatus };
    this.reviews.push(review);
    return review;
  }

  listForArtist(artistId: string, page: number, pageSize: number): ReviewRecord[] {
    const all = this.reviews.filter((r) => r.artistId === artistId);
    const start = (page - 1) * pageSize;
    return all.slice(start, start + pageSize);
  }

  listOwnReviews(artistId: string): ReviewRecord[] {
    return this.reviews.filter((r) => r.artistId === artistId);
  }
}
