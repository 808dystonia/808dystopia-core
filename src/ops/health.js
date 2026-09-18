import { PIPELINES, chicagoParts, parseTimestamp } from './schedule.js';
export function missingSlots(states, { now = new Date(), activatedAt, graceMinutes = 90 } = {}) {
  const issues = [];
  const since = Math.max(now.getTime() - 24 * 3600000, Date.parse(activatedAt));
  if (!Number.isFinite(since)) throw new Error('Monitor activation time is required');
  for (const [name, spec] of Object.entries(PIPELINES)) {
    if (spec.monitor === false) continue;
    // Iterate actual hours, not fixed local-day lengths (DST-safe).
    for (let ms = Math.floor(since / 3600000) * 3600000; ms <= now.getTime(); ms += 3600000) {
      const p = chicagoParts(new Date(ms));
      if (!spec.hours.includes(p.hour) || (spec.weekday && spec.weekday !== p.weekday)) continue;
      const slot = `${p.date}T${String(p.hour).padStart(2,'0')}`;
      const due = parseTimestamp(`${slot}:${String(spec.minute).padStart(2,'0')}:00`);
      if (due < since || now.getTime() - due < graceMinutes * 60000) continue;
      const record = states[name]?.slots?.[slot];
      if (record?.status !== 'posted') issues.push({ pipeline: name, slot, status: record?.status || 'missing' });
    }
  }
  return issues;
}
