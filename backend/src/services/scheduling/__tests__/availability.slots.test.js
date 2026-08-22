import { describe, expect, it } from 'vitest';
import { generateAvailableSlots } from '../availability.slots.js';

describe('generateAvailableSlots', () => {
  const base = {
    timezone: 'America/Sao_Paulo',
    from: '2026-08-19T00:00:00-03:00',
    to: '2026-08-19T23:59:59-03:00',
    durationMinutes: 30,
    minimumNoticeMinutes: 0,
    now: new Date('2026-08-18T12:00:00.000Z'),
    rules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '12:00' }], // Wed
  };

  it('skips slots that overlap busy 10-11', () => {
    const slots = generateAvailableSlots({
      ...base,
      busy: [
        {
          start: new Date('2026-08-19T13:00:00.000Z'), // 10:00 -03
          end: new Date('2026-08-19T14:00:00.000Z'), // 11:00 -03
        },
      ],
    });

    const starts = slots.map((s) => s.start);
    expect(starts).toContain('2026-08-19T09:00:00.000-03:00');
    expect(starts).toContain('2026-08-19T09:30:00.000-03:00');
    expect(starts).toContain('2026-08-19T11:00:00.000-03:00');
    expect(starts).toContain('2026-08-19T11:30:00.000-03:00');
    expect(starts).not.toContain('2026-08-19T10:00:00.000-03:00');
    expect(starts).not.toContain('2026-08-19T10:30:00.000-03:00');
  });

  it('rejects partial overlap into busy interval', () => {
    const slots = generateAvailableSlots({
      ...base,
      durationMinutes: 30,
      busy: [
        {
          start: new Date('2026-08-19T13:15:00.000Z'), // 10:15
          end: new Date('2026-08-19T13:45:00.000Z'),
        },
      ],
    });
    const starts = slots.map((s) => s.start);
    expect(starts).not.toContain('2026-08-19T10:00:00.000-03:00');
    expect(starts).not.toContain('2026-08-19T10:30:00.000-03:00');
  });

  it('applies buffer before/after around busy', () => {
    const slots = generateAvailableSlots({
      ...base,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      busy: [
        {
          start: new Date('2026-08-19T13:00:00.000Z'),
          end: new Date('2026-08-19T14:00:00.000Z'),
        },
      ],
    });
    const starts = slots.map((s) => s.start);
    // 09:45 would need buffer into busy start; 11:00 needs 15m after busy → 11:15
    expect(starts).not.toContain('2026-08-19T09:45:00.000-03:00');
    expect(starts).not.toContain('2026-08-19T11:00:00.000-03:00');
    expect(starts).toContain('2026-08-19T11:30:00.000-03:00');
  });

  it('respects timezone America/Sao_Paulo offsets in output', () => {
    const slots = generateAvailableSlots({
      ...base,
      busy: [],
    });
    expect(slots[0].start.endsWith('-03:00')).toBe(true);
  });
});
