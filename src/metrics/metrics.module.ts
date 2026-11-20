import { Controller, Get, Header, Injectable, Module } from '@nestjs/common';

/** #1109: minimal Prometheus-compatible text metrics (no external dependency). */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly startedAt = Date.now();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  render(): string {
    const lines = [
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${process.memoryUsage().rss}`,
    ];
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`, `${name} ${value}`);
    }
    return lines.join('\n') + '\n';
  }
}

/** GET /metrics. Set METRICS_ENABLED=false to return an empty body (e.g. in tests). */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  get(): string {
    return process.env.METRICS_ENABLED === 'false' ? '' : this.metrics.render();
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
