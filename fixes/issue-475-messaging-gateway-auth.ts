// Fix for #475: minimal shape for the real-time messaging gateway -
// authenticating a socket handshake via a JWT token query param and
// routing join/leave/send events to a conversation room.
export interface SocketHandshake {
  query: { token?: string };
}

export function authenticateSocket(
  handshake: SocketHandshake,
  verifyJwt: (token: string) => { userId: string } | null,
): { userId: string } {
  const token = handshake.query.token;
  if (!token) {
    throw new Error('Missing JWT token in handshake query');
  }
  const payload = verifyJwt(token);
  if (!payload) {
    throw new Error('Invalid JWT token');
  }
  return payload;
}

export class ConversationRooms {
  private rooms = new Map<string, Set<string>>();

  join(conversationId: string, socketId: string) {
    if (!this.rooms.has(conversationId)) this.rooms.set(conversationId, new Set());
    this.rooms.get(conversationId)!.add(socketId);
  }

  leave(conversationId: string, socketId: string) {
    this.rooms.get(conversationId)?.delete(socketId);
  }

  participants(conversationId: string): string[] {
    return Array.from(this.rooms.get(conversationId) ?? []);
  }
}
