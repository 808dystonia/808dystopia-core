// Step 1: this week's top 10 trending underground rappers. Names come from
// Grok's 808 TV board in #reels (every rapper it currently lists); the
// ranking number is each artist's real Spotify follower count from
// Spotify's API (exact-name match only -- a miss drops the artist, it is
// never estimated). The board itself stopped carrying listener figures in
// its 9/27 format, which left the 9/29 chart empty.
import { listReelsChannelMessages, parseTvRapperNames } from "../clients/discord.js";
import { getArtistProfile } from "../clients/spotify.js";

const CHART_SIZE = 10;
// Bounds Spotify lookups per run; the board lists ~15-30 rappers.
const MAX_LOOKUPS = 40;

export function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function rankByFollowers(profiles) {
  return profiles
    .filter((p) => Number.isFinite(p.followers) && p.followers > 0)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, CHART_SIZE)
    .map((p) => ({ name: p.name, streamsValue: p.followers, streamsLabel: formatCount(p.followers) }));
}

export async function getTopTen(lookup = getArtistProfile) {
  const messages = await listReelsChannelMessages();
  const names = parseTvRapperNames(messages).slice(0, MAX_LOOKUPS);
  const profiles = [];
  for (const name of names) {
    try {
      const profile = await lookup(name);
      if (profile) profiles.push({ name, followers: profile.followers });
    } catch (err) {
      console.log(`spotify lookup failed for ${name}:`, err.message);
    }
  }
  return rankByFollowers(profiles);
}
