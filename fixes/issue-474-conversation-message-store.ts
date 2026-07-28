// Fix for #474: minimal in-memory model for listing a user's
// conversations and paginating messages within one, plus sending a
// message - the shape the messaging module's endpoints build on.
export interface Message {
  id: number;
  conversationId: string;
  senderId: string;
  text: string;
}

export class ConversationStore {
  private messages: Message[] = [];
  private nextId = 1;

  sendMessage(conversationId: string, senderId: string, text: string): Message {
    const message: Message = { id: this.nextId++, conversationId, senderId, text };
    this.messages.push(message);
    return message;
  }

  listConversations(userId: string): string[] {
    const ids = this.messages
      .filter((m) => m.senderId === userId)
      .map((m) => m.conversationId);
    return Array.from(new Set(ids));
  }

  listMessages(conversationId: string, page: number, pageSize: number): Message[] {
    const all = this.messages.filter((m) => m.conversationId === conversationId);
    const start = (page - 1) * pageSize;
    return all.slice(start, start + pageSize);
  }
}
