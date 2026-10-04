import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ComparisonReport, CycleReport, DashboardAnalytics, SessionUser, SiteReport } from '@trim/contracts';
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
    steps: Array<{ kind: string; occurredAt: Date; weightGrams: number | null; voidedAt: Date | null }>;
    wastes: Array<{ weightGrams: number; voidedAt: Date | null }>;
    packages: Array<{ weightGrams: number; voidedAt: Date | null }>;
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

  async dashboard(user: SessionUser, siteId: string): Promise<DashboardAnalytics> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== user.organizationId) {
      throw new NotFoundException('Report not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(site.id)) {
      throw new ForbiddenException('You do not have access to this report.');
    }
    assertSiteAccess(user, site);

    const [cycles, harvests, stays, rates] = await Promise.all([
      this.prisma.cropCycle.findMany({
        where: { room: { siteId: site.id } },
        include: {
          room: true,
          laborEntries: true,
          inputCosts: true,
        },
        orderBy: [{ cultivar: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.harvest.findMany({
        where: { siteId: site.id, voidedAt: null },
        include: {
          cycle: { select: { cultivar: true } },
          plants: { include: { plant: { include: { strain: { select: { name: true } } } } } },
          steps: { where: { voidedAt: null } },
          packages: { where: { voidedAt: null }, orderBy: { recordedAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.roomStay.findMany({
        where: { siteId: site.id },
        orderBy: [{ cultivar: 'asc' }, { startsOn: 'asc' }],
      }),
      this.prisma.laborRate.findMany({ where: { organizationId: user.organizationId } }),
    ]);

    const rateByName = new Map(rates.map((rate) => [rate.personName, rate.hourlyCents]));
    const timeZone = site.timezone;
    const statement =
      'Dashboard charts use stored harvest weights, labor, input costs, packages, and active crop plant counts. Serenity does not store sales dollars.';

    const actualYield: Array<{ cultivar: string; week: string; grams: number; estimated: boolean }> = [];
    const strainStats = new Map<string, { harvestCount: number; packagedGrams: number }>();
    let packagedMtdGrams = 0;
    let dryPlantSum = 0;
    let dryPlantCount = 0;
    const packagesByItem: DashboardAnalytics['packagesByItem'] = [];
    const monthPrefix = calendarDateInTimeZone(new Date(), timeZone).slice(0, 7);

    for (const harvest of harvests) {
      const dry = harvest.steps.find((step) => step.kind === 'dry_weight')?.weightGrams ?? null;
      const harvestedAt = harvest.steps.find((step) => step.kind === 'harvested')?.occurredAt ?? null;
      const packagedGrams = harvest.packages.reduce((sum, row) => sum + row.weightGrams, 0);
      const cultivar =
        harvest.cycle?.cultivar ??
        harvest.plants.find((row) => row.plant.strain?.name)?.plant.strain?.name ??
        cultivarFromHarvestName(harvest.name);
      const plantCount = harvest.plants.length;
      if (dry !== null && harvestedAt) {
        actualYield.push({
          cultivar,
          week: weekStartKey(calendarDateInTimeZone(harvestedAt, timeZone)),
          grams: dry,
          estimated: false,
        });
      }
      if (dry !== null && plantCount > 0) {
        dryPlantSum += dry;
        dryPlantCount += plantCount;
      }
      const strain = strainStats.get(cultivar) ?? { harvestCount: 0, packagedGrams: 0 };
      strain.harvestCount += 1;
      strain.packagedGrams += packagedGrams;
      strainStats.set(cultivar, strain);
      for (const pkg of harvest.packages) {
        packagesByItem.push({
          label: pkg.label,
          weightGrams: pkg.weightGrams,
          harvestName: harvest.name,
        });
        const recorded = calendarDateInTimeZone(pkg.recordedAt, timeZone);
        if (recorded.startsWith(monthPrefix)) {
          packagedMtdGrams += pkg.weightGrams;
        }
      }
    }

    let avgGramsPerPlant = dryPlantCount > 0 ? dryPlantSum / dryPlantCount : null;
    if (avgGramsPerPlant === null) {
      const orgHarvests = await this.prisma.harvest.findMany({
        where: { site: { organizationId: user.organizationId }, voidedAt: null },
        include: {
          plants: { select: { id: true } },
          steps: { where: { voidedAt: null, kind: 'dry_weight' }, select: { weightGrams: true } },
        },
      });
      let orgDry = 0;
      let orgPlants = 0;
      for (const harvest of orgHarvests) {
        const dry = harvest.steps[0]?.weightGrams ?? null;
        if (dry === null || harvest.plants.length === 0) {
          continue;
        }
        orgDry += dry;
        orgPlants += harvest.plants.length;
      }
      avgGramsPerPlant = orgPlants > 0 ? orgDry / orgPlants : null;
    }
    const estimatedYield: Array<{ cultivar: string; week: string; grams: number; estimated: boolean }> = [];
    if (avgGramsPerPlant !== null) {
      for (const cycle of cycles) {
        if (cycle.status !== 'active' || cycle.plantCount <= 0) {
          continue;
        }
        const hasHarvest = harvests.some((harvest) => harvest.cycleId === cycle.id);
        if (hasHarvest) {
          continue;
        }
        const week = weekStartKey(dateKeyFromDbDate(cycle.expectedHarvestDate));
        estimatedYield.push({
          cultivar: cycle.cultivar,
          week,
          grams: Math.round(cycle.plantCount * avgGramsPerPlant),
          estimated: true,
        });
      }
    }

    const yieldRows = [...actualYield, ...estimatedYield];
    const weekSet = new Set(yieldRows.map((row) => row.week));
    const weeks = [...weekSet].sort();
    const cultivarSet = new Set(yieldRows.map((row) => row.cultivar));
    const cultivars = [...cultivarSet].sort();
    const series = cultivars.map((cultivar) => ({
      cultivar,
      points: weeks.map((week) => {
        const match = yieldRows.find((row) => row.cultivar === cultivar && row.week === week);
        return {
          week,
          grams: match?.grams ?? 0,
          estimated: match?.estimated ?? false,
        };
      }),
    }));

    let laborCents = 0;
    let cannabisCents = 0;
    let nonCannabisCents = 0;
    for (const cycle of cycles) {
      for (const entry of cycle.laborEntries) {
        const hourly = rateByName.get(entry.personName);
        if (hourly == null) {
          continue;
        }
        laborCents += Math.round(Number(entry.hours) * hourly);
      }
      for (const input of cycle.inputCosts) {
        const cost = Math.round(Number(input.quantity) * input.unitCostCents);
        if (isCannabisInput(input.description)) {
          cannabisCents += cost;
        } else {
          nonCannabisCents += cost;
        }
      }
    }

    const topStrains = [...strainStats.entries()]
      .map(([strainName, stats]) => ({
        strainName,
        harvestCount: stats.harvestCount,
        packagedGrams: stats.packagedGrams,
      }))
      .sort((left, right) => right.packagedGrams - left.packagedGrams || right.harvestCount - left.harvestCount)
      .slice(0, 8);

    const forecastDates = forecastDateKeys(timeZone, 4);
    const forecastCultivars = [
      ...new Set([
        ...cycles.filter((cycle) => cycle.status === 'active').map((cycle) => cycle.cultivar),
        ...stays.map((stay) => stay.cultivar),
      ]),
    ].sort();
    const plantForecast = {
      dates: forecastDates,
      rows: forecastCultivars.map((cultivar) => ({
        cultivar,
        values: forecastDates.map((date) => {
          const fromCycles = cycles
            .filter(
              (cycle) =>
                cycle.status === 'active' &&
                cycle.cultivar === cultivar &&
                dateKeyFromDbDate(cycle.startDate) <= date &&
                dateKeyFromDbDate(cycle.expectedHarvestDate) >= date,
            )
            .reduce((sum, cycle) => sum + cycle.plantCount, 0);
          if (fromCycles > 0) {
            return fromCycles;
          }
          const openStay = stays.some(
            (stay) =>
              stay.cultivar === cultivar &&
              dateKeyFromDbDate(stay.startsOn) <= date &&
              dateKeyFromDbDate(stay.endsOn) >= date,
          );
          return openStay ? 1 : 0;
        }),
      })),
    };

    return {
      siteId: site.id,
      siteName: site.name,
      statement,
      yieldGraph: { weeks, cultivars, series },
      cogs: {
        laborCents,
        cannabisCents,
        nonCannabisCents,
        totalCents: laborCents + cannabisCents + nonCannabisCents,
      },
      topStrains,
      plantForecast,
      kpis: {
        packagedMtdGrams,
        averageGramsPerPlant: avgGramsPerPlant,
      },
      packagesByItem: packagesByItem.slice(0, 12),
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
          where: { voidedAt: null },
          include: {
            plants: { select: { id: true } },
            steps: { where: { voidedAt: null } },
            wastes: { where: { voidedAt: null } },
            packages: { where: { voidedAt: null } },
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
    const steps = harvest.steps.filter((step) => !step.voidedAt);
    const packages = harvest.packages.filter((row) => !row.voidedAt);
    const wastes = harvest.wastes.filter((row) => !row.voidedAt);
    const wet = steps.find((step) => step.kind === 'wet_weight')?.weightGrams ?? null;
    const dry = steps.find((step) => step.kind === 'dry_weight')?.weightGrams ?? null;
    const packageWeightGrams = packages.reduce((sum, row) => sum + row.weightGrams, 0);
    const wasteWeightGrams = wastes.reduce((sum, row) => sum + row.weightGrams, 0);
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

function cultivarFromHarvestName(name: string): string {
  const trimmed = name.replace(/\s+harvest$/i, '').replace(/\s+flower$/i, '').trim();
  return trimmed.length > 0 ? trimmed : name;
}

function isCannabisInput(description: string): boolean {
  return /cannabis|flower|nutrient|clone|trim|biomass/i.test(description);
}

function weekStartKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  const weekday = utc.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

function forecastDateKeys(timeZone: string, count: number): string[] {
  const today = calendarDateInTimeZone(new Date(), timeZone);
  const [year, month, day] = today.split('-').map(Number);
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const utc = new Date(Date.UTC(year!, month! - 1, day! + index));
    keys.push(utc.toISOString().slice(0, 10));
  }
  return keys;
}
