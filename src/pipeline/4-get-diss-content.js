import { searchGenius, getGeniusSong, parseTracklistFromDescription } from "../clients/genius.js";

function scoreHit(hit, artist, title) {
  const result = hit.result || {};
  const a = String(result.primary_artist?.name || "").toLowerCase();
  const t = String(result.title || "").toLowerCase();
  let n = 0;
  if (a.includes(artist.toLowerCase()) || artist.toLowerCase().includes(a)) n += 2;
  if (t.includes(title.toLowerCase()) || title.toLowerCase().includes(t)) n += 2;
  return n;
}

export async function getGeniusContent(item, type) {
  const hits = await searchGenius(`${item.artist} ${item.title}`);
  const ranked = hits.map((hit) => ({ hit, score: scoreHit(hit, item.artist, item.title) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 2) return { ok: false, confidence: 0, tracks: [], quote: "", source: "", verified: false };
  const song = await getGeniusSong(best.hit.result.id);
  const desc = song?.description?.plain || song?.description || "";
  const lyrics = song?.lyrics || "";
  const tracks = parseTracklistFromDescription(desc);
  const quoteLine = String(lyrics || desc).split(/\n/).map((s) => s.trim()).find((s) => s.length > 12 && s.length < 90) || "";
  const confidence = Math.min(1, best.score / 4);
  return { ok: true, confidence, verified: tracks.length >= 2 && confidence >= 0.5, tracks, quote: type === "diss" ? quoteLine : "", source: song?.url || "Genius", song };
}
