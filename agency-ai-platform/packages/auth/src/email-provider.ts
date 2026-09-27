export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Provider interface — adapters live behind this boundary. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Local/dev adapter: records messages for tests; logs in development. */
export class InMemoryEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[email:dev] to=${message.to} subject=${message.subject}`);
    }
  }
}
