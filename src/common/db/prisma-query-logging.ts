export interface PrismaQueryEvent {
    query: string;
    params: string;
    duration: number;
    target?: string;
}

export interface PrismaQueryEmitter {
    $on(event: 'query', listener: (event: PrismaQueryEvent) => void): void;
}

export interface PrismaQueryLoggingOptions {
    enabled?: boolean;
    slowQueryMs?: number;
    logger?: (message: string) => void;
}

function resolveSlowQueryMs(value: string | undefined): number {
    if (!value) return 250;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(
            `Invalid PRISMA_SLOW_QUERY_MS environment variable: "${value}". Expected a non-negative integer.`,
        );
    }
    return parsed;
}

export function attachPrismaQueryLogging(
    client: PrismaQueryEmitter,
    options: PrismaQueryLoggingOptions = {},
): void {
    const enabled = options.enabled ?? process.env.PRISMA_QUERY_LOGGING === 'true';
    if (!enabled) return;

    const slowQueryMs =
        options.slowQueryMs ?? resolveSlowQueryMs(process.env.PRISMA_SLOW_QUERY_MS);
    const logger = options.logger ?? console.warn;

    client.$on('query', (event) => {
        if (event.duration < slowQueryMs) return;
        logger(
            `[prisma] slow query (${event.duration}ms): ${event.query}` +
            (event.target ? ` [${event.target}]` : ''),
        );
    });
}