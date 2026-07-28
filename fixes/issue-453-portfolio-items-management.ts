// Fix for #453: add, update, remove, and reorder portfolio items.
export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  order: number;
}

export class PortfolioItemsStore {
  private items: PortfolioItem[] = [];
  private nextId = 1;

  addItem(title: string, description: string): PortfolioItem {
    const item: PortfolioItem = { id: String(this.nextId++), title, description, order: this.items.length };
    this.items.push(item);
    return item;
  }

  updateItem(itemId: string, patch: Partial<Pick<PortfolioItem, 'title' | 'description'>>): PortfolioItem {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');
    Object.assign(item, patch);
    return item;
  }

  removeItem(itemId: string): void {
    this.items = this.items.filter((i) => i.id !== itemId);
  }

  reorder(order: { id: string; order: number }[]): PortfolioItem[] {
    for (const entry of order) {
      const item = this.items.find((i) => i.id === entry.id);
      if (item) item.order = entry.order;
    }
    return [...this.items].sort((a, b) => a.order - b.order);
  }
}
