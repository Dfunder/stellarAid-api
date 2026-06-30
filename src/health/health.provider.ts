import { Injectable } from '@nestjs/common';

/**
 * Placeholder injectable for the health module. Kept so downstream
 * PRs (DB ping, Redis ping, etc.) have a stable class to extend when
 * they want to bolt additional readiness checks onto `HealthController`
 * without changing the module wiring.
 */
@Injectable()
export class HealthService {}