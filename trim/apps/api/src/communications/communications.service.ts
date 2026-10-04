import { Injectable } from '@nestjs/common';
import type { EmailBroadcast, EmailBroadcastInput, EmailBroadcastList, SessionUser } from '@trim/contracts';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async list(user: SessionUser): Promise<EmailBroadcastList> {
    const rows = await this.prisma.emailBroadcast.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { createdBy: { select: { name: true } } },
    });
    return {
      broadcasts: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        body: row.body,
        recipientCount: row.recipientCount,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        createdByName: row.createdBy.name,
      })),
    };
  }

  async sendBroadcast(user: SessionUser, input: EmailBroadcastInput): Promise<EmailBroadcast> {
    const recipients = await this.recipients(user.organizationId, input.siteIds);
    const broadcast = await this.prisma.emailBroadcast.create({
      data: {
        organizationId: user.organizationId,
        subject: input.subject,
        body: input.body,
        createdById: user.id,
        recipientCount: recipients.length,
        sentAt: new Date(),
        recipients: {
          create: recipients.map((person) => ({
            userId: person.id,
            email: person.email,
            status: 'queued',
          })),
        },
      },
      include: { createdBy: { select: { name: true } }, recipients: true },
    });

    for (const recipient of broadcast.recipients) {
      try {
        await this.mail.send({
          to: recipient.email,
          subject: input.subject,
          text: `${input.body}\n\n— ${user.organizationName} via Serenity Universal\nYou received this because you are on the organization roster. Contact your admin to stop marketing email.`,
          html: `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(input.body)}</div><p style="color:#666;font-size:12px">— ${escapeHtml(user.organizationName)} via Serenity Universal<br/>You received this because you are on the organization roster. Contact your admin to stop marketing email.</p>`,
        });
        await this.prisma.emailBroadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: 'sent' },
        });
      } catch (error) {
        await this.prisma.emailBroadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'send failed' },
        });
      }
    }

    return {
      id: broadcast.id,
      subject: broadcast.subject,
      body: broadcast.body,
      recipientCount: broadcast.recipientCount,
      sentAt: broadcast.sentAt?.toISOString() ?? null,
      createdAt: broadcast.createdAt.toISOString(),
      createdByName: broadcast.createdBy.name,
    };
  }

  private async recipients(organizationId: string, siteIds?: string[]) {
    if (siteIds && siteIds.length > 0) {
      const memberships = await this.prisma.siteMembership.findMany({
        where: { siteId: { in: siteIds }, site: { organizationId } },
        select: { user: { select: { id: true, email: true, name: true, emailNotificationsEnabled: true } } },
      });
      const unique = new Map<string, { id: string; email: string; name: string }>();
      for (const row of memberships) {
        if (!row.user.emailNotificationsEnabled) {
          continue;
        }
        unique.set(row.user.id, { id: row.user.id, email: row.user.email, name: row.user.name });
      }
      // Org admins may not have site memberships — include them when broadcasting to sites.
      const admins = await this.prisma.user.findMany({
        where: {
          organizationId,
          emailNotificationsEnabled: true,
          userRoles: { some: { role: { isOrgWide: true } } },
        },
        select: { id: true, email: true, name: true },
      });
      for (const admin of admins) {
        unique.set(admin.id, admin);
      }
      return [...unique.values()];
    }
    return this.prisma.user.findMany({
      where: { organizationId, emailNotificationsEnabled: true },
      select: { id: true, email: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
