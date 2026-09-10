// Google Custom Search JSON API (free tier) — fallback image search when Pinterest misses.
import { config } from "../config.js";

export async function imageSearch(query) {
  const { cseId, apiKey } = config.googleSearch;
  if (!cseId || !apiKey) throw new Error("GOOGLE_CSE_ID/GOOGLE_CSE_KEY missing");

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("q", query);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "5");
  url.searchParams.set("safe", "active");

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(`google cse ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  return (json.items || []).map((item) => item.link);
}
