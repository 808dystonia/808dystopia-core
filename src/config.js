// Central config. Every value comes from env — no hardcoded IDs or secrets here.
// See .env.example for the full list of credentials/IDs to gather.
export const config = {
  tz: process.env.TZ || "America/Chicago",

  discord: {
    heatChannelId: process.env.DISCORD_HEAT_CHANNEL_ID || "",
    connectedAccountId: process.env.COMPOSIO_DISCORD_ACCOUNT_ID || "",
  },

  instagram: {
    userId: process.env.IG_USER_ID || "",
  },

  pinterest: {
    connectedAccountId: process.env.COMPOSIO_PINTEREST_ACCOUNT_ID || "",
  },

  sheets: {
    id: process.env.GOOGLE_SHEETS_ID || "",
    tab: process.env.GOOGLE_SHEETS_TAB || "Sheet1",
    connectedAccountId: process.env.COMPOSIO_GOOGLESHEETS_ACCOUNT_ID || "",
  },

  composio: {
    apiKey: process.env.COMPOSIO_API_KEY || "",
    userId: process.env.COMPOSIO_USER_ID || "",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  },

  genius: {
    accessToken: process.env.GENIUS_ACCESS_TOKEN || "",
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
  },

  hashtags: [],

  // Gate on live IG publishing. Stays off until this pipeline is actually built and tested.
  publish: process.env.CAROUSEL_PUBLISH === "1",

  canvas: { w: 1080, h: 1350 },
};
