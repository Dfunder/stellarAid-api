// Fix for #478: recalculate an artist's averageRating and totalReviews
// after a new review is saved, mirroring a Prisma _avg/_count aggregate
// applied atomically alongside the review insert.
export interface Review {
  artistId: string;
  rating: number;
}

export interface ArtistRatingSummary {
  averageRating: number;
  totalReviews: number;
}

export function recalculateArtistRating(
  reviews: Review[],
  artistId: string,
): ArtistRatingSummary {
  const artistReviews = reviews.filter((r) => r.artistId === artistId);
  const totalReviews = artistReviews.length;
  const averageRating =
    totalReviews === 0
      ? 0
      : artistReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  return { averageRating, totalReviews };
}

/** Simulates the atomic transaction: insert then recompute in one step. */
export function addReviewAndRecalculate(
  reviews: Review[],
  newReview: Review,
): { reviews: Review[]; summary: ArtistRatingSummary } {
  const updated = [...reviews, newReview];
  return { reviews: updated, summary: recalculateArtistRating(updated, newReview.artistId) };
}
