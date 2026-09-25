// CLI entry point for .github/workflows/dev-bot-status.yml.
// Phase 1: posts a read-only summary of Dev Bot task progress to
// #admin-general once a day. Reads ops-state/dev-bot.json only -- no
// state is written, no LLM call, no buttons, no merge/deploy authority.
import 'dotenv/config';
import { postToAdminChannel } from '../src/clients/discord.js';
import { getStatusSummary } from '../src/ops/dev-bot/status.js';

async function main() {
  const summary = await getStatusSummary();
  await postToAdminChannel({ content: summary });
  console.log('Dev Bot status summary posted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
