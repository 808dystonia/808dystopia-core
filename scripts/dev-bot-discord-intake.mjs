// CLI entry point for .github/workflows/dev-bot-discord-intake.yml.
// Polls #admin-general (config.discord.adminChannelId -- already used by
// EOD Brief, no new channel or secret) for two kinds of messages:
//
// 1. Phase 0.5: a plain task description from an authorized user, logged
//    verbatim, no LLM call (unchanged -- see src/ops/dev-bot/task-intake.js).
// 2. Phase 2: a "start: <task-id>" command from an authorized user, which
//    turns an existing pending-review task into an isolated agent branch
//    (see src/ops/dev-bot/start.js). Still no AI call, no autonomous
//    code-writing.
//
// Every recent message in the poll window is re-evaluated on every run.
// Task intake has its own dedup (discordMessageAlreadyProcessed); start
// commands don't need a separate dedup ledger -- once a task moves off
// "pending-review", startTask() naturally stops applying, so a re-polled
// "start:" message for an already-started task is a silent no-op.
import 'dotenv/config';
import { config } from '../src/config.js';
import { listChannelMessages, postToAdminChannel } from '../src/clients/discord.js';
import { processDiscordMessages } from '../src/ops/dev-bot/task-intake.js';
import { startTask } from '../src/ops/dev-bot/start.js';
import { createBranchCreator } from '../src/ops/dev-bot/branch.js';

const POLL_LIMIT = 25;
const START_COMMAND = /^start:\s*(\S+)/i;

function normalizeMessage(raw) {
  return { id: raw.id, content: raw.content, authorDiscordId: raw.author?.id };
}

function isStartCommand(message) {
  return START_COMMAND.test((message.content || '').trim());
}

async function handleStartCommands(messages) {
  const branchCreator = createBranchCreator();
  let started = 0;
  for (const message of [...messages].reverse()) { // oldest-first
    const match = (message.content || '').trim().match(START_COMMAND);
    const taskId = match[1];
    const result = await startTask(taskId, { discordUserId: message.authorDiscordId }, { branchCreator });
    if (!result.started) continue; // unauthorized/not-found/already-started: silent, see header
    started += 1;
    await postToAdminChannel({
      content: `🏗️ Branch ready: \`${result.branch}\`\n\nFor task \`${taskId}\`. Point a Claude Code or Codex session at this branch to begin work.\n\nThis is Phase 2 -- no agent invoked automatically, and nothing here merges on its own.`,
    });
  }
  return started;
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
  const commandMessages = messages.filter(isStartCommand);
  const taskMessages = messages.filter((m) => !isStartCommand(m));

  const started = await handleStartCommands(commandMessages);
  const { accepted, rejected, skipped } = await handleIntake(taskMessages);

  console.log(`Discord intake: ${accepted} accepted, ${rejected} rejected (silent), ${skipped} already processed. Start commands applied: ${started}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
