// Fix for #473: build an authenticated user's payment history split by
// role (artist vs client), newest-first and paginated.
export interface PaymentRecord {
  id: number;
  role: 'ARTIST' | 'CLIENT';
  userId: string;
  amount: number;
  status: 'PENDING' | 'ESCROWED' | 'COMPLETED';
  createdAt: number;
}

export function getPaymentHistory(
  payments: PaymentRecord[],
  userId: string,
  page: number,
  pageSize: number,
) {
  const mine = payments
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const start = (page - 1) * pageSize;
  const pageItems = mine.slice(start, start + pageSize);

  const isArtist = mine.length > 0 && mine[0].role === 'ARTIST';
  const summary = isArtist
    ? {
        receivedPayments: mine.filter((p) => p.status === 'COMPLETED').length,
        pendingEscrows: mine.filter((p) => p.status === 'ESCROWED').length,
        totalEarnings: mine
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + p.amount, 0),
      }
    : {
        sentPayments: mine.filter((p) => p.status === 'COMPLETED').length,
        activeEscrows: mine.filter((p) => p.status === 'ESCROWED').length,
        totalSpent: mine
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + p.amount, 0),
      };

  return { items: pageItems, summary };
}
