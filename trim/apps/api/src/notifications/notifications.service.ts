import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Fire-and-forget task assignment emails; failures are logged, never thrown to callers. */
  notifyRoomTaskAssigned(input: {
    assigneeIds: string[];
    title: string;
    roomName: string;
    siteName: string;
    dueOn: string | null;
  }): void {
    void this.sendTaskAssigned(input).catch((error: Error) => {
      this.logger.warn(`Task assignment email failed: ${error.message}`);
    });
  }

  private async sendTaskAssigned(input: {
    assigneeIds: string[];
    title: string;
    roomName: string;
    siteName: string;
    dueOn: string | null;
  }): Promise<void> {
    if (input.assigneeIds.length === 0) {
      return;
    }
    const people = await this.prisma.user.findMany({
      where: {
        id: { in: input.assigneeIds },
        emailNotificationsEnabled: true,
      },
      select: { id: true, email: true, name: true },
    });
    const due = input.dueOn ? ` Due ${input.dueOn}.` : '';
    await Promise.all(
      people.map((person) =>
        this.mail.send({
          to: person.email,
          subject: `Task assigned: ${input.title}`,
          text: [
            `Hi ${person.name},`,
            '',
            `You were assigned “${input.title}” in ${input.roomName} at ${input.siteName}.${due}`,
            '',
            'Open Serenity → Tasks to review it.',
            '',
            '— Serenity Universal',
          ].join('\n'),
          html: `<p>Hi ${escapeHtml(person.name)},</p><p>You were assigned <strong>${escapeHtml(input.title)}</strong> in ${escapeHtml(input.roomName)} at ${escapeHtml(input.siteName)}.${due ? ` ${escapeHtml(due.trim())}` : ''}</p><p>Open Serenity → Tasks to review it.</p><p>— Serenity Universal</p>`,
        }),
      ),
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
