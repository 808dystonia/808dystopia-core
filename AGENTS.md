# Working on 808 Dystopia

- Runtime: GitHub Actions in `.github/workflows`. Use America/Chicago for business schedules; never fixed UTC offsets. Render is not used.
- Active publishing: carousel (IG + Facebook), Reel (IG + Facebook), album-art pins, Trending Tuesday. News Brief, EOD Brief and Morning Sync support Discord/site operations.
- RapToonz and BoxArt are discontinued. TikTok publishing is discontinued; curated TikTok links remain a Reel source. Do not re-enable retired workflows or posting routes without a user request.
- Changes go on a new `claude/*` branch, then a PR. Never merge without explicit user approval for that PR. Never commit development changes directly to main.
- Production media uploads currently create bot commits on main. Preserve this working hosting path unless explicitly migrating it. Runtime state belongs on `automation-state`, not main.
- Never run live publishing to test code. Use mocked network/publishing calls. Preserve publish gates. Never print credentials or commit `.env`.
- Local Composio calls may require `unset COMPOSIO_API_KEY GENIUS_ACCESS_TOKEN` followed by `NODE_USE_ENV_PROXY=1` so `.env` wins over stale shell credentials.
- Before modifying publishing, read `docs/operations.md`. An uncertain publish must never be blindly retried. Persist IDs and retain duplicate protection when a comment or Sheets write fails.
- Validate with `npm test` and `npm run check`. Add behavioral tests for failure recovery, DST, scheduling, and external response parsing when those paths change.
- OpenAI is optional. Keep provider selection explicit; do not silently change providers or activate API spending. Do not use an LLM for scheduling, locks, success decisions, or retries.

## Multi-agent coordination

More than one AI agent works on this repo across separate sessions and
separate tools (Claude Code, Codex), with no shared memory between them.
**GitHub Issue #78 ("Agent Coordination Log")** is the async handoff
channel that substitutes for that missing shared memory.

- **Before starting work**, read the last ~5 comments on issue #78 for
  current state, in-flight branches/PRs, and anything a prior session
  learned that isn't yet reflected in this file or `docs/operations.md`.
- **After finishing a session with meaningful repo changes**, post a
  comment on issue #78: what changed, current pipeline state, any
  blocker that needs a human (not fixable in code), and suggested next
  steps. Skip the entry for sessions with no repo changes.
- If something here or in `docs/operations.md` looks stale or wrong,
  say so in the issue #78 entry rather than silently overwriting these
  files with an assumption — another agent may have made the change
  deliberately for a reason not yet reflected in your own context.
