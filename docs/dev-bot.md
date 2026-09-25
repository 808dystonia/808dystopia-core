# 808 Dev Bot

> **Status: GitHub-only, Phase 0 and Phase 2.** Task intake exists from a
> labeled GitHub issue (Phase 0) into durable state, and an authorized
> requester can turn a tracked task into an isolated agent branch + task
> brief with a second label (Phase 2), with a read-only PR/CI check
> folded into the task record once a PR opens. **No agent is ever
> invoked automatically** -- a human still manually starts a Claude Code
> or Codex session and points it at the branch, exactly like building
> this system itself. No autonomous code-writing, no cross-agent
> critique automation, no Discord (see "Discord was removed" below), and
> no merge/deploy authority exist yet -- anywhere in the system, for
> anyone.

## What this is

808 Dev Bot is an orchestrator for AI coding agents (Claude Code, Codex)
working on this repo, built incrementally and free-first: reuse existing
GitHub Actions, the existing durable state store (`automation-state`
branch), and existing CI -- no new paid API, no new hosting, unless a
later phase explicitly asks for one and gets sign-off first.

## Discord was removed

Phases 0.5 (Discord task intake), 1 (a daily Discord status summary),
and 3 (`approve:`/`reject:`/`explain:` Discord commands) were built,
merged, and live-tested -- then removed on Yvan's explicit call: too
much moving pieces/complexity for what it bought. Dev Bot is GitHub-only
now: a task starts as a GitHub issue, progress is visible on the
resulting branch/PR, and review happens as an ordinary GitHub PR review
-- nothing needs to be relayed through Discord. `src/clients/discord.js`
and the Composio Discord integration are unaffected and still used by
other pipelines (EOD Brief, News Brief, etc.); only Dev Bot's own use of
Discord is gone. If a future phase wants a chat surface again, it should
be re-proposed and re-approved on its own, not silently resurrected.

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
`"autonomous-proposal"` without changing the schema shape. `requestedBy.via`
is always `"github-issue"` now that Discord intake is gone; the field
stays for schema stability rather than being collapsed away.

**Adding a requester**: edit `config/dev-bot-roles.json` and open a PR
like any other change. Nothing in this repo can add someone to that file
automatically -- Phase 0 has no path that writes to it. The allowlist
format is intentionally generic (a list of entries) so adding a second
person later is a one-line config change, not a redesign -- but Phase 0
ships with a single authorized entry (Yvan), deliberately, not as a
placeholder waiting to be filled in.

**Cost**: zero. No AI provider is invoked anywhere in this phase.

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

**Loop**: an authorized requester adds a second label, `dev-bot:start`,
to an issue whose task is already tracked (`pending-review`).
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

**Then a human takes over**: point a Claude Code or Codex session at
that branch, same as building this Dev Bot itself. No agent runs
automatically, no diff is generated by this system.

**Cross-agent critique and the referee gate stay manual and GitHub
-native**: whichever agent didn't write the code gets pointed at the
resulting PR to review it -- an ordinary PR review, nothing new to
build. "Referee" today means CI plus a human reading the acceptance
criteria in the brief; no LLM judges anything. **No autonomous merge** --
same rule as every phase before this one.

**Cost**: zero. No AI provider invoked anywhere in this phase; the only
new dependency is more GitHub REST API reads/writes with the existing
`GITHUB_TOKEN`.

## Who's authorized

Yvan is currently the sole authorized human requester for 808 Dev Bot.
This is a Dev Bot-specific restriction, not a statement about who's
involved in 808 Dystopia as a business -- Jayden (Stokely Santana) is
Yvan's business partner on the project as a whole and this doesn't
change that. He's just not part of the AI-development-pipeline side of
things right now: no GitHub account, doesn't work the coding/dev side,
and there's no placeholder entry for him anywhere in this system waiting
to be activated. Expanding the allowlist to a second person, whoever
that ends up being, is a config change whenever it's actually decided --
not something implied by this system's existence.

## Phase plan (0 and 2 built, GitHub-only; everything below is not yet built)

- **A future status/PR-tracking phase** -- if a read-only view of task
  progress and PR/CI state turns out to be worth it without Discord (a
  status comment on a tracking issue, a dashboard entry, etc.), it gets
  designed and approved on its own. Not assumed by this system's
  existence.
- **Cross-agent critique and referee automation** -- still fully manual
  today (an ordinary PR review). Any automation here is a future,
  separately-approved phase.
- **Auto-merge on approval** -- only after everything above has run
  without incident, and only with its own explicit sign-off. No merge
  or deploy authority exists anywhere in this system today.

Every phase past 0 requires explicit sign-off before it's built, same as
this one did.

## Guardrails that apply at every phase

- No agent works directly on `main` or `automation-state`; isolated
  `agents/dev-bot/*` branches only, as of Phase 2 -- and even then, no
  agent is invoked to write to one automatically; a human still starts
  that session by hand.
- No merge or deploy authority exists through Dev Bot anywhere in the
  system today; that's deferred to a future phase and will be made
  explicit, not implied by adding someone to a requester list.
- Cost and loop-prevention counters live in `ops-state/dev-bot.json`
  once a phase actually spends anything; Phase 0 has nothing to meter.
- Secrets are never exposed to agents beyond what a workflow already
  scopes today; same rule as the rest of this repo (`AGENTS.md`).
