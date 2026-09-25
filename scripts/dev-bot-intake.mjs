// CLI entry point for .github/workflows/dev-bot-intake.yml. Reads the
// triggering "issues: labeled" event straight from GITHUB_EVENT_PATH
// (no extra API call needed to fetch what the workflow already received),
// runs Phase 0 intake, and posts one confirmation/rejection comment back
// on the issue. Raw fetch() against the GitHub REST API, matching the
// style already used in src/ops/state.js -- no new dependency.
import fs from 'node:fs';
import { processIssue, TASK_LABEL } from '../src/ops/dev-bot/task-intake.js';

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
    throw new Error('GITHUB_EVENT_PATH not set -- this script expects to run inside the dev-bot-intake workflow.');
  }
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

  // "issues: labeled" fires for every label added to every issue; the
  // workflow's own job-level `if:` already filters to TASK_LABEL, but
  // this is checked again here so the script is safe to invoke directly.
  if (event.label?.name !== TASK_LABEL) {
    console.log(`Label "${event.label?.name}" is not "${TASK_LABEL}" -- nothing to do.`);
    return;
  }

  const issue = {
    number: event.issue.number,
    title: event.issue.title,
    body: event.issue.body,
    authorLogin: event.issue.user?.login,
  };
  const result = await processIssue(issue);

  if (result.skipped) {
    console.log(`Issue #${issue.number}: ${result.reason}`);
    return;
  }
  if (!result.accepted) {
    console.log(`Issue #${issue.number} rejected: ${result.reason}`);
    await postComment(
      issue.number,
      `🚫 **Dev Bot did not accept this task.**\n\n${result.reason}\n\nIf this is a mistake, ask an authorized requester to add you to \`config/dev-bot-roles.json\`.`,
    );
    return;
  }
  console.log(`Issue #${issue.number} accepted as task ${result.task.id}`);
  await postComment(
    issue.number,
    `✅ **Logged as Dev Bot task \`${result.task.id}\`.**\n\nRequested by: ${result.task.requestedBy.displayName}\nStatus: \`${result.task.status}\`\n\nThis is Phase 0 -- the task is now tracked, but no agent has started work on it yet.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
