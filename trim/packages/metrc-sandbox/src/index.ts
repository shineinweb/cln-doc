import type { PrismaClient } from '@trim/database';

export type SandboxOutcome = 'success' | 'failure' | 'uncertain';
export type SandboxFinding = 'landed' | 'not_landed';

export type SandboxDelivery = {
  outcome: SandboxOutcome;
  detail: string;
};

/**
 * Deterministic stand-in for Metrc. It does not open a socket.
 * The caller chooses success, a definite failure, or an uncertain timeout.
 */
export function submitToSandbox(input: { requestId: string; outcome: SandboxOutcome }): SandboxDelivery {
  if (!input.requestId) {
    throw new Error('Sandbox request id is required');
  }
  if (input.outcome === 'success') {
    return { outcome: 'success', detail: 'Sandbox accepted the plant change.' };
  }
  if (input.outcome === 'failure') {
    return { outcome: 'failure', detail: 'Sandbox rejected the plant change.' };
  }
  return { outcome: 'uncertain', detail: 'Sandbox timed out. The write may have landed.' };
}

/** The sandbox ledger answer for an uncertain request. The caller chooses which fact the ledger returns. */
export function reconcileSandbox(input: { requestId: string; finding: SandboxFinding }): { result: SandboxFinding; detail: string } {
  if (!input.requestId) {
    throw new Error('Sandbox request id is required');
  }
  if (input.finding === 'landed') {
    return { result: 'landed', detail: 'Sandbox ledger shows this request landed.' };
  }
  return { result: 'not_landed', detail: 'Sandbox ledger has no write for this request.' };
}

function isOutcome(value: string): value is SandboxOutcome {
  return value === 'success' || value === 'failure' || value === 'uncertain';
}

/** Claim pending outbox rows and record one attempt each. Safe for two workers to run. */
export async function deliverPendingOutbox(prisma: PrismaClient): Promise<number> {
  const pending = await prisma.metrcOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: { submission: true },
  });
  let delivered = 0;
  for (const row of pending) {
    const claimed = await prisma.metrcOutbox.updateMany({
      where: { id: row.id, status: 'pending' },
      data: { status: 'delivering' },
    });
    if (claimed.count !== 1) {
      continue;
    }
    if (!isOutcome(row.sandboxOutcome) || !row.submission.reviewerId) {
      await prisma.metrcOutbox.update({ where: { id: row.id }, data: { status: 'pending' } });
      continue;
    }
    const result = submitToSandbox({ requestId: row.requestId, outcome: row.sandboxOutcome });
    const status = result.outcome === 'success' ? 'succeeded' : result.outcome === 'failure' ? 'failed' : 'uncertain';
    await prisma.$transaction([
      prisma.metrcAttempt.create({
        data: {
          submissionId: row.submissionId,
          outboxId: row.id,
          actorUserId: row.submission.reviewerId,
          occurredAt: new Date(),
          requestId: row.requestId,
          outcome: result.outcome,
          detail: result.detail,
        },
      }),
      prisma.metrcOutbox.update({ where: { id: row.id }, data: { status } }),
      prisma.metrcSubmission.update({ where: { id: row.submissionId }, data: { status } }),
    ]);
    delivered += 1;
  }
  return delivered;
}
