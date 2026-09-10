import { config } from "../config.js";
import { runTool } from "../clients/composio.js";
import { readLogRows } from "../clients/googleSheets.js";

export function slugify(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseHeatItems(blob) {
  const items = [];
  for (const raw of String(blob || "").split(/\n+/)) {
    const line = raw.trim().replace(/^[\u2022\-*]\s*/, "");
    if (line.length < 12) continue;
    const low = line.toLowerCase();
    if (["history note", "emerging", "keep eyes"].some((s) => low.includes(s))) continue;
    let m = line.match(/([A-Za-z0-9$][A-Za-z0-9$ .'xX]{1,40})\s+(?:dropped|dumped|out with|surprise-dropped)\s+\*?([^*\u2014\-]+)/i);
    if (!m) m = line.match(/([A-Za-z0-9$][A-Za-z0-9$ .'xX]{1,40})\s+\*([^*]+)\*/);
    if (!m) continue;
    const artist = m[1].trim().replace(/[- ]+$/, "");
    const title = m[2].split(/\s+[\u2014\-(]/)[0].trim().replace(/[ *.]+$/, "");
    if (artist.length < 2 || title.length < 2) continue;
    items.push({ artist, title, line });
  }
  return items;
}

async function heatText() {
  const raw = await runTool("DISCORDBOT_LIST_MESSAGES", { channel_id: config.heatChannelId, limit: 15 });
  const msgs = raw.messages || raw.data?.messages || [];
  return msgs.flatMap((m) => (m.embeds || []).map((e) => e.description || "")).filter(Boolean).join("\n");
}

export async function loadUsedSlugs() {
  const used = new Set(config.usedSeed.map(slugify));
  try {
    const rows = await readLogRows();
    for (const row of rows) {
      if (row.slug) used.add(slugify(row.slug));
      if (row.artist) used.add(slugify(row.artist));
      if (row.title) used.add(slugify(row.artist + row.title));
    }
  } catch (err) {
    console.log("sheet used load:", err.message);
  }
  return used;
}

export async function selectArticle() {
  const used = await loadUsedSlugs();
  const items = parseHeatItems(await heatText());
  for (const item of items) {
    const key = slugify(item.artist + item.title);
    const lineKey = slugify(item.line);
    if ([...used].some((s) => key.includes(s) || lineKey.includes(s))) continue;
    return { item, slug: key, used };
  }
  return { item: null, slug: null, used };
}
