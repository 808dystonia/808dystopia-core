# 808 Dev Bot

> **Status: Phase 0, Phase 0.5, and Phase 1 only.** Everything below the
> "Phase plan" section past 1 describes the eventual full design. Task
> intake exists from a labeled GitHub issue (Phase 0) or a Discord
> message in #admin-general (Phase 0.5) into durable state, plus a daily
> read-only status summary of that state posted back to Discord (Phase
> 1). No agent execution, no cross-agent critique, no referee/metrics
> gate, no Discord buttons, and no merge/deploy authority exist yet --
> anywhere in the system, for anyone.

## What this is

808 Dev Bot is an orchestrator for AI coding agents (Claude Code, Codex)
working on this repo, built incrementally and free-first: reuse existing
GitHub Actions, the existing durable state store (`automation-state`
branch), the existing Discord integration, and existing CI -- no new
paid API, no new hosting, unless a later phase explicitly asks for one
and gets sign-off first.

## Phase 0 (implemented)

**Loop**: an authorized requester opens a GitHub issue labeled
`dev-bot:task` with a plain-English description. `.github/workflows/dev-bot-intake.yml`
triggers on the label, runs `scripts/dev-bot-intake.mjs`, which:

1. Checks the issue author against `config/dev-bot-roles.json`
   (`src/ops/dev-bot/roles.js`). Not listed → rejected, logged as an
   unauthorized attempt, **never enters the task queue**. This is a
   fail-closed check: a missing or malformed roles file throws rather
   than silently accepting everyone.
2. If authorized, builds a task record (`src/ops/dev-bot/task-intake.js`)
   and writes it to `ops-state/dev-bot.json` on the `automation-state`
   branch via the existing shared state store (`src/ops/dev-bot/state.js`
   → `src/ops/state.js`, unchanged).
3. Posts one comment back on the issue confirming accept/reject.
4. Nothing else happens. No branch is created, no agent runs, no AI or
   third-party API call is made anywhere in this path.

**Task shape**:
```json
{
  "id": "issue-<number>",
  "title": "...",
  "body": "...",
  "issueNumber": 123,
  "requestedBy": { "kind": "human", "githubUsername": "...", "displayName": "...", "via": "github-issue" },
  "status": "pending-review",
  "createdAt": "2026-..."
}
```
`requestedBy.kind` is deliberately a discriminator (`"human"` today) so a
later phase can add `"agent"` (Claude/Codex self-proposing) or
`"autonomous-proposal"` without changing the schema shape.

**Adding a requester**: edit `config/dev-bot-roles.json` and open a PR
like any other change. Nothing in this repo can add someone to that file
automatically -- Phase 0 has no path that writes to it. The allowlist
format is intentionally generic (a list of entries) so adding a second
person later is a one-line config change, not a redesign -- but Phase 0
ships with a single authorized entry (Yvan), deliberately, not as a
placeholder waiting to be filled in.

**Cost**: zero. No AI provider is invoked anywhere in this phase.

## Phase 0.5 (implemented)

**Loop**: `.github/workflows/dev-bot-discord-intake.yml` runs hourly
(`workflow_dispatch` also available for a manual test run), polling the
last 25 messages in **#admin-general** (`config.discord.adminChannelId`
-- the same channel EOD Brief already posts to; no new channel, no new
secret). For each message:

1. Skip if `discordMessageAlreadyProcessed()` says this message ID was
   already recorded as either an accepted task or a rejected attempt --
   makes re-scanning the same recent window on every poll a no-op
   instead of reprocessing or re-logging anything.
2. Checks the message author's Discord ID against
   `config/dev-bot-roles.json`. Not listed → rejected, logged internally,
   **never enters the task queue, and gets no reply** -- #admin-general is
   shared, so silently ignoring non-task chatter (including Jayden's, or
   anyone else's) is safer than calling it out publicly.
3. If authorized, records a task with the message content stored
   **verbatim** as the body -- no LLM call reads or restructures it.
4. Posts one confirmation reply in the channel for each accepted task.

Task shape is identical to the GitHub path's, with `discordMessageId`
instead of `issueNumber` and `requestedBy.via: "discord-message"` instead
of `"github-issue"` -- both paths write into the same
`ops-state/dev-bot.json`, so there's one task list regardless of which
surface a task came in through.

**Cost**: zero. No AI provider invoked; reuses the same Composio Discord
integration every other pipeline already uses.

## Phase 1 (implemented)

**Loop**: `.github/workflows/dev-bot-status.yml` runs once a day (gated
through the same Chicago-time `scheduleDecision()` mechanism every
publishing pipeline uses -- see `src/ops/schedule.js`'s `dev-bot-status`
entry; `workflow_dispatch` also available for a manual run), and:

1. Reads every task out of `ops-state/dev-bot.json`
   (`src/ops/dev-bot/state.js`'s `listTasks()`) -- no write happens in
   this path at all (the workflow's `permissions` are `contents: read`,
   not `write`, unlike Phase 0/0.5's intake workflows).
2. Formats a plain-English summary (`src/ops/dev-bot/status.js`): a count
   by status, then the most recent tasks (id, title, source -- GitHub
   issue or Discord -- and age), newest first.
3. Posts that summary as one message in #admin-general.

Nothing else happens. No task's status changes, no agent is invoked, and
there's no button or reply mechanism here -- it's a heartbeat, not a
control surface.

**Cost**: zero. No AI provider invoked; reuses the same Composio Discord
integration every other Dev Bot phase and pipeline already uses.

## Who's authorized

Yvan is currently the sole authorized human requester and, once
approval controls exist (Phase 2+), the sole approver for 808 Dev Bot.
This is a Dev Bot-specific restriction, not a statement about who's
involved in 808 Dystopia as a business -- Jayden (Stokely Santana) is
Yvan's business partner on the project as a whole and this doesn't
change that. He's just not part of the AI-development-pipeline side of
things right now: no GitHub account, doesn't work the coding/dev side,
and there's no placeholder entry for him anywhere in this system waiting
to be activated. Expanding the allowlist to a second person, whoever
that ends up being, is a config change whenever it's actually decided --
not something implied by this system's existence.

## Phase plan (0, 0.5, and 1 built; everything below is not yet built)

- **Phase 2** -- isolated agent branches (`agents/<tool>/<slug>`),
  cross-agent critique (Claude reviews Codex's diff and vice versa, as
  peers -- neither model outranks the other), and the referee gate: CI
  must pass, task-specific acceptance criteria (defined per-task up
  front) must be met, and a human must still sign off. No autonomous
  merges.
- **Phase 3** -- narrow Netlify Discord-interactions endpoint (verify +
  emit a scoped GitHub event only; GitHub Actions remains the only
  trusted executor, the endpoint never runs merge logic itself) for
  Approve/Reject/Request changes/Explain more/View PR buttons.
- **Phase 4** -- only after all of the above has run without incident:
  approved changes auto-merge through the existing deploy path (no new
  deploy mechanism -- whatever already happens when a human merges a PR
  today is what happens then, too).

Every phase past 0 requires explicit sign-off before it's built, same as
this one did.

## Guardrails that apply at every phase

- No agent works directly on `main` or `automation-state`; isolated
  branches only, starting in Phase 2.
- No Discord user has merge or deploy authority through Dev Bot in this
  phase or the next; that decision is deferred and will be made
  explicitly, not implied by adding someone to a requester list.
- Cost and loop-prevention counters live in `ops-state/dev-bot.json`
  once a phase actually spends anything; Phase 0 has nothing to meter.
- Secrets are never exposed to agents beyond what a workflow already
  scopes today; same rule as the rest of this repo (`AGENTS.md`).
