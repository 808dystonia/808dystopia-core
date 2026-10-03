// Writes the morning/midday/night news slots into the Netlify Blobs store
// that 808dystopia.win's own "/api/news" serverless function reads from
// (site/netlify/functions/news.mjs) — this is how content lands on the
// site without ever redeploying it. Written from outside Netlify's own
// runtime (a GitHub Actions job), so the store needs an explicit siteID +
// access token rather than the auto-provisioned config a Netlify Function
// itself gets for free.
import { getStore } from "@netlify/blobs";
import { config } from "../config.js";

export async function writeNewsSlot(slot, stories) {
  if (!config.siteSyncPublish) {
    return { synced: false, note: "SITE_SYNC_PUBLISH is off — dry run, site not updated." };
  }

  if (!config.netlify.token) throw new Error("NETLIFY_AUTH_TOKEN missing");

  const store = getStore({
    name: "news",
    siteID: config.netlify.siteId,
    token: config.netlify.token,
  });

  await store.setJSON(slot, { stories, postedAt: new Date().toISOString() });
  return { synced: true, note: `Wrote ${stories.length} stories to the "${slot}" slot.` };
}
