import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueueSubmission, ReconcileSubmission, ReviewSubmission, SessionUser, SubmissionView } from '@trim/contracts';
import { deliverPendingOutbox, reconcileSandbox } from '@trim/metrc-sandbox';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const submissionInclude = {
  license: { include: { sites: true } },
  requestedBy: true,
  reviewer: true,
  plantEvent: { include: { plant: true } },
  attempts: { include: { actor: true, reconciledBy: true }, orderBy: { occurredAt: 'desc' as const } },
} as const;

type SubmissionRecord = {
  id: string;
  licenseId: string;
  plantEventId: string;
  status: string;
  sandboxOutcome: string;
  requestedAt: Date;
  reviewedAt: Date | null;
  rejectionNote: string | null;
  license: { licenseNumber: string; organizationId: string; sites: Array<{ siteId: string }> };
  requestedBy: { name: string };
  reviewer: { name: string } | null;
  plantEvent: { eventType: string; note: string | null; plant: { id: string; tag: string } };
  attempts: Array<{
    id: string;
    occurredAt: Date;
    requestId: string;
    outcome: string;
    detail: string | null;
    reconciliationResult: string | null;
    reconciledAt: Date | null;
    actor: { name: string };
    reconciledBy: { name: string } | null;
  }>;
};

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLicense(licenseId: string): Promise<SubmissionView[]> {
    const rows = await this.prisma.metrcSubmission.findMany({
      where: { licenseId },
      include: submissionInclude,
      orderBy: { requestedAt: 'asc' },
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async getOne(user: SessionUser, submissionId: string): Promise<SubmissionView> {
    const row = await this.loadAuthorized(user, submissionId);
    return this.toView(row);
  }

  async queue(user: SessionUser, input: QueueSubmission): Promise<SubmissionView> {
    const event = await this.prisma.plantEvent.findUnique({
      where: { id: input.plantEventId },
      include: { plant: true },
    });
    if (!event) {
      throw new NotFoundException('Inventory event not found');
    }
    const license = await this.prisma.license.findUnique({
      where: { id: event.licenseId },
      include: { sites: true },
    });
    if (!license || license.organizationId !== user.organizationId) {
      throw new NotFoundException('Inventory event not found');
    }
    this.assertCovered(user, license.sites.map((link) => link.siteId), 'You do not have access to this license');
    if (event.eventType !== 'moved' && event.eventType !== 'stage_changed') {
      throw new BadRequestException('Only a move or a stage change can be submitted');
    }
    const block = await this.queueBlockReason(event.id);
    if (block) {
      throw new BadRequestException(block);
    }
    const created = await this.prisma.metrcSubmission.create({
      data: {
        licenseId: license.id,
        plantEventId: event.id,
        status: 'pending_review',
        sandboxOutcome: input.sandboxOutcome,
        requestedById: user.id,
        requestedAt: new Date(),
      },
      include: submissionInclude,
    });
    return this.toView(created);
  }

  async review(user: SessionUser, submissionId: string, input: ReviewSubmission): Promise<SubmissionView> {
    this.assertManager(user);
    const existing = await this.loadAuthorized(user, submissionId);
    if (existing.status !== 'pending_review') {
      throw new BadRequestException('This submission is not waiting for review');
    }
    if (input.decision === 'reject') {
      const rejected = await this.prisma.metrcSubmission.update({
        where: { id: existing.id },
        data: {
          status: 'rejected',
          reviewerId: user.id,
          reviewedAt: new Date(),
          rejectionNote: input.note ?? 'Rejected before send.',
        },
        include: submissionInclude,
      });
      const outboxCount = await this.prisma.metrcOutbox.count({ where: { submissionId: existing.id } });
      if (outboxCount !== 0) {
        throw new BadRequestException('A rejected submission must not have an outbox row');
      }
      return this.toView(rejected);
    }
    const sandboxOutcome = input.sandboxOutcome ?? existing.sandboxOutcome;
    const requestId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.metrcSubmission.updateMany({
        where: { id: existing.id, status: 'pending_review' },
        data: {
          status: 'queued',
          sandboxOutcome,
          reviewerId: user.id,
          reviewedAt: new Date(),
          rejectionNote: null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('This submission is not waiting for review');
      }
      await tx.metrcOutbox.create({
        data: {
          submissionId: existing.id,
          licenseId: existing.licenseId,
          requestId,
          status: 'pending',
          sandboxOutcome,
          payload: {
            licenseNumber: existing.license.licenseNumber,
            plantTag: existing.plantEvent.plant.tag,
            eventType: existing.plantEvent.eventType,
            eventNote: existing.plantEvent.note,
          },
        },
      });
    });
    return this.getOne(user, existing.id);
  }

  async reconcile(user: SessionUser, submissionId: string, input: ReconcileSubmission): Promise<SubmissionView> {
    this.assertManager(user);
    const existing = await this.loadAuthorized(user, submissionId);
    if (existing.status !== 'uncertain') {
      throw new BadRequestException('Only an uncertain submission can be reconciled');
    }
    const attempt = existing.attempts[0];
    if (!attempt || attempt.reconciliationResult) {
      throw new BadRequestException('This submission has no uncertain attempt to reconcile');
    }
    const finding = reconcileSandbox({ requestId: attempt.requestId, finding: input.finding });
    await this.prisma.$transaction([
      this.prisma.metrcAttempt.update({
        where: { id: attempt.id },
        data: {
          reconciliationResult: finding.result,
          reconciledAt: new Date(),
          reconciledById: user.id,
          detail: finding.detail,
        },
      }),
      this.prisma.metrcSubmission.update({
        where: { id: existing.id },
        data: { status: 'reconciled' },
      }),
    ]);
    return this.getOne(user, existing.id);
  }

  async deliverPending(): Promise<number> {
    return deliverPendingOutbox(this.prisma);
  }

  private assertManager(user: SessionUser): void {
    if (!user.isOrgAdmin) {
      throw new ForbiddenException('Only a manager can review submissions.');
    }
  }

  private assertCovered(user: SessionUser, siteIds: string[], denied: string): void {
    if (user.isOrgAdmin) {
      return;
    }
    if (!siteIds.some((siteId) => user.siteIds.includes(siteId))) {
      throw new ForbiddenException(denied);
    }
  }

  private async loadAuthorized(user: SessionUser, submissionId: string): Promise<SubmissionRecord> {
    const row = await this.prisma.metrcSubmission.findUnique({
      where: { id: submissionId },
      include: submissionInclude,
    });
    if (!row || row.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Submission not found');
    }
    this.assertCovered(
      user,
      row.license.sites.map((link) => link.siteId),
      'You do not have access to this submission',
    );
    return row;
  }

  private async queueBlockReason(plantEventId: string): Promise<string | null> {
    const rows = await this.prisma.metrcSubmission.findMany({
      where: { plantEventId },
      include: { attempts: true },
    });
    if (rows.some((row) => row.status === 'uncertain')) {
      return 'This change cannot be submitted again until reconciliation says it did not land';
    }
    if (rows.some((row) => row.status === 'pending_review' || row.status === 'queued')) {
      return 'This change is already waiting to be sent';
    }
    if (
      rows.some(
        (row) =>
          row.status === 'succeeded' ||
          (row.status === 'reconciled' && row.attempts.some((attempt) => attempt.reconciliationResult === 'landed')),
      )
    ) {
      return 'This change already landed and will not be sent again';
    }
    return null;
  }

  private async toView(row: SubmissionRecord): Promise<SubmissionView> {
    const attempt = row.attempts[0] ?? null;
    const siblings = await this.prisma.metrcSubmission.findMany({
      where: { plantEventId: row.plantEventId },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    });
    const latest = siblings[0]?.id === row.id;
    const canQueueAgain = latest && (await this.queueBlockReason(row.plantEventId)) === null && row.status !== 'pending_review';
    return {
      id: row.id,
      licenseId: row.licenseId,
      licenseNumber: row.license.licenseNumber,
      plantId: row.plantEvent.plant.id,
      plantTag: row.plantEvent.plant.tag,
      plantEventId: row.plantEventId,
      eventType: row.plantEvent.eventType,
      eventNote: row.plantEvent.note,
      status: row.status,
      sandboxOutcome: row.sandboxOutcome,
      requestedByName: row.requestedBy.name,
      requestedAt: row.requestedAt.toISOString(),
      reviewerName: row.reviewer?.name ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      rejectionNote: row.rejectionNote,
      canQueueAgain,
      attempt: attempt
        ? {
            id: attempt.id,
            actorName: attempt.actor.name,
            occurredAt: attempt.occurredAt.toISOString(),
            requestId: attempt.requestId,
            outcome: attempt.outcome,
            detail: attempt.detail,
            reconciliationResult:
              attempt.reconciliationResult === 'landed' || attempt.reconciliationResult === 'not_landed'
                ? attempt.reconciliationResult
                : null,
            reconciledAt: attempt.reconciledAt?.toISOString() ?? null,
            reconciledByName: attempt.reconciledBy?.name ?? null,
          }
        : null,
    };
  }
}
