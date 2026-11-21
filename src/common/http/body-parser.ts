import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

export const DEFAULT_BODY_LIMIT = '1mb';

function resolveLimit(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) return DEFAULT_BODY_LIMIT;

    const match = /^(\d+)(?:b|kb|mb|gb)?$/i.exec(value);
    if (!match || Number(match[1]) < 1) {
        throw new Error(
            `Invalid ${name} environment variable: "${value}". Expected a positive byte value such as 1mb.`,
        );
    }

    return value;
}

export function configureBodyParser(app: INestApplication): void {
    const jsonLimit = resolveLimit('JSON_BODY_LIMIT');
    const urlencodedLimit = resolveLimit('URLENCODED_BODY_LIMIT');

    app.use(json({ limit: jsonLimit }));
    app.use(urlencoded({
        extended: true,
        limit: urlencodedLimit,
    }));
}