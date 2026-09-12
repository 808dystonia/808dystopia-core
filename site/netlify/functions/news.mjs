// Serves the morning/midday/night news the 808dystopia-core repo's
// automations write into this store, at /api/news. Running as a Netlify
// Function gives it automatic access to the site's own Blobs config --
// no siteID/token needed here (only external writers, like a GitHub
// Actions job, need those explicitly).
import { getStore } from "@netlify/blobs";

const SLOTS = ["morning", "midday", "night"];

export default async () => {
  const store = getStore("news");
  const data = {};
  for (const slot of SLOTS) {
    data[slot] = await store.get(slot, { type: "json" });
  }
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
    },
  });
};

export const config = {
  path: "/api/news",
};
