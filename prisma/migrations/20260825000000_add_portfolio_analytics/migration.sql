ALTER TABLE "PortfolioItem" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PortfolioViewDay" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PortfolioViewDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioViewDay_portfolioId_date_key" ON "PortfolioViewDay"("portfolioId", "date");
CREATE INDEX "PortfolioViewDay_portfolioId_date_idx" ON "PortfolioViewDay"("portfolioId", "date");

ALTER TABLE "PortfolioViewDay" ADD CONSTRAINT "PortfolioViewDay_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
