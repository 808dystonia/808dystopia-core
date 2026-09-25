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

## 808 Dev Bot (Phase 0, 0.5, 1, 2, and 3 only — see `docs/dev-bot.md`)

`config/dev-bot-roles.json`, `src/ops/dev-bot/`, `scripts/dev-bot-*.mjs`,
and `.github/workflows/dev-bot-*.yml` belong to a separate, deliberately
small system: an orchestrator for AI agents working this repo, built one
approved phase at a time. So far: task intake from a labeled GitHub issue
or an authorized Discord message into durable state
(`ops-state/dev-bot.json`); a daily read-only Discord summary of that
state; an isolated `agents/dev-bot/<slug>` branch + task brief scaffolded
on request, with a read-only PR/CI check folded into the daily summary
(Phase 2); and (Phase 3) plain-text Discord commands
(`approve:`/`reject:`/`explain: <task-id>`) to post a real GitHub PR
review or get a templated task summary — not native Discord buttons (no
Discord Application Developer Portal access to register an Interactions
Endpoint against). **No agent is ever invoked automatically anywhere in
this system** — a human still manually starts a Claude Code or Codex
session and points it at the branch, same as any other change in this
repo. If you're an agent picking up work from a Dev Bot task brief
(`.dev-bot/tasks/<task-id>.md` on an `agents/dev-bot/*` branch), the
normal rules in this file still apply in full — new PR, no merge without
explicit user approval, tests, etc. Read `docs/dev-bot.md` before
touching any Dev Bot files or assuming what the system can currently do;
update its status banner and phase-plan section in the same change if
you add a phase, so this pointer doesn't go stale again.
