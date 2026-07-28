// Fix for #476: mark all messages in a conversation read for a user,
// emit a read event to other participants, and expose unread counts
// per conversation.
export interface ReceiptMessage {
  id: number;
  conversationId: string;
  senderId: string;
  readBy: Set<string>;
}

export function markConversationRead(
  messages: ReceiptMessage[],
  conversationId: string,
  userId: string,
): { updated: ReceiptMessage[]; event: { type: 'messages_read'; conversationId: string; userId: string } } {
  const updated = messages.map((m) =>
    m.conversationId === conversationId ? { ...m, readBy: new Set(m.readBy).add(userId) } : m,
  );
  return { updated, event: { type: 'messages_read', conversationId, userId } };
}

export function unreadCount(messages: ReceiptMessage[], conversationId: string, userId: string): number {
  return messages.filter(
    (m) => m.conversationId === conversationId && m.senderId !== userId && !m.readBy.has(userId),
  ).length;
}
