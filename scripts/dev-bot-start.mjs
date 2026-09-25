// CLI entry point for .github/workflows/dev-bot-start.yml.
// Phase 2: turns a "dev-bot:start" label (added by an authorized
// requester) into an isolated agent branch + task brief for an already
// -tracked Dev Bot task -- see docs/dev-bot.md. Still no AI call and no
// autonomous code-writing: a human still manually points Claude Code or
// Codex at the resulting branch.
import fs from 'node:fs';
import { buildTaskId } from '../src/ops/dev-bot/task-intake.js';
import { startTask, START_LABEL } from '../src/ops/dev-bot/start.js';
import { createBranchCreator } from '../src/ops/dev-bot/branch.js';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;

async function postComment(issueNumber, body) {
  if (!token || !repo) {
    console.log('No GITHUB_TOKEN/GITHUB_REPOSITORY in this environment -- skipping comment.');
    return;
  }
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ body }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to comment on issue #${issueNumber}: ${response.status} ${text.slice(0, 300)}`);
  }
}

async function main() {
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH not set -- this script expects to run inside the dev-bot-start workflow.');
  }
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

  // Mirrors dev-bot-intake.mjs's own defensive re-check of the workflow's
  // job-level `if:` filter.
  if (event.label?.name !== START_LABEL) {
    console.log(`Label "${event.label?.name}" is not "${START_LABEL}" -- nothing to do.`);
    return;
  }

  const issueNumber = event.issue.number;
  // The label-adder is who's actually performing the start action, not
  // necessarily who originally filed the task.
  const actorLogin = event.sender?.login;
  const taskId = buildTaskId(issueNumber);
  const branchCreator = createBranchCreator();

  const result = await startTask(taskId, { githubUsername: actorLogin }, { branchCreator });

  if (!result.started) {
    console.log(`Start for ${taskId} not applied: ${result.reason}`);
    await postComment(issueNumber, `⚠️ **Dev Bot did not start this task.**\n\n${result.reason}`);
    return;
  }

  console.log(`Task ${taskId} started on branch ${result.branch} (created: ${result.created})`);
  await postComment(
    issueNumber,
    `🏗️ **Branch ready: \`${result.branch}\`**\n\nPoint a Claude Code or Codex session at this branch to begin work. Dev Bot will pick up CI/PR status once you open a pull request from it.\n\nThis is Phase 2 -- no agent has been invoked automatically, and nothing here merges on its own.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
