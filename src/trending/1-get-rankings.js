// Step 1: this week's top 10 trending underground rappers, ranked by the
// listener figure already present in the #tv board's own text (see
// clients/discord.js's parseTvRapperStreams for why this never invents a
// number). A rapper only makes the chart if their line actually carries
// one -- no figure, no ranking, never an estimate.
import { listReelsChannelMessages, parseTvRapperStreams } from "../clients/discord.js";

const CHART_SIZE = 10;

export async function getTopTen() {
  const messages = await listReelsChannelMessages();
  const entries = parseTvRapperStreams(messages);

  // The board can list the same rapper more than once across sections;
  // keep the first (highest, since entries are read in the board's own
  // top-to-bottom order) occurrence for each name.
  const seen = new Map(); // lowercase -> entry
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry);
  }

  return [...seen.values()].sort((a, b) => b.streamsValue - a.streamsValue).slice(0, CHART_SIZE);
}
