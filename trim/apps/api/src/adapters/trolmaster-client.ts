export const TROLMASTER_API_BASE = 'https://api.trolmaster.com';

const MAX_SERIES = 40;
const MAX_POINTS = 360;

export type TrolmasterMetric = 'temp' | 'humid' | 'co2' | 'vpd' | 'light' | 'ec' | 'vwc' | 'other';

export interface TrolmasterPoint {
  at: string;
  value: number;
}

export interface TrolmasterSeriesDraft {
  name: string;
  metric: TrolmasterMetric;
  unit: string;
  points: TrolmasterPoint[];
}

export async function fetchTrolmasterHistory(input: {
  apiKey: string;
  controllerId: string;
  start: string;
  end: string;
}): Promise<unknown> {
  const base = (process.env.TROLMASTER_API_BASE ?? TROLMASTER_API_BASE).replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
      },
      body: JSON.stringify({
        controllerId: input.controllerId,
        start: input.start,
        end: input.end,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('Trolmaster did not return a chart.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Trolmaster refused the API credential.');
  }
  if (!response.ok) {
    throw new Error('Trolmaster did not return a chart.');
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Trolmaster did not return a chart.');
  }
}

export function parseTrolmasterHistory(payload: unknown): TrolmasterSeriesDraft[] {
  const found: TrolmasterSeriesDraft[] = [];
  walk(payload, found, 0);
  return found
    .filter((series) => series.points.length > 0)
    .slice(0, MAX_SERIES)
    .map((series) => ({ ...series, points: downsample(series.points) }));
}

function walk(value: unknown, found: TrolmasterSeriesDraft[], depth: number): void {
  if (depth > 6 || found.length >= MAX_SERIES || value == null) {
    return;
  }
  if (Array.isArray(value)) {
    const wide = seriesFromWideRows(value);
    if (wide.length > 0) {
      found.push(...wide);
      return;
    }
    const grouped = seriesFromSensorRows(value);
    if (grouped.length > 0) {
      found.push(...grouped);
      return;
    }
    for (const item of value) {
      walk(item, found, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const points = pointsFrom(value.points ?? value.values ?? value.history ?? value.data);
  if (points.length > 0 && hasSeriesName(value)) {
    found.push({
      name: seriesName(value),
      metric: classify(seriesName(value), unitOf(value)),
      unit: unitOf(value) || defaultUnit(classify(seriesName(value), unitOf(value))),
      points,
    });
    return;
  }
  for (const nested of Object.values(value)) {
    walk(nested, found, depth + 1);
  }
}

function seriesFromWideRows(rows: unknown[]): TrolmasterSeriesDraft[] {
  const records = rows.filter(isRecord);
  if (records.length < 2 || records.length !== rows.length) {
    return [];
  }
  const timeKey = timeKeyOf(records[0]);
  if (!timeKey || records.some((row) => ['name', 'sensor', 'label', 'channel'].some((key) => typeof row[key] === 'string'))) {
    return [];
  }
  const numericKeys = Object.keys(records[0]).filter((key) => key !== timeKey && records.every((row) => typeof row[key] === 'number'));
  if (numericKeys.length === 0) {
    return [];
  }
  return numericKeys.map((key) => {
    const metric = classify(key, '');
    return {
      name: labelFromKey(key),
      metric,
      unit: defaultUnit(metric),
      points: records.flatMap((row) => {
        const at = timeValue(row[timeKey]);
        const value = row[key];
        return at && typeof value === 'number' && Number.isFinite(value) ? [{ at, value }] : [];
      }),
    };
  });
}

function seriesFromSensorRows(rows: unknown[]): TrolmasterSeriesDraft[] {
  const records = rows.filter(isRecord);
  if (records.length < 2 || records.length !== rows.length) {
    return [];
  }
  const groups = new Map<string, TrolmasterPoint[]>();
  const units = new Map<string, string>();
  for (const row of records) {
    const name = sensorName(row);
    const at = firstTime(row);
    const value = firstNumber(row, ['value', 'v', 'reading', 'val']);
    if (!name || !at || value == null) {
      return [];
    }
    const points = groups.get(name) ?? [];
    points.push({ at, value });
    groups.set(name, points);
    const unit = unitOf(row);
    if (unit) {
      units.set(name, unit);
    }
  }
  return [...groups.entries()].map(([name, points]) => {
    const unit = units.get(name) ?? '';
    const metric = classify(name, unit);
    return { name, metric, unit: unit || defaultUnit(metric), points };
  });
}

function pointsFrom(value: unknown): TrolmasterPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const at = firstTime(item);
    const reading = firstNumber(item, ['value', 'v', 'reading', 'val']);
    return at && reading != null ? [{ at, reading }] : [];
  }).map((point) => ({ at: point.at, value: point.reading }));
}

