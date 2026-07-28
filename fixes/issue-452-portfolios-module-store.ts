// Fix for #452: minimal portfolios model - create (ARTIST only), public
// list/view of published portfolios, owner-only update, and soft delete.
export interface PortfolioRecord {
  id: string;
  ownerId: string;
  isPublished: boolean;
  deletedAt: number | null;
}

export class PortfoliosStore {
  private portfolios: PortfolioRecord[] = [];
  private nextId = 1;

  create(ownerId: string, callerRole: 'ARTIST' | 'CLIENT'): PortfolioRecord {
    if (callerRole !== 'ARTIST') {
      throw new Error('Only artists can create portfolios');
    }
    const record: PortfolioRecord = { id: String(this.nextId++), ownerId, isPublished: false, deletedAt: null };
    this.portfolios.push(record);
    return record;
  }

  listPublished(): PortfolioRecord[] {
    return this.portfolios.filter((p) => p.isPublished && !p.deletedAt);
  }

  getById(id: string): PortfolioRecord | undefined {
    return this.portfolios.find((p) => p.id === id && !p.deletedAt);
  }

  update(id: string, callerId: string, patch: Partial<PortfolioRecord>): PortfolioRecord {
    const record = this.getById(id);
    if (!record) throw new Error('Portfolio not found');
    if (record.ownerId !== callerId) throw new Error('Only the owner can update this portfolio');
    Object.assign(record, patch);
    return record;
  }

  softDelete(id: string, callerId: string): void {
    const record = this.getById(id);
    if (!record) throw new Error('Portfolio not found');
    if (record.ownerId !== callerId) throw new Error('Only the owner can delete this portfolio');
    record.deletedAt = Date.now();
  }
}
