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
