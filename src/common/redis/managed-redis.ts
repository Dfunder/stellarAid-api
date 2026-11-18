import type { OnModuleDestroy } from '@nestjs/common';
import { Logger } from '@nestjs/common';

/** The subset of an ioredis client this wrapper needs. */
export interface RedisLike {
  on(event: 'error', listener: (error: Error) => void): unknown;
  quit(): Promise<unknown>;
  disconnect(): void;
}

/**
 * Owns a lazily-created Redis client. An `'error'` listener is attached at
 * creation (an EventEmitter with no `'error'` listener throws and would crash
 * the process on a transient Redis blip), and the connection is closed on
 * shutdown so reconnect timers do not leak.
 */
export class ManagedRedis<C extends RedisLike> implements OnModuleDestroy {
  private readonly logger = new Logger(ManagedRedis.name);
  private client: C | undefined;

  constructor(private readonly factory: () => C) {}

  get(): C {
    if (this.client === undefined) {
      const created = this.factory();
      created.on('error', (error) => {
        this.logger.warn(`Redis error: ${error.message}`);
      });
      this.client = created;
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client === undefined) return;
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
