// CLI entry point for .github/workflows/dev-bot-discord-intake.yml.
// Polls #admin-general (config.discord.adminChannelId -- already used by
// EOD Brief, no new channel or secret) for messages from an authorized
// Discord user and records each as a Dev Bot task, verbatim, no LLM call.
//
// Every recent message in the poll window is re-evaluated on every run;
// discordMessageAlreadyProcessed() (src/ops/dev-bot/state.js) makes that
// idempotent rather than needing a fragile persisted cursor. Unauthorized
// messages are logged internally but never get a public reply -- this
// channel is shared, and silently ignoring chatter that isn't a task is
// safer than calling anyone out in it.
import 'dotenv/config';
import { config } from '../src/config.js';
import { listChannelMessages, postToAdminChannel } from '../src/clients/discord.js';
import { processDiscordMessages } from '../src/ops/dev-bot/task-intake.js';

const POLL_LIMIT = 25;

function normalizeMessage(raw) {
  return { id: raw.id, content: raw.content, authorDiscordId: raw.author?.id };
}

async function main() {
  if (!config.discord.adminChannelId) throw new Error('DISCORD_ADMIN_CHANNEL_ID missing');

  const raw = await listChannelMessages(config.discord.adminChannelId, POLL_LIMIT);
  const results = await processDiscordMessages(raw.map(normalizeMessage));

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
  console.log(`Discord intake: ${accepted} accepted, ${rejected} rejected (silent), ${skipped} already processed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
