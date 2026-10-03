// Hosts the two per-post rendered slide images by committing them to this
// repo and serving them via raw.githubusercontent.com, pinned to the exact
// commit that added them — same approach already used for the closer
// video. ImgBB (tried first) was rejected repeatedly by Instagram's media
// fetcher ("Media download has failed") even though the same URLs were
// completely normal, valid, and publicly fetchable from every other
// client — most likely ImgBB's CDN has bot/hotlink protection that blocks
// Meta's crawler specifically. Committing straight to this repo sidesteps
// needing any third-party host at all, at the cost of one extra commit
// per post.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = "808dystonia/808dystopia-core";
const MEDIA_DIR = "public-media";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Confirmed live: the carousel (9 AM/12 PM) and Reel (10 AM/12 PM/2 PM/4
// PM/7 PM) pipelines share the noon hour, and each commits straight to
// main from its own checkout with no coordination between them -- a
// second pipeline's push (or, as happened live, a PR merge) landing on
// main between this one's checkout and its own push is a real, recurring
// race, not a one-off. `git push` rejects with a plain "fetch first" in
// that case; every filename here already carries a timestamp/runId, so
// the added file can never conflict with what moved main underneath it --
// a fetch + rebase always applies cleanly, making a bare retry safe.
const PUSH_RETRIES = 5;

async function pushWithRetry() {
  for (let attempt = 1; attempt <= PUSH_RETRIES; attempt++) {
    try {
      git(["push", "origin", "HEAD:main"]);
      return;
    } catch (err) {
      if (attempt === PUSH_RETRIES) throw err;
      git(["fetch", "origin", "main"]);
      git(["rebase", "origin/main"]);
      await sleep(1000 * attempt);
    }
  }
}

// Confirmed live 9/30: Instagram was handed a raw.githubusercontent URL
// 9s after the push and failed with "Media download has failed" -- the raw
// CDN hadn't caught up with the new commit yet. Poll until the file is
// actually served before returning it. A file that never appears within
// the window is still returned: Instagram's own error stays the signal.
export async function waitUntilFetchable(url, { attempts = 12, delayMs = 5000, fetchImpl = fetch, wait = sleep } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      if (res.ok) return true;
    } catch {
      // Network blip: retry like a not-yet-served response.
    }
    if (attempt < attempts) await wait(delayMs);
  }
  console.log(`media not reachable yet after ${attempts} checks: ${url}`);
  return false;
}

async function commitMediaToRepo(localPath, filename, commitLabel) {
  const relPath = path.posix.join(MEDIA_DIR, filename);
  const destPath = path.join(process.cwd(), MEDIA_DIR, filename);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(localPath, destPath);

  // Matches GitHub's own convention for Actions-authored commits.
  git(["config", "user.name", "github-actions[bot]"]);
  git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  git(["add", relPath]);
  git(["commit", "-m", `${commitLabel}: ${filename}`]);
  await pushWithRetry();

  const sha = git(["rev-parse", "HEAD"]);
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${relPath}`;
  await waitUntilFetchable(url);
  return url;
}

export async function publishImageToRepo(localPath, filename) {
  return commitMediaToRepo(localPath, filename, "Add carousel media");
}

// The music-video clip slide of a video-drop carousel.
export async function publishCarouselVideoToRepo(localPath, filename) {
  return commitMediaToRepo(localPath, filename, "Add carousel media");
}

// Same approach, for the Reel pipeline's finished clip — Instagram needs a
// publicly-fetchable video_url for Reels too, same constraint as the
// carousel's images/closer video (see the file header for why this beats
// a third-party host).
export async function publishReelToRepo(localPath, filename) {
  return commitMediaToRepo(localPath, filename, "Add reel media");
}
