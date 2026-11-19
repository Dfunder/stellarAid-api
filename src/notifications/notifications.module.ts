import { Inject, Injectable, Logger, Module } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

/** Abstraction so a real SMTP/Nodemailer sender can be swapped in later. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';

/** Dev/test stub: logs only, never sends real email. Optional env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. */
@Injectable()
export class StubEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`[stub] email to ${message.to}: ${message.subject}`);
    return Promise.resolve();
  }
}

@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_SENDER) private readonly sender: EmailSender) {}

  send(message: EmailMessage): Promise<void> {
    return this.sender.send(message);
  }
}

@Module({
  providers: [{ provide: EMAIL_SENDER, useClass: StubEmailSender }, EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
