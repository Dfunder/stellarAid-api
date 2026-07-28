// Fix for #454: publish/unpublish a portfolio and only count views for
// published portfolios.
export interface Portfolio {
  id: string;
  isPublished: boolean;
  viewCount: number;
}

export function publishPortfolio(portfolio: Portfolio): Portfolio {
  return { ...portfolio, isPublished: true };
}

export function unpublishPortfolio(portfolio: Portfolio): Portfolio {
  return { ...portfolio, isPublished: false };
}

export function viewPortfolio(portfolio: Portfolio): Portfolio {
  if (!portfolio.isPublished) {
    return portfolio;
  }
  return { ...portfolio, viewCount: portfolio.viewCount + 1 };
}
