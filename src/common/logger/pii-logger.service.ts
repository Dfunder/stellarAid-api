import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, Logger as WinstonLogger, transports } from 'winston';
import { getLogRequestContext } from './request-context';

@Injectable()
export class PiiLoggerService implements LoggerService {
  private readonly logger: WinstonLogger;

  constructor(logger?: WinstonLogger) {
    this.logger = logger ?? createLogger({
      levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        info: 3,
        verbose: 4,
        debug: 5,
      },
      level: this.normalizeLogLevel(process.env.LOG_LEVEL),
      format: format.combine(
        format.timestamp(),
        format.printf((info) =>
          JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            context: info.context ?? null,
            requestId: info.requestId ?? null,
            userId: info.userId ?? null,
          }),
        ),
      ),
      transports: [new transports.Console()],
    });
  }

  private maskWalletAddress(str: string): string {
    return str.replace(/G[A-Z2-7]{55}/g, (addr) => `${addr.slice(0, 4)}...${addr.slice(-4)}`);
  }

  private maskEmail(str: string): string {
    return str.replace(/[\w.+-]+@[\w-]+\.[\w.]+/gi, (email) => {
      const [local, domain] = email.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    });
  }

  private maskJwt(str: string): string {
    return str.replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
      '[JWT_REDACTED]',
    );
  }

  private scrub(message: unknown): string {
    return this.maskJwt(this.maskEmail(this.maskWalletAddress(String(message))));
  }

  private normalizeLogLevel(level?: string): string {
    if (level === 'log') {
      return 'info';
    }

    return level ?? 'info';
  }

  private parseParams(optionalParams: unknown[]): { context?: string; trace?: string } {
    const context = optionalParams.at(-1);
    const trace = optionalParams.length > 1 ? optionalParams[0] : undefined;

    return {
      context: typeof context === 'string' ? context : undefined,
      trace: typeof trace === 'string' ? trace : undefined,
    };
  }

  private write(level: string, message: unknown, optionalParams: unknown[] = []): void {
    const { context, trace } = this.parseParams(optionalParams);
    const requestContext = getLogRequestContext();
    const scrubbedMessage = this.scrub(message);

    this.logger.log({
      level,
      message: trace ? `${scrubbedMessage} ${this.scrub(trace)}` : scrubbedMessage,
      context,
      requestId: requestContext?.requestId,
      userId: requestContext?.userId,
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }
}
