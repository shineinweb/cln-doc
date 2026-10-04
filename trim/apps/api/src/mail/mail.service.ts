import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../env';

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly outbox: OutboundMail[] = [];

  /** Captured messages for tests and console driver inspection. */
  peekOutbox(): OutboundMail[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox.length = 0;
  }

  async send(message: OutboundMail): Promise<void> {
    const env = loadEnv();
    this.outbox.push(message);

    const driver = env.MAIL_DRIVER;
    if (driver === 'console' || (driver === 'sendgrid' && !env.SENDGRID_API_KEY)) {
      this.logger.log(`Mail to ${message.to}: ${message.subject}\n${message.text}`);
      return;
    }

    if (driver === 'sendgrid') {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ],
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`SendGrid rejected mail (${response.status}): ${detail.slice(0, 300)}`);
      }
      return;
    }

    this.logger.log(`Mail to ${message.to}: ${message.subject}`);
  }
}
