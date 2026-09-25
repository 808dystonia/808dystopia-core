# 808 Dev Bot

> **Status: Phase 0 only.** Everything below the "Phase plan" section
> describes the eventual full design. Only the Phase 0 mechanics
> (task intake from a labeled GitHub issue into durable state) exist in
> this repo today. No agent execution, no cross-agent critique, no
> referee/metrics gate, no Discord surface, and no merge/deploy authority
> exist yet -- anywhere in the system, for anyone.

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
automatically -- Phase 0 has no path that writes to it.

**Cost**: zero. No AI provider is invoked anywhere in this phase.

## Phase plan (not yet built)

- **Phase 0.5** -- Discord task intake for authorized requesters (initially
  the two people in `config/dev-bot-roles.json`'s eventual Discord
  counterpart list). A message in a designated channel becomes a task the
  same way a labeled issue does now. The raw message is stored verbatim
  as the task body -- **no LLM call to "interpret" it**; interpretation is
  deferred until an agent actually needs to reason about the task.
- **Phase 1** -- Discord posts read-only status summaries of task
  progress. Still no buttons, still no merge authority.
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
