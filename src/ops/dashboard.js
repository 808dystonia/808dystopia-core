import { chicagoParts, parseTimestamp, PIPELINES } from './schedule.js';
export function buildDashboard(logs, states = {}, now = new Date()) {
  const today = chicagoParts(now).date;
  const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) - (6 - i) * 86400000).toISOString().slice(0,10));
  const pipelines = {}, weekly = { dates }, posts = [];
  for (const name of ['carousel', 'reel', 'pin']) {
    const entries = (logs[name] || []).map(row => {
      const ms = parseTimestamp(row.timestamp);
      const id = row.pinId || row.note?.match(/IG media (\d+)/)?.[1];
      return { ...row, id, ms, ctDate: Number.isFinite(ms) ? chicagoParts(new Date(ms)).date : null,
        title: row.title || row.album || row.videoId || '', outcomes: null };
    }).filter(x => Number.isFinite(x.ms));
    for (const post of Object.values(states[name]?.posts || {})) {
      if (post.status !== 'posted') continue;
      const index = entries.findIndex(x => x.id === post.id);
      const item = { ...post, ms: Date.parse(post.publishedAt), ctDate: chicagoParts(new Date(post.publishedAt)).date,
        status: 'posted', outcomes: post.outcomes || {}, title: post.title || '' };
      if (index >= 0) entries[index] = item; else entries.push(item);
    }
    entries.sort((a, b) => a.ms - b.ms);
    const last = entries.at(-1);
    const confirmed = entries.filter(x => x.status === 'posted');
    pipelines[name] = { todayCount: confirmed.filter(x => x.ctDate === today).length, todayTarget: PIPELINES[name].hours.length,
      lastStatus: last?.status || null, lastArtist: last?.artist || null, lastTitle: last?.title || null,
      lastAtIso: last ? new Date(last.ms).toISOString() : null, lastOutcomes: last?.outcomes || null,
      slots: states[name]?.slots || {} };
    weekly[name] = dates.map(day => confirmed.filter(x => x.ctDate === day).length);
    posts.push(...confirmed.map(x => ({ pipeline: name, platform: name === 'pin' ? 'Pinterest' : x.outcomes?.facebook?.status === 'posted' ? 'IG + FB' : 'Instagram',
      facebookStatus: name === 'pin' ? null : x.outcomes?.facebook?.status || 'unknown', artist: x.artist, title: x.title,
      status: x.status, atIso: new Date(x.ms).toISOString(), outcomes: x.outcomes })));
  }
  return { pipelines, weekly, posts: posts.sort((a,b) => Date.parse(b.atIso) - Date.parse(a.atIso)).slice(0,20) };
}
