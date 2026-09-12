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
    // Grok's own webhook identity in #underground-news -- confirmed live
    // by comparing message authors: Grok's daily posts always come
    // through this author id (display name varies -- "DT NEWS BOT", "DT
    // Bot", "808 Dystonia" have all been seen), while this repo's own
    // posts (News Brief, carousel) come through the shared Composio bot
    // account instead. morning-sync uses this to find Grok's actual
    // morning drop and never mistake one of our own posts for it.
    grokAuthorId: process.env.DISCORD_GROK_AUTHOR_ID || "1545433897074950264",
    // #admin-general in the 808 Dystopia Discord ("FRZA + STOKELY only.
    // EOD briefs, ops, connector tests.") -- found directly via a live
    // Composio call (DISCORDBOT_LIST_GUILD_CHANNELS) rather than asked
    // for, since its own channel topic confirmed it's exactly the
    // intended target.
    adminChannelId: process.env.DISCORD_ADMIN_CHANNEL_ID || "1542355862079807509",
    connectedAccountId: process.env.COMPOSIO_DISCORD_ACCOUNT_ID || "",
  },

  instagram: {
    userId: process.env.IG_USER_ID || "",
    connectedAccountId: process.env.COMPOSIO_INSTAGRAM_ACCOUNT_ID || "",
  },

  pinterest: {
    connectedAccountId: process.env.COMPOSIO_PINTEREST_ACCOUNT_ID || "",
    // "Underground Hiphop album cover art" board on the connected 808
    // Dystopia Pinterest account -- found directly via a live
    // PINTEREST_LIST_BOARDS call rather than asked for.
    boardId: process.env.PINTEREST_BOARD_ID || "1099230290240885517",
  },

  sheets: {
    id: process.env.GOOGLE_SHEETS_ID || "",
    tab: process.env.GOOGLE_SHEETS_TAB || "News",
    // Reel dedup log lives in a separate tab of the same spreadsheet.
    reelsTab: process.env.GOOGLE_SHEETS_REELS_TAB || "Reels",
    // Pin pipeline's own dedup log, same spreadsheet, its own tab.
    pinsTab: process.env.GOOGLE_SHEETS_PINS_TAB || "Pins",
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

  // GitHub REST API — source of the EOD brief's "accomplishments" section
  // (merged PRs for the day). In CI, GITHUB_TOKEN is automatically
  // provided by the workflow itself (no secret to set up); for local
  // testing, a personal access token with repo read access works too.
  github: {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "808dystonia/808dystopia-core",
  },

  // Site sync — mirrors morning/midday/night news onto 808dystopia.win's
  // three news boxes via a Netlify Blobs store the site's own serverless
  // function reads from. Blobs written from outside Netlify's own runtime
  // (this repo's GitHub Actions jobs) need an explicit siteID + access
  // token — see .env.example for how to generate the token.
  netlify: {
    siteId: process.env.NETLIFY_SITE_ID || "f809ce21-5a80-4332-83df-3cf7a5752c30",
    token: process.env.NETLIFY_AUTH_TOKEN || "",
  },

  hashtags: [],

  // Gate on live IG publishing. Stays off until this pipeline is actually built and tested.
  publish: process.env.CAROUSEL_PUBLISH === "1",
  // Same gate, for the Reel pipeline — independent so one pipeline can go
  // live while the other stays in dry-run.
  reelPublish: process.env.REEL_PUBLISH === "1",
  // Same gate, for the EOD brief -- lower-stakes than the other two (it
  // posts to a private admin channel, not a public account) but kept
  // consistent with the project's posture of nothing posting until
  // tested.
  eodBriefPublish: process.env.EOD_BRIEF_PUBLISH === "1",
  // Same gate, for the 12 PM/6 PM news brief.
  newsBriefPublish: process.env.NEWS_BRIEF_PUBLISH === "1",
  // Same gate, for writing morning/midday/night news onto 808dystopia.win.
  siteSyncPublish: process.env.SITE_SYNC_PUBLISH === "1",
  // Same gate, for the 9 AM/1 PM/5 PM Pinterest album-art pins.
  pinPublish: process.env.PIN_PUBLISH === "1",

  canvas: { w: 1080, h: 1350 },
};
