// Central config. Every value comes from env — no hardcoded IDs or secrets here.
// See .env.example for the full list of credentials/IDs to gather.

// YOUTUBE_COOKIES is expected base64-encoded, not raw — confirmed live that
// a raw cookies.txt paste got corrupted in transit through a text editor
// and GitHub's secret box: tabs between cookie fields silently became
// non-breaking spaces, breaking exactly the session-auth cookies that made
// authenticated download work at all. Base64 is plain alphanumeric text,
// immune to that class of whitespace mangling. Falls back to using the
// value as-is if it doesn't decode to a real cookies file, so an old-style
// raw paste still works rather than silently breaking.
function decodeCookies(raw) {
  if (!raw) return "";
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("Netscape HTTP Cookie File")) return decoded;
  } catch {
    // fall through to raw
  }
  return raw;
}

export const config = {
  tz: process.env.TZ || "America/Chicago",

  discord: {
    heatChannelId: process.env.DISCORD_HEAT_CHANNEL_ID || "",
    reelsChannelId: process.env.DISCORD_REELS_CHANNEL_ID || "",
    connectedAccountId: process.env.COMPOSIO_DISCORD_ACCOUNT_ID || "",
  },

  instagram: {
    userId: process.env.IG_USER_ID || "",
    connectedAccountId: process.env.COMPOSIO_INSTAGRAM_ACCOUNT_ID || "",
  },

  pinterest: {
    connectedAccountId: process.env.COMPOSIO_PINTEREST_ACCOUNT_ID || "",
  },

  sheets: {
    id: process.env.GOOGLE_SHEETS_ID || "",
    tab: process.env.GOOGLE_SHEETS_TAB || "Sheet1",
    // Reel dedup log lives in a separate tab of the same spreadsheet.
    reelsTab: process.env.GOOGLE_SHEETS_REELS_TAB || "Reels",
    connectedAccountId: process.env.COMPOSIO_GOOGLESHEETS_ACCOUNT_ID || "",
  },

  composio: {
    apiKey: process.env.COMPOSIO_API_KEY || "",
    userId: process.env.COMPOSIO_USER_ID || "",
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  },

  genius: {
    accessToken: process.env.GENIUS_ACCESS_TOKEN || "",
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || "",
    // Netscape-format cookies.txt content from a real, logged-in Google
    // account — needed to download video/audio past YouTube's bot
    // detection on datacenter IPs (search/videos.list don't need this,
    // only actual media download in step 3+). See .env.example, and
    // decodeCookies above for why this is base64.
    cookies: decodeCookies(process.env.YOUTUBE_COOKIES),
  },

  // Secondary video source, tried when YouTube yields nothing for an
  // artist — see clients/twitch.js.
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || "",
    clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
  },

  hashtags: [],

  // Gate on live IG publishing. Stays off until this pipeline is actually built and tested.
  publish: process.env.CAROUSEL_PUBLISH === "1",
  // Same gate, for the Reel pipeline — independent so one pipeline can go
  // live while the other stays in dry-run.
  reelPublish: process.env.REEL_PUBLISH === "1",

  canvas: { w: 1080, h: 1350 },
};
