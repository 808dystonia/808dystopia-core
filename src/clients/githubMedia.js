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
  git(["push", "origin", "HEAD:main"]);

  const sha = git(["rev-parse", "HEAD"]);
  return `https://raw.githubusercontent.com/${REPO}/${sha}/${relPath}`;
}

export async function publishImageToRepo(localPath, filename) {
  return commitMediaToRepo(localPath, filename, "Add carousel media");
}

// Same approach, for the Reel pipeline's finished clip — Instagram needs a
// publicly-fetchable video_url for Reels too, same constraint as the
// carousel's images/closer video (see the file header for why this beats
// a third-party host).
export async function publishReelToRepo(localPath, filename) {
  return commitMediaToRepo(localPath, filename, "Add reel media");
}
