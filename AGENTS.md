# Agent instructions for 808dystopia-core

This file is read by AI coding agents (Codex, Claude Code, and others) that
follow the AGENTS.md convention. `CLAUDE.md` carries the same instructions
for Claude Code specifically.

## Multi-agent coordination

More than one AI agent may work on this repo across separate sessions and
separate tools, with no shared memory between them. **GitHub Issue #78
("Agent Coordination Log")** is the async handoff channel that substitutes
for that missing shared memory.

- **Before starting work**, read the last ~5 comments on issue #78 for
  current pipeline states, in-flight branches/PRs, and known blockers.
- **After finishing a session with meaningful repo changes**, post a
  comment on issue #78: what changed, current state of each pipeline,
  blockers that need a human (not fixable in code), and suggested next
  steps. Skip the entry for sessions with no repo changes.
- Keep entries factual and short — a handoff log, not a transcript.

## Project conventions

- **Branching**: every change goes on a new branch → PR → **explicit
  human approval before merge**. Never commit straight to `main`.
- **Architecture**: all pipelines run as GitHub Actions cron workflows
  (`.github/workflows/*.yml`), scheduled hourly in UTC and internally
  gated to real Chicago-time windows via a shared `currentChicagoHour()`
  helper (DST-safe). Nothing runs on Render.com — ignore the stale
  `render.yaml` mention in `README.md`.
- **Local sandbox gotcha**: a stale/invalid `COMPOSIO_API_KEY` env var
  often shadows `.env` in local shells. Prefix Composio-touching scripts
  with `unset COMPOSIO_API_KEY GENIUS_ACCESS_TOKEN && NODE_USE_ENV_PROXY=1`.

## Known unresolved issue (not fixable in code)

TikTok cross-posting from the Reel pipeline fails with
`unaudited_client_can_only_post_to_private_accounts`. This is TikTok's
Content Posting API hard-gating unaudited API clients regardless of
`privacy_level` — confirmed against TikTok's own docs, not a bug in this
repo. The only fix is submitting the TikTok developer app for Content
Posting API audit in TikTok's developer portal, which requires human
action outside any coding agent's reach. It will self-heal with no code
change once audited. Don't re-attempt a code workaround for this.
