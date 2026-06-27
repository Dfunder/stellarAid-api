import { PiiLoggerService } from './pii-logger.service';

describe('PiiLoggerService', () => {
  let logger: PiiLoggerService;
  const winstonLogger = { log: jest.fn() };

  beforeEach(() => {
    winstonLogger.log.mockClear();
    logger = new PiiLoggerService(winstonLogger as never);
  });

  it('masks Stellar wallet addresses', () => {
    const wallet = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    logger.log(wallet);
    expect(winstonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('...') }),
    );
    expect(winstonLogger.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining(wallet) }),
    );
  });

  it('masks email addresses', () => {
    logger.log('user@example.com logged in');
    expect(winstonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('***@') }),
    );
  });

  it('redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36';
    logger.log(jwt);
    expect(winstonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('[JWT_REDACTED]') }),
    );
  });

  it('passes through non-PII messages unchanged', () => {
    logger.log('Campaign created successfully');
    expect(winstonLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Campaign created successfully') }),
    );
  });

  it('includes structured logging fields', () => {
    logger.warn('Campaign created successfully', 'CampaignsService');

    expect(winstonLogger.log).toHaveBeenCalledWith({
      level: 'warn',
      message: 'Campaign created successfully',
      context: 'CampaignsService',
      requestId: undefined,
      userId: undefined,
    });
  });
});
