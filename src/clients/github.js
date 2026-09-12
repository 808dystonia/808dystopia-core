// GitHub REST API — source of the EOD brief's "accomplishments" section.
// No Composio wrapper needed: GitHub Actions automatically provides a
// GITHUB_TOKEN with read access to the repo the workflow runs in, so this
// needs no separate secret to set up in CI (only for local testing, where
// a personal access token works too).
//
// Uses the repo-scoped /pulls endpoint (state=closed, sorted by most
// recently updated) and filters by merged_at client-side, rather than the
// Search API's merged: date-range qualifier -- the Search API indexes
// with some lag and, in this sandbox specifically, is blocked outright
// ("sessions are bound to their configured repositories"); the
// repo-scoped endpoint is always current and has no such restriction.
// Fetching the 50 most recently *updated* closed PRs comfortably covers
// a single day's merges at this project's PR volume without needing to
// paginate further.
import { config } from "../config.js";

const API = "https://api.github.com";

export async function getMergedPullRequests(sinceDate, untilDate) {
  if (!config.github.token) throw new Error("GITHUB_TOKEN missing");

  const res = await fetch(
    `${API}/repos/${config.github.repo}/pulls?${new URLSearchParams({
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: "50",
    })}`,
    {
      headers: {
        Authorization: `Bearer ${config.github.token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`github pulls ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  const since = new Date(sinceDate);
  const until = new Date(untilDate);
  return json
    .filter((pr) => pr.merged_at && new Date(pr.merged_at) >= since && new Date(pr.merged_at) < until)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      body: pr.body || "",
    }));
}
