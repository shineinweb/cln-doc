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
});
