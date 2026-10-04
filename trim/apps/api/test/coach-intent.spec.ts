import {
  detectIntent,
  extractRoomTokens,
  parseDefoliationRemoval,
  resolveRooms,
} from '../src/coach/coach.service';

describe('coach intent parsers', () => {
  it('detects a defoliation removal proposal', () => {
    expect(detectIntent('Remove day 10 defoliation from F1–F4')).toBe('propose_schedule_update');
    expect(parseDefoliationRemoval('Please update F1, F2, F3, and F4 to remove Day 10 Defoliation')).toEqual({
      dayNumber: 10,
      roomTokens: expect.arrayContaining(['F1', 'F2', 'F3', 'F4']),
    });
  });

  it('detects confirm when history staged a schedule change', () => {
    const history = [
      {
        role: 'user' as const,
        content: 'Remove day 10 defoliation from F1-F4',
      },
      {
        role: 'assistant' as const,
        content: 'I can remove day 10 defoliation from F1, F2, F3, F4. Reply confirm or YES to apply.',
      },
    ];
    expect(detectIntent('YES', history)).toBe('confirm_schedule_update');
    expect(detectIntent('confirm', history)).toBe('confirm_schedule_update');
  });

  it('expands room ranges and resolves codes', () => {
    expect(extractRoomTokens('from F1–F4')).toEqual(['F1', 'F2', 'F3', 'F4']);
    const rooms = [
      { id: '1', name: 'Flower 1', code: 'F1' },
      { id: '2', name: 'Flower 2', code: 'F2' },
      { id: '3', name: 'Flower 3', code: 'F3' },
    ];
    expect(resolveRooms(rooms, ['F1', 'F3']).map((room) => room.code)).toEqual(['F1', 'F3']);
  });
});
