// CLI entry point for .github/workflows/dev-bot-status.yml.
// Phase 1: posts a read-only summary of Dev Bot task progress to
// #admin-general once a day. Phase 2 adds one read-only step first:
// sync each branch-ready/in-review task against GitHub for an open PR
// and its CI state, so the summary reflects real progress instead of a
// task looking stuck at "branch-ready" forever. No state is written
// beyond each task's own branch/prNumber/ciState fields, no LLM call, no
// buttons, no merge/deploy authority.
import 'dotenv/config';
import { postToAdminChannel } from '../src/clients/discord.js';
import { getStatusSummary } from '../src/ops/dev-bot/status.js';
import { createPrStatusReader, syncTaskPrStatus } from '../src/ops/dev-bot/pr-status.js';

async function main() {
  await syncTaskPrStatus(createPrStatusReader());
  const summary = await getStatusSummary();
  await postToAdminChannel({ content: summary });
  console.log('Dev Bot status summary posted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
