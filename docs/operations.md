# Operating the automations

## Runtime and schedule

GitHub Actions runs the pipelines. No Render service is involved. `src/ops/schedule.js` is the shared Chicago-time schedule. Workflows fire hourly in UTC at staggered minutes; a dependency-free gate runs before `npm ci`, browser downloads, or video tools. The cron entry point checks the window again after setup and refuses a scheduled run that has crossed into another slot. Manual dispatch bypasses the time window, but not duplicate protection. Managed runs must use main.

| Pipeline | Chicago hours | Trigger minute |
|---|---|---|
| Carousel, Instagram + Facebook | 9, 12 | 17 |
| Reel, Instagram + Facebook | 10, 12, 14, 16, 19 | 23 |
| Album-art Pinterest | 9, 13, 17 | 29 |
| News Brief | 12, 18 | 07 |
| Morning Sync | 10 | 13 |
| EOD Brief | 21 | 37 |
| Trending Tuesday | Tuesday 17 | 31 |
| Weekly Performance | Monday 10 | 43 |

These are posting windows, not exact delivery guarantees. GitHub may delay or drop scheduled runs. News Brief starts before the noon carousel so fresh headlines have a chance to arrive, but this is not a dependency guarantee. See [GitHub scheduling documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

RapToonz, BoxArt, and TikTok publishing remain discontinued. Their retained modules are historical code, not active workflows. Curated TikTok video links are still supported as Reel source material.

## Durable receipts and duplicate prevention

`automation-state` is a separate runtime-data branch, created automatically by the first managed run using the repository's built-in `GITHUB_TOKEN`. It contains public, non-secret metadata under `ops-state/`. Its updates do not change main or trigger publishing workflows. Each pipeline has a JSON record with:

- `slots`: Chicago date/hour, run ID, start/finish time, and outcome. Entries older than 90 days are pruned.
- `posts`: hashed content identity, public artist/title/topic/format, pending or posted status, confirmed platform ID, and follow-up outcomes. Content claims are not automatically pruned.

Per-workflow concurrency prevents overlapping execution. GitHub file SHA comparisons protect state updates against races. A content claim is saved **before** the irreversible Instagram/Pinterest publish request. Once the platform returns an ID, a receipt is saved before comments, Facebook, or Sheets logging. The returned ID is also saved to `reports/receipts.jsonl` and uploaded as a workflow artifact.

Sheets remains a readable history and a legacy dedup source. A Sheets outage after publishing cannot make the same content eligible again. New timestamps use UTC ISO strings; readers resolve old offset-free Chicago timestamps through IANA timezone rules. Legacy timestamps in the repeated fall-back hour are inherently ambiguous; the reader chooses the first occurrence.

This is deliberately conservative, not an exactly-once guarantee across external APIs. A crash or network timeout during publishing leaves a **pending claim** because the post may already exist. It will not be automatically retried. Instagram success remains recorded when a hashtag comment, Facebook, or Sheets fails. Failed follow-ups produce a partial outcome and a failed Actions result so they are visible.

## Recovery

1. Open the failed Actions run, its log, and its `run-report` artifact. Check the platform account for the actual post. Consult `receipts.jsonl` if a state write failed.
2. Inspect `ops-state/<pipeline>.json` on `automation-state`. Never clear a pending claim merely because the request timed out.
3. If the post exists, reconcile that claim with its confirmed `id`, `publishedAt`, and `status: posted`. Repair only the missing comment, Facebook post, or Sheets row; do not rerun Instagram publishing.
4. Only after confirming no post exists may an operator remove the matching pending content claim and, if retrying that same scheduled slot, its slot record. These are runtime records, not code changes. Retain all unrelated claims and receipts.
5. A normal rerun of an already-claimed slot will not publish again. A new manual dispatch gets a separate slot but still respects content claims and the Sheet history.

State is stored as one JSON file per pipeline. Monitor its size as history grows; migrate/shard it before GitHub's Contents API inline content limit is reached. Reads without decodable content fail closed rather than resetting dedup history. Do not delete the state branch or rewrite its history as routine cleanup.

## Health and reporting

Automation Health runs hourly at minute 53, checking the previous 24 hours with a 90-minute grace period after each scheduled trigger. It starts tracking at its first run after rollout, so it does not report pre-rollout slots as missed. Missing, running, no-content, failed, and partial slots are flagged in the Actions summary and `health.json`. Actions failure notifications follow each user's GitHub notification preferences; no separate Discord/email alert is configured. A GitHub-wide scheduler outage can also delay this monitor.

`node scripts/dashboard-data.mjs` combines historical Sheets rows with confirmed operational receipts. RapToonz is no longer a target. Facebook is shown as confirmed only when its own receipt exists; historical Facebook outcomes are unknown. The existing externally hosted dashboard must consume the new payload; its UI is not part of this repository.

Weekly Performance collects a cohort of posts aged 1–8 days, using stored post IDs. Reports compare artist, topic, format, and Chicago posting hour **within each platform**, with measured sample counts and averages. Missing metrics are unavailable, never zero-filled. Suggested experiments require at least three measured posts in each of two comparison groups. This is observational data: cumulative metrics differ with post age, topic, and audience; results are not causal proof. No automatic content-selection change is made from a small sample.

Reports appear in Actions summaries and downloadable JSON/Markdown artifacts. The latest aggregates are also stored in `ops-state/performance.json`. Historical posts without durable IDs/metadata are not fabricated or backfilled. The first useful comparison requires new posts and enough observations. Per-post analytics permissions and response shapes must be confirmed by the first production report; unavailable metrics are explicitly flagged. Facebook performance collection is not implemented; Facebook publishing outcomes are tracked separately.

## Optional OpenAI API

The existing DeepSeek provider remains the default. Both providers use the shared gateway with task-specific schema validation, per-request timeouts, at most two attempts for transient generation errors, an 80,000-character input limit, a 3,000-token output limit, and a 30-call per-process ceiling. A retry can incur another generation charge. No provider fallback occurs silently. Text generation cannot publish, change schedules, or override dedup state.

To enable OpenAI after the PR is approved:

1. Add `OPENAI_API_KEY` as a repository Actions **secret**. Never place it in code, chat, or an Actions variable.
2. Set the Actions **variable** `OPENAI_MODEL` to a model available to that API project that supports the Responses API and Structured Outputs.
3. Set the Actions **variable** `AI_PROVIDER` to `openai`. Set it back to `deepseek` to revert.
4. Check API project billing/rate limits and the first scheduled run. Missing keys/models, incomplete responses, refusals, and invalid JSON schemas fail visibly. This PR does not provision credentials or activate OpenAI billing.

OpenAI uses `POST /v1/responses`, strict `text.format` JSON schemas, and `store: false`. Existing source-grounding rules remain; structured JSON is not a guarantee of factual accuracy. No hosted tools or web search are enabled. See [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Development

Use Node 22, `npm ci --ignore-scripts`, `npm test`, and `npm run check`. CI performs the same checks without production secrets. Install browser dependencies normally only when intentionally testing rendering. Tests mock API and publishing calls. Never validate a change by triggering a live posting pipeline.

Development uses a `claude/*` branch and PR, with explicit user approval before merge. Existing media-hosting bot commits to main are runtime behavior retained from the working system; development code must not use that path.
