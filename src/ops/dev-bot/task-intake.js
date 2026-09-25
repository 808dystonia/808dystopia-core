// Phase 0 task intake: turns an authorized, dev-bot:task-labeled GitHub
// issue into a durably tracked task record. Fully deterministic -- no AI
// call, no third-party API beyond GitHub itself, no new recurring cost.
//
// Authorization is fail-closed: an issue from anyone not listed in
// config/dev-bot-roles.json is rejected and never enters the task queue,
// though the rejection itself is still recorded (recordUnauthorizedAttempt)
// so an operator can see attempted misuse.
import { isAuthorizedRequester, findRequester, loadRoles } from './roles.js';
import { recordTask, recordUnauthorizedAttempt, taskExistsForIssue } from './state.js';

export const TASK_LABEL = 'dev-bot:task';

export function buildTaskId(issueNumber) {
  return `issue-${issueNumber}`;
}

// Pure decision function: given issue details and a roles list, decides
// whether to accept the task. No network access, no state writes -- kept
// separate so tests can exercise the authorization logic with zero I/O.
export function evaluateIssue({ number, title, body, authorLogin }, roles = loadRoles()) {
  if (!isAuthorizedRequester(authorLogin, roles)) {
    return {
      accepted: false,
      reason: `GitHub user "${authorLogin}" is not on the Dev Bot requester allowlist (config/dev-bot-roles.json).`,
    };
  }
  const requester = findRequester(authorLogin, roles);
  return {
    accepted: true,
    task: {
      id: buildTaskId(number),
      title: title?.trim() || `(untitled task from issue #${number})`,
      body: body || '',
      issueNumber: number,
      requestedBy: { kind: 'human', githubUsername: requester.githubUsername, displayName: requester.displayName, via: 'github-issue' },
      status: 'pending-review',
      createdAt: new Date().toISOString(),
    },
  };
}

// Full intake for one issue: authorize, then persist -- skipping if this
// issue was already processed, so a re-labeled issue or a retried
// workflow run can never create a duplicate task record.
export async function processIssue(issue, { roles, store } = {}) {
  if (await taskExistsForIssue(issue.number, store)) {
    return { skipped: true, reason: 'Task already recorded for this issue.' };
  }
  const evaluation = evaluateIssue(issue, roles);
  if (!evaluation.accepted) {
    await recordUnauthorizedAttempt(
      { issueNumber: issue.number, attemptedBy: issue.authorLogin, reason: evaluation.reason, at: new Date().toISOString() },
      store,
    );
    return evaluation;
  }
  await recordTask(evaluation.task, store);
  return evaluation;
}
