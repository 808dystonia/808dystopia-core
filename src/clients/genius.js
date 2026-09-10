const API = "https://api.genius.com";

function authHeaders() {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) throw new Error("GENIUS_ACCESS_TOKEN missing");
  return { Authorization: `Bearer ${token}` };
}

export async function searchGenius(q) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  return json?.response?.hits || [];
}

export async function getGeniusSong(id) {
  const res = await fetch(`${API}/songs/${id}?text_format=plain`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  return json?.response?.song || null;
}

export function parseTracklistFromDescription(desc) {
  const text = desc || "";
  const lines = text.split(/\n+/);
  const tracks = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d{1,2})[.)]\s+(.+)$/);
    if (!m) continue;
    const raw = m[2].trim();
    const feat = raw.match(/\((?:feat\.?|ft\.?)\s*([^)]+)\)/i);
    tracks.push({
      name: raw.replace(/\((?:feat\.?|ft\.?)\s*[^)]+\)/i, "").trim(),
      feat: feat ? feat[1].trim() : "",
    });
  }
  return tracks;
}
