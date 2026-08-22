import { DateTime, Interval } from 'luxon';

/**
 * Gera slots locais a partir de regras + busy intervals (testável, sem Google).
 *
 * @param {object} params
 * @param {Array<{dayOfWeek:number,startTime:string,endTime:string}>} params.rules
 * @param {string} params.timezone IANA
 * @param {string|Date} params.from inclusive
 * @param {string|Date} params.to exclusive/end of window
 * @param {number} params.durationMinutes
 * @param {number} [params.bufferBeforeMinutes]
 * @param {number} [params.bufferAfterMinutes]
 * @param {number} [params.minimumNoticeMinutes]
 * @param {Array<{start:Date|string,end:Date|string}>} [params.busy]
 * @param {Date} [params.now]
 */
export function generateAvailableSlots({
  rules,
  timezone,
  from,
  to,
  durationMinutes,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0,
  minimumNoticeMinutes = 0,
  busy = [],
  now = new Date(),
}) {
  const zone = timezone || 'America/Sao_Paulo';
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const windowStart = DateTime.fromJSDate(new Date(from), { zone }).startOf('day');
  const windowEnd = DateTime.fromJSDate(new Date(to), { zone }).endOf('day');
  const earliest = DateTime.fromJSDate(new Date(now), { zone }).plus({
    minutes: Number(minimumNoticeMinutes) || 0,
  });

  const busyIntervals = (busy || [])
    .map((b) => {
      const start = DateTime.fromJSDate(new Date(b.start), { zone: 'utc' }).setZone(zone);
      const end = DateTime.fromJSDate(new Date(b.end), { zone: 'utc' }).setZone(zone);
      if (!start.isValid || !end.isValid || end <= start) return null;
      return Interval.fromDateTimes(start, end);
    })
    .filter(Boolean);

  const rulesByDay = new Map();
  for (const rule of rules || []) {
    const day = Number(rule.dayOfWeek);
    if (!rulesByDay.has(day)) rulesByDay.set(day, []);
    rulesByDay.get(day).push(rule);
  }

  const slots = [];
  let cursor = windowStart;

  while (cursor <= windowEnd) {
    // luxon: Mon=1..Sun=7 → JS: Sun=0..Sat=6
    const jsDow = cursor.weekday === 7 ? 0 : cursor.weekday;
    const dayList = rulesByDay.get(jsDow) || [];

    for (const rule of dayList) {
      const [sh, sm] = String(rule.startTime).slice(0, 5).split(':').map(Number);
      const [eh, em] = String(rule.endTime).slice(0, 5).split(':').map(Number);
      let slotStart = cursor.set({
        hour: sh,
        minute: sm || 0,
        second: 0,
        millisecond: 0,
      });
      const dayEnd = cursor.set({
        hour: eh,
        minute: em || 0,
        second: 0,
        millisecond: 0,
      });

      while (slotStart.plus({ minutes: duration }) <= dayEnd) {
        const slotEnd = slotStart.plus({ minutes: duration });
        if (slotStart >= earliest) {
          const candidate = Interval.fromDateTimes(
            slotStart.minus({ minutes: Number(bufferBeforeMinutes) || 0 }),
            slotEnd.plus({ minutes: Number(bufferAfterMinutes) || 0 })
          );
          const overlaps = busyIntervals.some((b) => b.overlaps(candidate));
          if (!overlaps) {
            slots.push({
              start: slotStart.toISO({ includeOffset: true }),
              end: slotEnd.toISO({ includeOffset: true }),
            });
          }
        }
        slotStart = slotStart.plus({ minutes: duration });
      }
    }

    cursor = cursor.plus({ days: 1 }).startOf('day');
  }

  return slots;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}
