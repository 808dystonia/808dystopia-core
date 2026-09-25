// CLI entry point for .github/workflows/dev-bot-discord-intake.yml.
// Polls #admin-general (config.discord.adminChannelId -- already used by
// EOD Brief, no new channel or secret) for task-management commands and
// plain task descriptions:
//
// 1. Phase 0.5: a plain task description from an authorized user, logged
//    verbatim, no LLM call (unchanged -- see src/ops/dev-bot/task-intake.js).
// 2. Phase 2: "start: <task-id>" scaffolds an isolated agent branch + brief
//    for an existing task (see src/ops/dev-bot/start.js).
// 3. Phase 3: "approve: <task-id>", "reject: <task-id> [reason]", and
//    "explain: <task-id>" let Yvan review a task's open PR from Discord --
//    plain-text commands, not native Discord buttons (this repo's Discord
//    access is Composio's connected account, not a Discord Application we
//    control the Developer Portal for). Approve/reject post a real GitHub
//    PR review (see src/ops/dev-bot/pr-review.js) but never merge; explain
//    replies with templated facts, no LLM (see src/ops/dev-bot/review.js).
//
// Every recent message in the poll window is re-evaluated on every run.
// Task intake has its own dedup (discordMessageAlreadyProcessed). Commands
// don't need a separate dedup ledger: start naturally stops applying once
// a task moves off "pending-review", and approve/reject/explain are each
// idempotent or freely repeatable in their own right (re-approving just
// posts another GitHub review; re-explaining just replies again).
import 'dotenv/config';
import { config } from '../src/config.js';
import { listChannelMessages, postToAdminChannel } from '../src/clients/discord.js';
import { processDiscordMessages } from '../src/ops/dev-bot/task-intake.js';
import { startTask } from '../src/ops/dev-bot/start.js';
import { createBranchCreator } from '../src/ops/dev-bot/branch.js';
import { approveTask, rejectTask, explainTask } from '../src/ops/dev-bot/review.js';
import { createPrReviewer } from '../src/ops/dev-bot/pr-review.js';
import { formatTaskExplanation } from '../src/ops/dev-bot/status.js';

const POLL_LIMIT = 25;

const START_COMMAND = /^start:\s*(\S+)/i;
const APPROVE_COMMAND = /^approve:\s*(\S+)/i;
const REJECT_COMMAND = /^reject:\s*(\S+)(?:\s+([\s\S]+))?$/i;
const EXPLAIN_COMMAND = /^explain:\s*(\S+)/i;

function normalizeMessage(raw) {
  return { id: raw.id, content: raw.content, authorDiscordId: raw.author?.id };
}

function matchCommand(message) {
  const trimmed = (message.content || '').trim();
  let m;
  if ((m = trimmed.match(START_COMMAND))) return { kind: 'start', taskId: m[1] };
  if ((m = trimmed.match(APPROVE_COMMAND))) return { kind: 'approve', taskId: m[1] };
  if ((m = trimmed.match(REJECT_COMMAND))) return { kind: 'reject', taskId: m[1], reason: m[2]?.trim() };
  if ((m = trimmed.match(EXPLAIN_COMMAND))) return { kind: 'explain', taskId: m[1] };
  return null;
}

async function handleCommands(messages) {
  const branchCreator = createBranchCreator();
  const prReviewer = createPrReviewer();
  let applied = 0;

  for (const message of [...messages].reverse()) { // oldest-first
    const command = matchCommand(message);
    if (!command) continue;
    const actor = { discordUserId: message.authorDiscordId };

    if (command.kind === 'start') {
      const result = await startTask(command.taskId, actor, { branchCreator });
      if (!result.started) continue; // unauthorized/not-found/already-started: silent
      applied += 1;
      await postToAdminChannel({
        content: `🏗️ Branch ready: \`${result.branch}\`\n\nFor task \`${command.taskId}\`. Point a Claude Code or Codex session at this branch to begin work.\n\nThis is Phase 2 -- no agent invoked automatically, and nothing here merges on its own.`,
      });
      continue;
    }

    if (command.kind === 'approve') {
      const result = await approveTask(command.taskId, message.authorDiscordId, { prReviewer });
      if (!result.applied) { if (!result.silent) await postToAdminChannel({ content: `⚠️ ${result.reason}` }); continue; }
      applied += 1;
      await postToAdminChannel({ content: `✅ Approved task \`${command.taskId}\` (PR #${result.task.prNumber}) via a real GitHub review. A human still needs to click Merge -- Dev Bot has no merge authority.` });
      continue;
    }

    if (command.kind === 'reject') {
      const result = await rejectTask(command.taskId, message.authorDiscordId, command.reason, { prReviewer });
      if (!result.applied) { if (!result.silent) await postToAdminChannel({ content: `⚠️ ${result.reason}` }); continue; }
      applied += 1;
      await postToAdminChannel({ content: `🚫 Requested changes on task \`${command.taskId}\` (PR #${result.task.prNumber}) via a real GitHub review.` });
      continue;
    }

    if (command.kind === 'explain') {
      const result = await explainTask(command.taskId, message.authorDiscordId);
      if (!result.applied) { if (!result.silent) await postToAdminChannel({ content: `⚠️ ${result.reason}` }); continue; }
      applied += 1;
      await postToAdminChannel({ content: formatTaskExplanation(result.task) });
      continue;
    }
  }

  return applied;
}

async function handleIntake(messages) {
  const results = await processDiscordMessages(messages);
  let accepted = 0;
  let rejected = 0;
  let skipped = 0;
  for (const { result } of results) {
    if (result.skipped) { skipped += 1; continue; }
    if (!result.accepted) { rejected += 1; continue; }
    accepted += 1;
    const { task } = result;
    const excerpt = task.body.slice(0, 80).replace(/\s+/g, ' ').trim();
    await postToAdminChannel({
      content: `✅ Logged as Dev Bot task \`${task.id}\` (from: "${excerpt}${task.body.length > 80 ? '…' : ''}")\nRequested by: ${task.requestedBy.displayName}\nStatus: \`${task.status}\`\n\nThis is Phase 0.5 -- the task is now tracked, but no agent has started work on it yet.`,
    });
  }
  return { accepted, rejected, skipped };
}

async function main() {
  if (!config.discord.adminChannelId) throw new Error('DISCORD_ADMIN_CHANNEL_ID missing');

  const raw = await listChannelMessages(config.discord.adminChannelId, POLL_LIMIT);
  const messages = raw.map(normalizeMessage);
  const commandMessages = messages.filter((m) => matchCommand(m));
  const taskMessages = messages.filter((m) => !matchCommand(m));

  const applied = await handleCommands(commandMessages);
  const { accepted, rejected, skipped } = await handleIntake(taskMessages);

  console.log(`Discord intake: ${accepted} accepted, ${rejected} rejected (silent), ${skipped} already processed. Commands applied: ${applied}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
