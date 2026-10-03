import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ComparisonReport, CycleReport, SessionUser, SiteReport } from '@trim/contracts';
import { calendarDateInTimeZone, cycleDayNumber, dateKeyFromDbDate } from '../cycles/cycle-day';
import { assertSiteAccess, authorizedSiteWhere } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';

type CycleRow = {
  id: string;
  name: string;
  cultivar: string;
  startDate: Date;
  room: {
    id: string;
    name: string;
    site: { id: string; name: string; timezone: string; organizationId: string };
  };
  laborEntries: Array<{ id: string; personName: string; hours: { toString(): string } }>;
  inputCosts: Array<{
    id: string;
    description: string;
    quantity: { toString(): string };
    unit: string;
    unitCostCents: number;
  }>;
  harvests: Array<{
    id: string;
    plants: Array<{ id: string }>;
    steps: Array<{ kind: string; occurredAt: Date; weightGrams: number | null }>;
    wastes: Array<{ weightGrams: number }>;
    packages: Array<{ weightGrams: number }>;
  }>;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async comparison(user: SessionUser): Promise<ComparisonReport> {
    const cycles = await this.cyclesFor(user, null);
    return { cycles };
  }

  async siteReport(user: SessionUser, siteId: string): Promise<SiteReport> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== user.organizationId) {
      throw new NotFoundException('Report not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(site.id)) {
      throw new ForbiddenException('You do not have access to this report.');
    }
    assertSiteAccess(user, site);
    const cycles = await this.cyclesFor(user, site.id);
    return {
      siteId: site.id,
      siteName: site.name,
      siteTimezone: site.timezone,
      cycles,
    };
  }

  private async cyclesFor(user: SessionUser, siteId: string | null): Promise<CycleReport[]> {
    const cycles = await this.prisma.cropCycle.findMany({
      where: {
        room: { site: siteId ? { id: siteId } : authorizedSiteWhere(user) },
      },
      include: {
        room: { include: { site: true } },
        laborEntries: { orderBy: { occurredOn: 'asc' } },
        inputCosts: { orderBy: { description: 'asc' } },
        harvests: {
          include: {
            plants: { select: { id: true } },
            steps: true,
            wastes: true,
            packages: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ room: { name: 'asc' } }, { name: 'asc' }],
    });
    const rates = await this.prisma.laborRate.findMany({
      where: { organizationId: user.organizationId },
    });
    const rateByName = new Map(rates.map((rate) => [rate.personName, rate]));
    const roomIds = [...new Set(cycles.map((cycle) => cycle.room.id))];
    const readings = await this.prisma.environmentalReading.findMany({
      where: { roomId: { in: roomIds } },
      select: { roomId: true, isSample: true },
    });
    const samplesByRoom = new Map<string, number>();
    for (const reading of readings) {
      if (!reading.isSample) {
        continue;
      }
      samplesByRoom.set(reading.roomId, (samplesByRoom.get(reading.roomId) ?? 0) + 1);
    }
    return cycles.map((cycle) => this.toReport(cycle, rateByName, samplesByRoom.get(cycle.room.id) ?? 0));
  }

  private toReport(
    cycle: CycleRow,
    rateByName: Map<string, { id: string; hourlyCents: number }>,
    excludedSampleReadingCount: number,
  ): CycleReport {
    const timeZone = cycle.room.site.timezone;
    const startDate = dateKeyFromDbDate(cycle.startDate);
    const harvest = cycle.harvests.find((row) => row.steps.some((step) => step.kind === 'harvested')) ?? cycle.harvests[0] ?? null;
    const yieldReport = this.yieldFor(harvest);
    const duration = this.durationFor(startDate, timeZone, harvest);
    const laborLines = cycle.laborEntries.map((entry) => {
      const hours = Number(entry.hours);
      const rate = rateByName.get(entry.personName) ?? null;
      const costCents = rate ? Math.round(hours * rate.hourlyCents) : null;
      const formula = rate
        ? `${hours} hours × ${rate.hourlyCents} cents/hour = ${costCents} cents. Labor entry ${entry.id}, rate ${rate.id}.`
        : `${hours} hours have no stored hourly rate for ${entry.personName}. Labor entry ${entry.id}.`;
      return {
        entryId: entry.id,
        rateId: rate?.id ?? null,
        personName: entry.personName,
        hours,
        hourlyCents: rate?.hourlyCents ?? null,
        costCents,
        formula,
      };
    });
    const laborCostCents = laborLines.reduce((sum, line) => sum + (line.costCents ?? 0), 0);
    const laborHours = laborLines.reduce((sum, line) => sum + line.hours, 0);
    const inputLines = cycle.inputCosts.map((input) => {
      const quantity = Number(input.quantity);
      const costCents = Math.round(quantity * input.unitCostCents);
      return {
        inputId: input.id,
        description: input.description,
        quantity,
        unit: input.unit,
        unitCostCents: input.unitCostCents,
        costCents,
        formula: `${quantity} ${input.unit} × ${input.unitCostCents} cents = ${costCents} cents. Input ${input.id}.`,
      };
    });
    const inputCostCents = inputLines.reduce((sum, line) => sum + line.costCents, 0);
    const totalCostCents = laborCostCents + inputCostCents;
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      cultivar: cycle.cultivar,
      roomId: cycle.room.id,
      roomName: cycle.room.name,
      siteId: cycle.room.site.id,
      siteName: cycle.room.site.name,
      siteTimezone: timeZone,
      yield: yieldReport,
      duration,
      labor: {
        lines: laborLines,
        totalHours: laborHours,
        totalCostCents: laborCostCents,
        formula: `Labor cost = sum of each labor entry’s hours × its stored hourly rate = ${laborCostCents} cents.`,
      },
      inputs: {
        lines: inputLines,
        totalCostCents: inputCostCents,
        formula: `Input cost = sum of each stored quantity × its unit cost = ${inputCostCents} cents.`,
      },
      totalCostCents,
      totalCostFormula: `Total cost = labor cost ${laborCostCents} cents + input cost ${inputCostCents} cents = ${totalCostCents} cents.`,
      excludedSampleReadingCount,
      sampleExclusionFormula: 'Sample environmental readings are excluded. This report does not use their values.',
    };
  }

  private yieldFor(harvest: CycleRow['harvests'][number] | null): CycleReport['yield'] {
    if (!harvest) {
      return {
        present: false,
        absentReason: 'This cycle has not been harvested, so yield is absent.',
        harvestId: null,
        plantCount: null,
        wetWeightGrams: null,
        dryWeightGrams: null,
        packageWeightGrams: null,
        wasteWeightGrams: null,
        unaccountedGrams: null,
        gramsPerPlant: null,
        gramsPerPlantFormula:
          'Grams per plant = dry weight ÷ harvest plant count. This cycle has not been harvested, so yield is absent.',
        ledgerFormula: 'Packaged + waste + unaccounted = dry weight. This cycle has not been harvested, so the ledger is absent.',
      };
    }
    const plantCount = harvest.plants.length;
    const wet = harvest.steps.find((step) => step.kind === 'wet_weight')?.weightGrams ?? null;
    const dry = harvest.steps.find((step) => step.kind === 'dry_weight')?.weightGrams ?? null;
    const packageWeightGrams = harvest.packages.reduce((sum, row) => sum + row.weightGrams, 0);
    const wasteWeightGrams = harvest.wastes.reduce((sum, row) => sum + row.weightGrams, 0);
    const unaccountedGrams = dry === null ? null : dry - packageWeightGrams - wasteWeightGrams;
    const gramsPerPlant = dry !== null && plantCount > 0 ? dry / plantCount : null;
    const present = gramsPerPlant !== null;
    return {
      present,
      absentReason: present ? null : 'Dry weight or harvest plant count is missing, so yield is absent.',
      harvestId: harvest.id,
      plantCount,
      wetWeightGrams: wet,
      dryWeightGrams: dry,
      packageWeightGrams,
      wasteWeightGrams,
      unaccountedGrams,
      gramsPerPlant,
      gramsPerPlantFormula:
        gramsPerPlant === null
          ? 'Grams per plant = dry weight ÷ harvest plant count. A stored dry weight and plant count are required.'
          : `Grams per plant = dry weight ${dry} g ÷ ${plantCount} plants.`,
      ledgerFormula:
        dry === null || unaccountedGrams === null
          ? 'Packaged + waste + unaccounted = dry weight. Dry weight is not stored.'
          : `Packaged ${packageWeightGrams} g + waste ${wasteWeightGrams} g + unaccounted ${unaccountedGrams} g = dry weight ${dry} g.`,
    };
  }

  private durationFor(
    startDate: string,
    timeZone: string,
    harvest: CycleRow['harvests'][number] | null,
  ): CycleReport['duration'] {
    const harvestedAt = harvest?.steps.find((step) => step.kind === 'harvested')?.occurredAt ?? null;
    if (!harvestedAt) {
      const daysSinceStart = cycleDayNumber(startDate, timeZone);
      return {
        startDate,
        harvestAt: null,
        daysSinceStart,
        completedDurationDays: null,
        formula: `Days since start = calendar days from ${startDate} through today in ${timeZone}, counting the start date as day 1. Completed duration is absent because this cycle has not been harvested.`,
      };
    }
    const harvestDate = calendarDateInTimeZone(harvestedAt, timeZone);
    const completedDurationDays = cycleDayNumber(startDate, timeZone, harvestedAt);
    return {
      startDate,
      harvestAt: harvestedAt.toISOString(),
      daysSinceStart: null,
      completedDurationDays,
      formula: `Completed duration = calendar days from ${startDate} through ${harvestDate} in ${timeZone}, counting the start date as day 1.`,
    };
  }
}
