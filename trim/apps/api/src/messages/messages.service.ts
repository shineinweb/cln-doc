import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MessageDirectory,
  MessageThreadDetail,
  MessageThreadList,
  MessageThreadSummary,
  MessageView,
  OpenAiThread,
  OpenDirectThread,
  SendMessageInput,
  SessionUser,
} from '@trim/contracts';
import { CoachService } from '../coach/coach.service';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { SERENITY_INTRO, SERENITY_NAME } from '../serenity/serenity';

const AI_NAME = SERENITY_NAME;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coach: CoachService,
  ) {}

  async directory(user: SessionUser): Promise<MessageDirectory> {
    const people = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, id: { not: user.id } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
    return { people };
  }

  async listThreads(user: SessionUser): Promise<MessageThreadList> {
    const rows = await this.prisma.messageThread.findMany({
      where: {
        organizationId: user.organizationId,
        participants: { some: { userId: user.id } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { include: { user: { select: { id: true, name: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return { threads: rows.map((row) => this.toSummary(row, user.id)) };
  }

  async openDirect(user: SessionUser, input: OpenDirectThread): Promise<MessageThreadDetail> {
    if (input.peerUserId === user.id) {
      throw new BadRequestException('You cannot message yourself.');
    }
    const peer = await this.prisma.user.findFirst({
      where: { id: input.peerUserId, organizationId: user.organizationId },
      select: { id: true, name: true },
    });
    if (!peer) {
      throw new NotFoundException('That person is not in this organization.');
    }
    const pairKey = directPairKey(user.id, peer.id);
    const existing = await this.prisma.messageThread.findUnique({
      where: { organizationId_pairKey: { organizationId: user.organizationId, pairKey } },
      select: { id: true },
    });
    if (existing) {
      return this.getThread(user, existing.id);
    }
    const created = await this.prisma.messageThread.create({
      data: {
        organizationId: user.organizationId,
        kind: 'direct',
        pairKey,
        title: peer.name,
        participants: {
          create: [{ userId: user.id }, { userId: peer.id }],
        },
        messages: {
          create: {
            authorId: null,
            authorName: 'Trim',
            body: `Conversation with ${peer.name}.`,
            kind: 'system',
          },
        },
      },
      select: { id: true },
    });
    return this.getThread(user, created.id);
  }

  async openAi(user: SessionUser, input: OpenAiThread): Promise<MessageThreadDetail> {
    let siteId: string | null = input.siteId?.trim() || null;
    if (siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      assertSiteAccess(user, site);
      siteId = site.id;
    } else if (user.siteIds[0]) {
      siteId = user.siteIds[0] ?? null;
    }
    const pairKey = `ai:${user.id}`;
    const existing = await this.prisma.messageThread.findUnique({
      where: { organizationId_pairKey: { organizationId: user.organizationId, pairKey } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.messageThread.update({
        where: { id: existing.id },
        data: { ...(siteId ? { siteId } : {}), title: 'Serenity' },
      });
      return this.getThread(user, existing.id);
    }
    const created = await this.prisma.messageThread.create({
      data: {
        organizationId: user.organizationId,
        kind: 'ai',
        pairKey,
        siteId,
        title: 'Serenity',
        participants: { create: [{ userId: user.id }] },
        messages: {
          create: {
            authorId: null,
            authorName: AI_NAME,
            body: `${SERENITY_INTRO} Ask about stored procedures, generate room tasks, assign worker training, or teach me with “Remember that…”.`,
            kind: 'assistant',
          },
        },
      },
      select: { id: true },
    });
    return this.getThread(user, created.id);
  }

  async getThread(user: SessionUser, threadId: string): Promise<MessageThreadDetail> {
    const row = await this.ownedThread(user, threadId);
    await this.prisma.messageParticipant.updateMany({
      where: { threadId: row.id, userId: user.id },
      data: { lastReadAt: new Date() },
    });
    return {
      ...this.toSummary(row, user.id),
      messages: row.messages.map(toMessageView),
    };
  }

  async send(user: SessionUser, threadId: string, input: SendMessageInput): Promise<MessageThreadDetail> {
    const thread = await this.ownedThread(user, threadId);
    await this.prisma.message.create({
      data: {
        threadId: thread.id,
        authorId: user.id,
        authorName: user.name,
        body: input.body,
        kind: 'user',
      },
    });
    if (thread.kind === 'ai') {
      await this.replyAsAi(user, thread, input.body);
    }
    await this.prisma.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    return this.getThread(user, thread.id);
  }

  private async replyAsAi(
    user: SessionUser,
    thread: { id: string; siteId: string | null },
    body: string,
  ): Promise<void> {
    const siteId = thread.siteId ?? user.siteIds[0] ?? null;
    if (!siteId) {
      await this.prisma.message.create({
        data: {
          threadId: thread.id,
          authorId: null,
          authorName: AI_NAME,
          body: "I'm Serenity. Choose a facility in the top bar so I can use that site’s rooms, people, and stored procedures.",
          kind: 'assistant',
        },
      });
      return;
    }
    const historyRows = await this.prisma.message.findMany({
      where: { threadId: thread.id, kind: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { kind: true, body: true },
    });
    const history = historyRows
      .filter((row) => row.kind === 'user' || row.kind === 'assistant')
      .slice(0, -1)
      .map((row) => ({
        role: row.kind === 'user' ? ('user' as const) : ('assistant' as const),
        content: row.body,
      }));
    const answer = await this.coach.chat(user, siteId, { message: body, history });
    const extras = answer.actions.length
      ? `\n\n${answer.actions
          .map((action) =>
            action.type === 'task'
              ? `• Task: ${action.title} (${action.roomName})`
              : `• Training: ${action.traineeName} — ${action.title}`,
          )
          .join('\n')}`
      : '';
    await this.prisma.message.create({
      data: {
        threadId: thread.id,
        authorId: null,
        authorName: AI_NAME,
        body: `${answer.reply}${extras}`,
        kind: 'assistant',
      },
    });
  }

  private async ownedThread(user: SessionUser, threadId: string) {
    const row = await this.prisma.messageThread.findFirst({
      where: {
        id: threadId,
        organizationId: user.organizationId,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) {
      throw new ForbiddenException('You cannot open that conversation.');
    }
    return row;
  }

  private toSummary(
    row: {
      id: string;
      kind: string;
      title: string;
      siteId: string | null;
      updatedAt: Date;
      participants: Array<{ user: { id: string; name: string } }>;
      messages: Array<{ body: string; createdAt: Date }>;
    },
    viewerId: string,
  ): MessageThreadSummary {
    const peer = row.kind === 'direct' ? row.participants.map((item) => item.user).find((person) => person.id !== viewerId) : null;
    // list queries order messages desc take 1; detail includes all ascending — detect via comparing first vs last
    const newest =
      row.messages.length === 0
        ? null
        : row.messages.length === 1
          ? row.messages[0]!
          : row.messages[0]!.createdAt > row.messages[row.messages.length - 1]!.createdAt
            ? row.messages[0]!
            : row.messages[row.messages.length - 1]!;
    return {
      id: row.id,
      kind: row.kind === 'ai' ? 'ai' : 'direct',
      title: row.kind === 'ai' ? SERENITY_NAME : peer?.name ?? row.title,
      siteId: row.siteId,
      peerUserId: peer?.id ?? null,
      peerName: peer?.name ?? null,
      lastMessage: newest?.body ?? null,
      lastMessageAt: newest ? newest.createdAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function directPairKey(left: string, right: string): string {
  return left < right ? `direct:${left}:${right}` : `direct:${right}:${left}`;
}

function toMessageView(row: {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  kind: string;
  createdAt: Date;
}): MessageView {
  const kind = row.kind === 'assistant' || row.kind === 'system' ? row.kind : 'user';
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    kind,
    createdAt: row.createdAt.toISOString(),
  };
}
