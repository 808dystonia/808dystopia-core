# 808 Dev Bot

> **Status: Phase 0, Phase 0.5, Phase 1, Phase 2, and Phase 3 only.**
> Everything below the "Phase plan" section past 3 describes the
> eventual full design. Task intake exists from a labeled GitHub issue
> (Phase 0) or a Discord message in #admin-general (Phase 0.5) into
> durable state, a daily read-only status summary of that state (Phase
> 1), an isolated agent branch + task brief scaffolded on request plus a
> PR/CI check folded into that state (Phase 2), and (Phase 3) plain-text Discord
> commands to approve/reject/explain a task's open PR. **No agent is
> ever invoked automatically**, and **there are no native Discord
> buttons** -- see Phase 3 below for why. No autonomous code-writing, no
> cross-agent critique automation, and no merge/deploy authority exist
> yet -- anywhere in the system, for anyone.

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
   (`src/ops/dev-bot/state.js`'s `listTasks()`).
2. Formats a plain-English summary (`src/ops/dev-bot/status.js`): a count
   by status, then the most recent tasks (id, title, source -- GitHub
   issue or Discord -- and age), newest first.
3. Posts that summary as one message in #admin-general.

In isolation this phase writes nothing. As of Phase 2 the same daily job
also runs a PR/CI sync *before* step 1 that does write (see Phase 2's
own section below) -- this phase's own three steps stay exactly as
described here, no agent invoked, no button or reply mechanism.

**Cost**: zero. No AI provider invoked; reuses the same Composio Discord
integration every other Dev Bot phase and pipeline already uses.

## Phase 2 (implemented)

**What this actually is**: the original Phase 2 design (from before this
was built) bundled isolated agent branches, cross-agent critique, and a
referee gate into one phase, implicitly assuming an agent could be
invoked autonomously. There's no way to do that in this repo without
either a paid LLM API call or a human starting an interactive Claude
Code / Codex session -- and per the zero-new-cost, ask-before-paid-API
rule, this phase deliberately keeps the human in that loop rather than
adding one. What Phase 2 actually builds is the scaffolding around that
still-manual step:

**Loop, GitHub path**: an authorized requester adds a second label,
`dev-bot:start`, to an issue whose task is already tracked (`pending-review`).
`.github/workflows/dev-bot-start.yml` triggers, runs
`scripts/dev-bot-start.mjs`, which:

1. Checks the *label-adder* (not necessarily the original requester)
   against `config/dev-bot-roles.json` -- same fail-closed check as
   intake, logged as an unauthorized attempt if it fails
   (`src/ops/dev-bot/start.js`).
2. Looks up the task. If it's missing, or already past
   `pending-review` (already started), does nothing but comment why.
3. Otherwise creates an isolated branch `agents/dev-bot/<slug>-<id>` off
   `main` (`src/ops/dev-bot/branch.js`) and commits one file to it --
   `.dev-bot/tasks/<task-id>.md`, a plain-English brief: title,
   description, requester, and an acceptance-criteria checklist (empty
   by default -- add criteria to the task before treating a PR from this
   branch as "done"; CI passing alone isn't the bar).
4. Updates the task's status to `branch-ready` and comments the branch
   name back on the issue.

**Loop, Discord path**: the same `dev-bot-discord-intake.yml` poll now
also recognizes a `start: <task-id>` message (from an authorized
Discord user) alongside plain task descriptions, and does the same
branch + brief scaffolding, replying in-channel with the branch name.
Unauthorized/missing/already-started attempts are silent here, same
tone as intake's own unauthorized handling.

**Then a human takes over**: point a Claude Code or Codex session at
that branch, same as building this Dev Bot itself. No agent runs
automatically, no diff is generated by this system.

**PR/CI tracking**: the daily `dev-bot-status.yml` job now also checks
(`src/ops/dev-bot/pr-status.js`) whether a `branch-ready` task's branch
has an open PR, and if so, records the PR number and its CI state
(aggregated from GitHub Actions check runs: `pending` / `passing` /
`failing`) and flips the task to `in-review`. The GitHub side of this is
read-only (`pull-requests: read`, `checks: read`), but the result gets
written back into `ops-state/dev-bot.json` -- so the workflow's
`contents` permission had to move from `read` to `write`, same as the
intake workflows. (An earlier version of this doc claimed the whole job
was `contents: read`; that was wrong and shipped a real bug -- the first
time a real PR existed to sync, the write 403'd and the job failed. Fixed
alongside this correction.) This is still not merge/deploy authority: no
new capability beyond persisting what was already being read. It's what
lets the Discord summary show e.g. `PR #84, CI: passing` instead of a
task looking stuck forever.

**Cross-agent critique and the referee gate stay manual and GitHub
-native**: whichever agent didn't write the code gets pointed at the
resulting PR to review it -- an ordinary PR review, nothing new to
build. "Referee" today means CI plus a human reading the acceptance
criteria in the brief; no LLM judges anything. **No autonomous merge** --
same rule as every phase before this one.

**Cost**: zero. No AI provider invoked anywhere in this phase; the only
new dependency is more GitHub REST API reads/writes with the existing
`GITHUB_TOKEN`.

## Phase 3 (implemented)

**Why there are no Discord buttons**: the original Phase 3 design (from
before this was built) was a narrow Netlify Discord-interactions
endpoint for Approve/Reject/Request changes/Explain more/View PR
buttons. Real Discord buttons need a Discord Application whose
Developer Portal has an Interactions Endpoint URL and Public Key
registered -- and this repo's Discord access is entirely through
Composio's connected-account integration (reading/posting messages,
same as every phase before this), not a Discord Application we control
the Developer Portal for. Asked Yvan directly rather than assume access
that might not exist; he confirmed there's no such access today and
chose plain-text Discord commands instead of chasing that down. So
Phase 3 is the same "do it from Discord" goal, typed instead of
clicked, on the same polling script Phase 0.5/2 already use -- no new
infrastructure, no Netlify function, no new secret.

**Commands, all in #admin-general, all Yvan-only (same fail-closed
allowlist check, logged as an unauthorized attempt and answered with
silence if it fails -- see `src/ops/dev-bot/review.js`)**:

