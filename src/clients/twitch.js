// Twitch Helix API — secondary video source, tried when YouTube yields
// nothing usable for an artist (see reels/2-find-video.js). Free: an App
// Access Token via the Client Credentials flow (no user login) is enough
// for public read-only endpoints like clip lookup.
//
// Unlike YouTube, Twitch has no platform-wide "search all clips for this
// keyword" endpoint — only Search Channels (channel name/description) and
// Search Categories. So this can only find clips FROM an artist's own
// Twitch channel, if they have one under a matching name — it can't
// discover clips of that artist appearing on someone else's channel the
// way a YouTube title/description search can. Lower hit rate than
// YouTube by design, which is exactly why it's the secondary source, not
// the primary.
import { config } from "../config.js";

const AUTH_URL = "https://id.twitch.tv/oauth2/token";
const API = "https://api.twitch.tv/helix";

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (!config.twitch.clientId || !config.twitch.clientSecret) {
    throw new Error("TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET missing");
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`twitch oauth ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  cachedToken = json.access_token;
  // Refresh a minute early rather than exactly at expiry.
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

async function helixGet(path, params) {
  const token = await getAppAccessToken();
  const url = `${API}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Client-Id": config.twitch.clientId },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`twitch ${path} ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json.data || [];
}

// Finds the artist's own channel by name — an exact (case-insensitive)
// match on display name or login, not a fuzzy "closest result", since a
// wrong channel means attributing someone else's clips to this artist.
export async function findChannelId(artistHandle) {
  const results = await helixGet("search/channels", { query: artistHandle, first: 5 });
  const needle = artistHandle.toLowerCase();
  const match = results.find(
    (r) => r.display_name?.toLowerCase() === needle || r.broadcaster_login?.toLowerCase() === needle
  );
  return match?.id || null;
}

// Most-viewed clips from the last ~all-time by default (Twitch's own
// ranking) — reasonable proxy for "worth featuring" without needing our
// own view-count heuristic.
export async function getClips(broadcasterId, first = 20) {
  return helixGet("clips", { broadcaster_id: broadcasterId, first: String(first) });
}
