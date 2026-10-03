import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { CycleReport } from '@trim/contracts';
export function CycleReportView({ report }: { report: CycleReport }) {
  return (
    <Card data-testid="cycle-report" data-cultivar={report.cultivar} sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.14em' }}>
          {report.siteName} · {report.roomName}
        </Typography>
        <Typography variant="h2" sx={{ fontSize: 28 }} data-testid="report-cultivar">
          {report.cultivar}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>{report.cycleName}</Typography>
        <Section title="Yield">
          {report.yield.present ? (
            <Box>
              <Typography data-testid="yield-grams-per-plant" sx={{ fontWeight: 700 }}>
                {formatGrams(report.yield.gramsPerPlant)} g per plant
              </Typography>
              <Formula testId="yield-formula">{report.yield.gramsPerPlantFormula}</Formula>
              <Typography sx={{ mt: 1 }} data-testid="yield-ledger">
                Wet {report.yield.wetWeightGrams ?? '—'} g · dry {report.yield.dryWeightGrams} g · packaged{' '}
                {report.yield.packageWeightGrams} g · waste {report.yield.wasteWeightGrams} g · unaccounted{' '}
                {report.yield.unaccountedGrams} g · {report.yield.plantCount} plants
              </Typography>
              <Formula testId="ledger-formula">{report.yield.ledgerFormula}</Formula>
            </Box>
          ) : (
            <Box>
              <Typography data-testid="yield-absent" sx={{ fontWeight: 700 }}>
                {report.yield.absentReason}
              </Typography>
              <Formula testId="yield-formula">{report.yield.gramsPerPlantFormula}</Formula>
            </Box>
          )}
        </Section>
        <Section title="Cycle duration">
          {report.duration.completedDurationDays == null ? (
            <Typography data-testid="duration-open" sx={{ fontWeight: 700 }}>
              Days since start: {report.duration.daysSinceStart}. Completed duration is absent.
            </Typography>
          ) : (
            <Typography data-testid="duration-completed" sx={{ fontWeight: 700 }}>
              Completed duration: {report.duration.completedDurationDays} days
            </Typography>
          )}
          <Formula testId="duration-formula">{report.duration.formula}</Formula>
        </Section>
        <Section title="Labor">
          {report.labor.lines.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No labor entries are stored.</Typography>
          ) : (
            report.labor.lines.map((line) => (
              <Box key={line.entryId} sx={{ mb: 1 }} data-testid="labor-line">
                <Typography>
                  {line.personName} · {line.hours} hours
                  {line.costCents == null ? '' : ` · ${formatCents(line.costCents)}`}
                </Typography>
                <Formula testId="labor-formula">{line.formula}</Formula>
              </Box>
            ))
          )}
          <Typography data-testid="labor-cost" sx={{ fontWeight: 700 }}>
            Labor cost {formatCents(report.labor.totalCostCents)}
          </Typography>
          <Formula testId="labor-total-formula">{report.labor.formula}</Formula>
        </Section>
        <Section title="Input costs">
          {report.inputs.lines.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No input costs are stored.</Typography>
          ) : (
            report.inputs.lines.map((line) => (
              <Box key={line.inputId} sx={{ mb: 1 }} data-testid="input-line">
                <Typography>
                  {line.description} · {formatCents(line.costCents)}
                </Typography>
                <Formula testId="input-formula">{line.formula}</Formula>
              </Box>
            ))
          )}
          <Formula testId="input-total-formula">{report.inputs.formula}</Formula>
        </Section>
        <Section title="Total cost">
          <Typography data-testid="cost-total" sx={{ fontWeight: 700 }}>
            {formatCents(report.totalCostCents)}
          </Typography>
          <Formula testId="cost-formula">{report.totalCostFormula}</Formula>
        </Section>
        <Typography data-testid="sample-exclusion" sx={{ color: 'text.secondary', mt: 1 }}>
          {report.sampleExclusionFormula} Excluded sample rows: {report.excludedSampleReadingCount}.
        </Typography>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h3" sx={{ fontSize: 18, mb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Formula({ testId, children }: { testId: string; children: string }) {
  return (
    <Typography data-testid={testId} sx={{ color: 'text.secondary', fontSize: 14 }}>
      {children}
    </Typography>
  );
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function formatGrams(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return value.toFixed(2);
}
