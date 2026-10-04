import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../env';
import { taskAssignedEmail } from '../mail/email-templates';
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
    const tasksUrl = `${loadEnv().WEB_ORIGIN.replace(/\/$/, '')}/workspace`;
    await Promise.all(
      people.map((person) => {
        const rendered = taskAssignedEmail({
          name: person.name,
          title: input.title,
          roomName: input.roomName,
          siteName: input.siteName,
          dueOn: input.dueOn,
          tasksUrl,
        });
        return this.mail.send({
          to: person.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
      }),
    );
  }
}
