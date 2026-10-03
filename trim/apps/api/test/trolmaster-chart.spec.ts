import { parseTrolmasterHistory, trolmasterDeviceMessage } from '../src/adapters/trolmaster-client';

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

  it('reads a Hydro-X history table and names a controller from the device list', () => {
    const history = parseTrolmasterHistory([
      { ct_tm: '2026-10-03T14:00:00.000Z', tp: 78.2, hy: 55.1, co2: 840, vpd: 1.2, lp: 400 },
      { ct_tm: '2026-10-03T15:00:00.000Z', tp: 79.4, hy: 54.2, co2: 860, vpd: 1.3, lp: 420 },
    ]);
    expect(history.map((series) => [series.name, series.metric, series.points.at(-1)?.value])).toEqual([
      ['Temp', 'temp', 79.4],
      ['Humid', 'humid', 54.2],
      ['CO2', 'co2', 860],
      ['VPD', 'vpd', 1.3],
      ['Light', 'light', 420],
    ]);

    const devices = {
      Items: [
        { mac: '049162B90D39F69D', model: 'Hydro-X' },
        { mac: '801F12F1B20CAA37', model: 'Aqua-X' },
      ],
    };
    expect(trolmasterDeviceMessage('049162b90d39f69d', devices)).toBe(
      'Trolmaster accepted the credential for Hydro-X 049162B90D39F69D. No history points were returned.',
    );
    expect(trolmasterDeviceMessage('missing', devices)).toBe('That controller is not on this Trolmaster credential.');
    expect(trolmasterDeviceMessage('049162B90D39F69D', { series: [] })).toBeNull();
  });
});
