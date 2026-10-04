// Hourly clock for 808dystopia-core's posting workflows. GitHub treats its
// own `schedule:` triggers as best-effort and dropped about half of them
// from 2026-10-03, so this Netlify scheduled function also starts every
// scheduled workflow each hour via workflow_dispatch with
// trigger=scheduler. The workflows' Chicago-time gate decides whether
// anything is due, and the per-hour slot claim makes a second run in the
// same hour (GitHub's cron also firing) a no-op.
//
// Needs the Netlify env var GITHUB_DISPATCH_TOKEN: a fine-grained GitHub
// token for 808dystonia/808dystopia-core with "Actions: Read and write".
const REPO = "808dystonia/808dystopia-core";

// Keep in sync with src/ops/schedule.js (tests/workflows.test.js checks).
export const WORKFLOWS = [
  "daily-post.yml",
  "daily-reel.yml",
  "pin-post.yml",
  "his-pin.yml",
  "her-pin.yml",
  "news-brief.yml",
  "eod-brief.yml",
  "morning-sync.yml",
  "trending-tuesday.yml",
  "weekly-performance.yml",
];

export async function dispatchAll(token, fetchImpl = fetch) {
  return Promise.all(
    WORKFLOWS.map(async (file) => {
      try {
        const res = await fetchImpl(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main", inputs: { trigger: "scheduler" } }),
        });
        return `${file}: ${res.status}`;
      } catch (err) {
        return `${file}: error ${err.message}`;
      }
    })
  );
}

export default async () => {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    console.log("dispatch-schedule: GITHUB_DISPATCH_TOKEN is not set; nothing dispatched");
    return;
  }
  console.log(`dispatch-schedule: ${(await dispatchAll(token)).join(", ")}`);
};

// Every hour at :08 UTC. The workflows gate on the Chicago hour, so the
// minute only needs to land inside the hour.
export const config = {
  schedule: "8 * * * *",
};
