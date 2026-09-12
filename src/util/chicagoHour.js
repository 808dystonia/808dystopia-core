// Shared by both pipelines' cron entry points: returns the current hour
// (0-23) in America/Chicago, backed by the IANA tz database via Intl —
// tracks DST transitions correctly with no manual offset math. Each
// entry point (src/cron.js, src/reel-cron.js) gates its own hourly
// GitHub Actions schedule down to its own target hour with this.
export function currentChicagoHour() {
  const hourString = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hourString);
}

// en-CA is just a convenient locale that happens to format as YYYY-MM-DD.
// Shared by any pipeline that needs to compare "which Chicago calendar day
// is this timestamp from" (e.g. the EOD brief's analytics window, morning
// sync's "did today's drop already land" check).
export function chicagoDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(date);
}

// Current day of week in America/Chicago, e.g. "Tuesday" -- for pipelines
// gated to a specific weekday (Trending Tuesdays) rather than just an
// hour, on top of the same hourly-firing GitHub Actions schedule.
export function currentChicagoWeekday() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(new Date());
}
