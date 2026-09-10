import { config } from "../config.js";
import { runTool } from "../clients/composio.js";
import { imageSearch } from "../clients/googleSearch.js";

function looksReal(url) {
  if (!url) return false;
  const low = url.toLowerCase();
  if (low.includes("generated") || low.includes("midjourney") || low.includes("openai")) return false;
  return /^https?:\/\//.test(url);
}

async function pinterestPhoto(query) {
  try {
    const raw = await runTool("PINTEREST_SEARCH_PINS", { query, board_id: config.pinterestBoardId });
    const pins = raw.items || raw.pins || raw.data?.items || [];
    for (const pin of pins) {
      const url = pin.image_url || pin.imageUrl || pin.media?.url || pin.url;
      if (looksReal(url)) return { ok: true, url, source: "pinterest" };
    }
  } catch (err) {
    console.log("pinterest photo:", err.message);
  }
  return null;
}

export async function getPhoto(item) {
  const q = `${item.artist} ${item.title} album cover`;
  const pin = await pinterestPhoto(q);
  if (pin) return pin;
  const hits = await imageSearch(q);
  const url = hits.find(looksReal);
  if (url) return { ok: true, url, source: "google" };
  return { ok: false, url: "", source: "" };
}