function hasSeriesName(value: Record<string, unknown>): boolean {
  return ['name', 'sensor', 'label', 'metric', 'channel'].some((key) => typeof value[key] === 'string' && value[key].trim() !== '');
}

function seriesName(value: Record<string, unknown>): string {
  for (const key of ['name', 'sensor', 'label', 'metric', 'channel']) {
    const name = value[key];
    if (typeof name === 'string' && name.trim()) {
      return name.trim().slice(0, 80);
    }
  }
  return 'Sensor';
}

function sensorName(row: Record<string, unknown>): string | null {
  for (const key of ['name', 'sensor', 'label', 'metric', 'channel', 'id']) {
    const name = row[key];
    if (typeof name === 'string' && name.trim()) {
      return name.trim().slice(0, 80);
    }
  }
  return null;
}

function unitOf(value: Record<string, unknown>): string {
  const unit = value.unit ?? value.units;
  return typeof unit === 'string' ? unit.trim().slice(0, 20) : '';
}

function classify(name: string, unit: string): TrolmasterMetric {
  const text = `${name} ${unit}`.toLowerCase();
  if (/ppfd|\blight\b/.test(text)) {
    return 'light';
  }
  if (/\bvpd\b|vapor pressure/.test(text)) {
    return 'vpd';
  }
  if (/\bco2\b|carbon dioxide/.test(text)) {
    return 'co2';
  }
  if (/humid|\brh\b|relative humidity/.test(text)) {
    return 'humid';
  }
  if (/temp|°f|°c|\bf\b|\bc\b/.test(text) && !/attempt/.test(text)) {
    return 'temp';
  }
  if (/\bec\b|ds\/m|ms\/cm|conductivity/.test(text)) {
    return 'ec';
  }
  if (/vwc|water content|moisture|volumetric/.test(text)) {
    return 'vwc';
  }
  return 'other';
}

function defaultUnit(metric: TrolmasterMetric): string {
  if (metric === 'temp') {
    return '°F';
  }
  if (metric === 'humid' || metric === 'vwc') {
    return '%';
  }
  if (metric === 'co2') {
    return 'PPM';
  }
  if (metric === 'vpd') {
    return 'kPa';
  }
  if (metric === 'light') {
    return 'PPFD';
  }
  if (metric === 'ec') {
    return 'dS/m';
  }
  return '';
}

function labelFromKey(key: string): string {
  const labels: Record<string, string> = {
    temp: 'Temp',
    temperature: 'Temp',
    humid: 'Humid',
    humidity: 'Humid',
    co2: 'CO2',
    vpd: 'VPD',
    light: 'Light',
    ppfd: 'Light',
    ec: 'EC',
    vwc: 'VWC',
  };
  return labels[key.toLowerCase()] ?? key.slice(0, 80);
}

function timeKeyOf(row: Record<string, unknown>): string | null {
  return ['at', 'time', 'timestamp', 't', 'recordedAt', 'date'].find((key) => timeValue(row[key])) ?? null;
}

function firstTime(row: Record<string, unknown>): string | null {
  for (const key of ['at', 'time', 'timestamp', 't', 'recordedAt', 'date']) {
    const at = timeValue(row[key]);
    if (at) {
      return at;
    }
  }
  return null;
}

function timeValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function firstNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function downsample(points: TrolmasterPoint[]): TrolmasterPoint[] {
  const ordered = [...points].sort((left, right) => left.at.localeCompare(right.at));
  if (ordered.length <= MAX_POINTS) {
    return ordered;
  }
  const step = (ordered.length - 1) / (MAX_POINTS - 1);
  const sampled: TrolmasterPoint[] = [];
  for (let index = 0; index < MAX_POINTS; index += 1) {
    sampled.push(ordered[Math.round(index * step)]);
  }
  return sampled;
}