- **`approve: <task-id>`** -- only valid once the task has an open PR on
  file (`prNumber` set by Phase 2's PR/CI sync). Posts a real GitHub PR
  review (`APPROVE`, via `src/ops/dev-bot/pr-review.js`) with a note that
  a human still has to click Merge -- this never merges anything. Records
  `reviewState: "approved"` on the task.
- **`reject: <task-id> [reason]`** -- same PR requirement, posts a
  `REQUEST_CHANGES` review carrying the reason (or a generic note if none
  given). Records `reviewState: "changes-requested"` plus the reason.
- **`explain: <task-id>`** -- read-only. Replies with templated facts
  pulled straight from the task record (`src/ops/dev-bot/status.js`'s
  `formatTaskExplanation()`): title, requester, status, branch, PR
  number/link, CI state, review state, acceptance criteria, and the
  task's own description. No LLM reads or summarizes anything -- this is
  deliberately just facts already on file, same zero-AI-call rule as
  every phase before this one.

A genuine mistake (task ID that doesn't exist, or approving/rejecting a
task with no PR yet) gets a reply explaining why -- unlike an
unauthorized attempt, that's not something worth hiding.

The daily status summary (Phase 1) now also shows the review state once
set, e.g. `PR #84, CI: passing, review: approved`.

**Cost**: zero. No AI provider invoked, no new secret, no new hosting --
just more GitHub REST API calls with the existing `GITHUB_TOKEN` and the
same Composio Discord polling every command-handling phase already uses.

## Who's authorized

Yvan is currently the sole authorized human requester, and (as of Phase
3) the sole approver for 808 Dev Bot.
This is a Dev Bot-specific restriction, not a statement about who's
involved in 808 Dystopia as a business -- Jayden (Stokely Santana) is
Yvan's business partner on the project as a whole and this doesn't
change that. He's just not part of the AI-development-pipeline side of
things right now: no GitHub account, doesn't work the coding/dev side,
and there's no placeholder entry for him anywhere in this system waiting
to be activated. Expanding the allowlist to a second person, whoever
that ends up being, is a config change whenever it's actually decided --
not something implied by this system's existence.

## Phase plan (0, 0.5, 1, 2, and 3 built; everything below is not yet built)

- **Phase 4** -- only after all of the above has run without incident:
  approved changes auto-merge through the existing deploy path (no new
  deploy mechanism -- whatever already happens when a human merges a PR
  today is what happens then, too).

Every phase past 0 requires explicit sign-off before it's built, same as
this one did.

## Guardrails that apply at every phase

- No agent works directly on `main` or `automation-state`; isolated
  `agents/dev-bot/*` branches only, as of Phase 2 -- and even then, no
  agent is invoked to write to one automatically; a human still starts
  that session by hand.
- No Discord user has merge or deploy authority through Dev Bot as of
  Phase 3 -- approve/reject post a real GitHub review, nothing more.
  Only Phase 4, if and when it's built, would change that, and only
  after its own explicit sign-off, not implied by adding someone to a
  requester list.
- Cost and loop-prevention counters live in `ops-state/dev-bot.json`
  once a phase actually spends anything; Phase 0 has nothing to meter.
- Secrets are never exposed to agents beyond what a workflow already
  scopes today; same rule as the rest of this repo (`AGENTS.md`).
