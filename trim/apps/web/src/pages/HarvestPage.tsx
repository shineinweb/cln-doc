import { Alert, Box, Button, Card, CardContent, Skeleton, TextField, Typography } from '@mui/material';
import { harvestDetailSchema, packageDetailSchema, type HarvestDetail } from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiGet, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatTimestamp } from '../crops/format';

const stepLabel: Record<string, string> = {
  harvested: 'Harvested',
  wet_weight: 'Wet weight',
  drying: 'Drying',
  dry_weight: 'Dry weight',
  trimming: 'Trimming',
};

export function HarvestPage() {
  const { harvestId = '' } = useParams();
  const harvest = useQuery({
    queryKey: ['harvest', harvestId],
    queryFn: () => apiGet(`/harvests/${harvestId}`, harvestDetailSchema),
    enabled: Boolean(harvestId),
    retry: false,
  });

  if (harvest.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (harvest.error instanceof ApiError && (harvest.error.status === 403 || harvest.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="harvest-access-warning">
        {harvest.error.status === 403 ? 'You do not have access to this harvest.' : 'This harvest was not found.'}
      </Alert>
    );
  }
  if (harvest.error || !harvest.data) {
    return <Alert severity="error">{harvest.error?.message ?? 'This harvest could not be loaded.'}</Alert>;
  }

  const row = harvest.data;
  return (
    <Box>
      <PageHeader
        kicker={row.licenseNumber}
        title={row.name}
        lede={`${row.siteName ?? 'Facility'} · ${row.plantCount} plant tags stay on this harvest.`}
      />
      <Typography data-testid="harvest-plant-count" sx={{ mb: 2 }}>
        {row.plantCount} plants
      </Typography>
      <WeightLedger ledger={row.ledger} />
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
            Steps
          </Typography>
          {row.steps.map((step) => (
            <Typography key={step.id} data-testid="harvest-step" sx={{ mb: 0.75 }}>
              {stepLabel[step.kind] ?? step.kind}
              {step.weightGrams !== null ? ` · ${step.weightGrams} g` : ''}
              {step.roomName ? ` · ${step.roomName}` : ''} · {step.actorName} · {formatTimestamp(step.occurredAt)}
            </Typography>
          ))}
          {row.wastes.map((waste) => (
            <Typography key={waste.id} data-testid="harvest-waste" sx={{ mb: 0.75 }}>
              Waste · {waste.weightGrams} g · {waste.actorName} · {formatTimestamp(waste.recordedAt)}
              {waste.note ? ` · ${waste.note}` : ''}
            </Typography>
          ))}
        </CardContent>
      </Card>
      <NextStep harvest={row} />
      <Typography variant="h3" sx={{ fontSize: 22, mt: 3, mb: 1 }}>
        Source tags
      </Typography>
      <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
        {row.plants.map((plant) => (
          <Typography key={plant.plantId} data-testid="harvest-tag">
            {plant.tag}
          </Typography>
        ))}
      </Box>
      {row.packages.length > 0 ? (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
            Packages
          </Typography>
          {row.packages.map((item) => (
            <Typography key={item.id}>
              <RouterLink to={`/packages/${item.id}`}>{item.label}</RouterLink>
              {` · ${item.weightGrams} g · ${item.sourceTagCount} source tags`}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function WeightLedger({ ledger }: { ledger: HarvestDetail['ledger'] }) {
  return (
    <Box data-testid="weight-ledger" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5, mb: 2 }}>
      <Figure testId="weight-wet" label="Wet weight" value={ledger.wetWeightGrams} />
      <Figure testId="weight-dry" label="Dry weight" value={ledger.dryWeightGrams} />
      <Figure testId="weight-packaged" label="Packaged" value={ledger.packageWeightGrams} />
      <Figure testId="weight-waste" label="Waste" value={ledger.wasteWeightGrams} />
      <Figure testId="weight-unaccounted" label="Unaccounted" value={ledger.unaccountedGrams} />
    </Box>
  );
}

function Figure({ testId, label, value }: { testId: string; label: string; value: number | null }) {
  return (
    <Box>
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{label}</Typography>
      <Typography data-testid={testId} sx={{ fontWeight: 600 }}>
        {value === null ? 'Not recorded' : `${value} g`}
      </Typography>
    </Box>
  );
}

function NextStep({ harvest }: { harvest: HarvestDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [grams, setGrams] = useState('');
  const [packageGrams, setPackageGrams] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [scan, setScan] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const kinds = new Set(harvest.steps.map((step) => step.kind));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['harvest', harvest.id] });
    await queryClient.invalidateQueries({ queryKey: ['harvests'] });
  };
  const send = useMutation({
    mutationFn: async (action: 'wet' | 'drying' | 'dry' | 'trim' | 'waste') => {
      const weight = Number(grams);
      if (action === 'wet') {
        return apiSend(`/harvests/${harvest.id}/wet-weight`, harvestDetailSchema, { grams: weight });
      }
      if (action === 'drying') {
        return apiSend(`/harvests/${harvest.id}/drying`, harvestDetailSchema, {});
      }
      if (action === 'dry') {
        return apiSend(`/harvests/${harvest.id}/dry-weight`, harvestDetailSchema, { grams: weight });
      }
      if (action === 'trim') {
        return apiSend(`/harvests/${harvest.id}/trimming`, harvestDetailSchema, {});
      }
      return apiSend(`/harvests/${harvest.id}/waste`, harvestDetailSchema, { grams: weight, note });
    },
    onSuccess: async () => {
      setMessage(null);
      setGrams('');
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const createPackage = useMutation({
    mutationFn: () =>
      apiSend(`/harvests/${harvest.id}/packages`, packageDetailSchema, {
        label: label.trim(),
        grams: Number(packageGrams),
        tags,
      }),
    onSuccess: async (created) => {
      await refresh();
      navigate(`/packages/${created.id}`);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addTag = (value: string) => {
    const next = value.trim();
    if (!next || tags.includes(next)) {
      return;
    }
    setTags((current) => [...current, next]);
    setScan('');
  };

  return (
    <Card>
      <CardContent>
        {!kinds.has('wet_weight') ? (
          <WeightAction
            testId="wet-weight"
            buttonId="record-wet-weight"
            label="Wet weight (g)"
            grams={grams}
            onGrams={setGrams}
            onSubmit={() => send.mutate('wet')}
            pending={send.isPending}
            button="Record wet weight"
          />
        ) : null}
        {kinds.has('wet_weight') && !kinds.has('drying') ? (
          <Button data-testid="start-drying" variant="contained" onClick={() => send.mutate('drying')} disabled={send.isPending}>
            Start drying
          </Button>
        ) : null}
        {kinds.has('drying') && !kinds.has('dry_weight') ? (
          <WeightAction
            testId="dry-weight"
            buttonId="record-dry-weight"
            label="Dry weight (g)"
            grams={grams}
            onGrams={setGrams}
            onSubmit={() => send.mutate('dry')}
            pending={send.isPending}
            button="Record dry weight"
          />
        ) : null}
        {kinds.has('dry_weight') && !kinds.has('trimming') ? (
          <Button data-testid="record-trimming" variant="contained" onClick={() => send.mutate('trim')} disabled={send.isPending}>
            Record trimming
          </Button>
        ) : null}
        {kinds.has('trimming') ? (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Waste note" value={note} onChange={(event) => setNote(event.target.value)} inputProps={{ 'data-testid': 'waste-note' }} />
            <WeightAction
              testId="waste-weight"
              buttonId="record-waste"
              label="Waste (g)"
              grams={grams}
              onGrams={setGrams}
              onSubmit={() => send.mutate('waste')}
              pending={send.isPending}
              button="Record waste"
            />
            <Typography sx={{ fontWeight: 600 }}>Package</Typography>
            <TextField
              label="Package weight (g)"
              type="number"
              value={packageGrams}
              onChange={(event) => setPackageGrams(event.target.value)}
              inputProps={{ 'data-testid': 'package-weight-input' }}
            />
            <Box
              component="input"
              data-testid="package-label"
              aria-label="Package tag"
              value={label}
              autoComplete="off"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
              sx={{ font: 'inherit', py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            />
            <Box
              component="input"
              data-testid="scan-source-tag"
              aria-label="Scan a source tag"
              value={scan}
              autoComplete="off"
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag(scan);
                }
              }}
              sx={{ font: 'inherit', py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button data-testid="include-harvested-tags" onClick={() => setTags(harvest.plants.map((plant) => plant.tag))}>
                Include harvested tags
              </Button>
              <Button
                data-testid="create-package"
                variant="contained"
                onClick={() => createPackage.mutate()}
                disabled={createPackage.isPending || tags.length === 0 || label.trim().length === 0 || Number(packageGrams) <= 0}
              >
                Create package
              </Button>
            </Box>
            <Typography data-testid="selected-tag-count">{tags.length} source tags selected</Typography>
          </Box>
        ) : null}
        {message ? (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="harvest-message">
            {message}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeightAction({
  testId,
  buttonId,
  label,
  grams,
  onGrams,
  onSubmit,
  pending,
  button,
}: {
  testId: string;
  buttonId: string;
  label: string;
  grams: string;
  onGrams: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  button: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        label={label}
        type="number"
        value={grams}
        onChange={(event) => onGrams(event.target.value)}
        inputProps={{ 'data-testid': testId }}
      />
      <Button data-testid={buttonId} variant="contained" onClick={onSubmit} disabled={pending}>
        {button}
      </Button>
    </Box>
  );
}
