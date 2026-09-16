// A bare `fetch()` failure's own message is just "fetch failed" -- the
// actual reason (DNS lookup failure, connection refused, timeout) lives
// on err.cause, which plain `err.message` logging drops on the floor.
// Confirmed the hard way (2026-09-16): a whole Reel run's worth of
// candidates all failed with the identical opaque "fetch failed", with no
// way to tell whether that was one specific host down or a broader runner
// network problem without re-running with better logging first.
export function describeError(err) {
  return err?.cause ? `${err.message} (${err.cause})` : err?.message;
}
