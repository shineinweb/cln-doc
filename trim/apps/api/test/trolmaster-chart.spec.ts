import { parseTrolmasterHistory } from '../src/adapters/trolmaster-client';

describe('Trolmaster history parser', () => {
  it('reads named series and a wide EC and VWC table', () => {
    const named = parseTrolmasterHistory({
      series: [
        {
          name: 'EC PW',
          unit: 'dS/m',
          points: [
            { at: '2026-10-02T14:18:00.000Z', value: 4.1 },
            { at: '2026-10-02T15:18:00.000Z', value: 4.31 },
          ],
        },
        {
          name: 'VWC 1',
          unit: '%',
          points: [{ time: '2026-10-02T15:18:00.000Z', value: 21.6 }],
        },
      ],
    });
    expect(named.map((series) => [series.name, series.metric, series.points.at(-1)?.value])).toEqual([
      ['EC PW', 'ec', 4.31],
      ['VWC 1', 'vwc', 21.6],
    ]);

    const wide = parseTrolmasterHistory([
      { at: '2026-10-02T14:18:00.000Z', ec: 4.1, vwc: 20 },
      { at: '2026-10-02T15:18:00.000Z', ec: 4.31, vwc: 21.6 },
    ]);
    expect(wide.map((series) => series.metric).sort()).toEqual(['ec', 'vwc']);
  });

  it('reads temperature, humidity, CO2, VPD, and light', () => {
    const history = parseTrolmasterHistory({
      series: [
        { name: 'Temp', unit: '°F', points: [{ at: '2026-10-03T14:00:00.000Z', value: 80.1 }] },
        { name: 'Humid', unit: '%', points: [{ at: '2026-10-03T14:00:00.000Z', value: 61.2 }] },
        { name: 'CO2', unit: 'PPM', points: [{ at: '2026-10-03T14:00:00.000Z', value: 0 }] },
        { name: 'VPD', unit: 'kPa', points: [{ at: '2026-10-03T14:00:00.000Z', value: 2.56 }] },
        { name: 'Light', unit: 'PPFD', points: [{ at: '2026-10-03T14:00:00.000Z', value: 0 }] },
      ],
    });
    expect(history.map((series) => series.metric)).toEqual(['temp', 'humid', 'co2', 'vpd', 'light']);
  });
});
