// Deletes hosted post media older than MAX_AGE_DAYS from public-media/.
// Instagram, Facebook and Pinterest copy media when a post publishes, and
// every URL handed to them is pinned to the commit that added the file
// (src/clients/githubMedia.js), so removing old files from main breaks
// nothing. They stay in git history. Files without a millisecond
// timestamp in their name are never touched.
import fs from "node:fs";
import path from "node:path";

const MEDIA_DIR = "public-media";
const MAX_AGE_DAYS = 7;

export function staleMedia(names, now = Date.now(), maxAgeDays = MAX_AGE_DAYS) {
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  return names.filter((name) => {
    const match = /-(\d{13})\.[a-z0-9]+$/i.exec(name);
    return match && Number(match[1]) < cutoff;
  });
}

if (process.argv[1]?.endsWith("prune-media.mjs")) {
  const names = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR) : [];
  const stale = staleMedia(names);
  for (const name of stale) fs.unlinkSync(path.join(MEDIA_DIR, name));
  console.log(`Removed ${stale.length} of ${names.length} media files older than ${MAX_AGE_DAYS} days.`);
}
