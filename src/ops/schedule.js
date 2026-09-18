// Dependency-free: also runs before npm ci in Actions.
export const PIPELINES = {
  'weekly-performance': { hours: [10], weekday: 'Monday', minute: 43, monitor: false },
  carousel: { hours: [9, 12], minute: 17, module: '../pipeline/index.js', entry: 'runDailyFlow' },
  reel: { hours: [10, 12, 14, 16, 19], minute: 23, module: '../reels/index.js', entry: 'runDailyReelFlow' },
  pin: { hours: [9, 13, 17], minute: 29, module: '../pin-post/index.js', entry: 'runPinPost' },
  'news-brief': { hours: [12, 18], minute: 7, module: '../news-brief/index.js', entry: 'runNewsBrief' },
  'eod-brief': { hours: [21], minute: 37, module: '../eod-brief/index.js', entry: 'runEodBrief' },
  'morning-sync': { hours: [10], minute: 13, module: '../morning-sync/index.js', entry: 'runMorningSync' },
  'trending-tuesday': { hours: [17], weekday: 'Tuesday', minute: 31, module: '../trending/index.js', entry: 'runTrendingTuesday' },
};
export function chicagoParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
  }).formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday };
}
export function scheduleDecision(name, date = new Date(), event = process.env.GITHUB_EVENT_NAME) {
  const spec = PIPELINES[name];
  if (!spec) throw new Error(`Unknown pipeline: ${name}`);
  const p = chicagoParts(date);
  const due = spec.hours.includes(p.hour) && (!spec.weekday || spec.weekday === p.weekday);
  return { due: event !== 'schedule' || due, slot: `${p.date}T${String(p.hour).padStart(2, '0')}`, ...p };
}
// Legacy Sheets rows contain Chicago wall time with no offset. Resolve
// through IANA rules rather than assuming daylight time all year.
export function parseTimestamp(value) {
  if (typeof value !== 'string' || !value) return NaN;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return Date.parse(value);
  const m = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const wall = Date.parse(`${m[1]}T${m[2].padStart(2,'0')}:${m[3]}:${m[4]}Z`);
  for (const offset of [5, 6]) {
    const ms = wall + offset * 3600000;
    const p = chicagoParts(new Date(ms));
    if (p.date === m[1] && p.hour === Number(m[2]) && p.minute === Number(m[3])) return ms;
  }
  return NaN; // Nonexistent spring-forward time. Ambiguous fall time uses first occurrence.
}
