// Phase 0 task intake: turns an authorized, dev-bot:task-labeled GitHub
// issue into a durably tracked task record. Fully deterministic -- no AI
// call, no third-party API beyond GitHub itself, no new recurring cost.
//
// Authorization is fail-closed: an issue from anyone not listed in
// config/dev-bot-roles.json is rejected and never enters the task queue,
// though the rejection itself is still recorded (recordUnauthorizedAttempt)
// so an operator can see attempted misuse.
import { isAuthorizedRequester, findRequester, isAuthorizedDiscordUser, findRequesterByDiscordId, loadRoles } from './roles.js';
import { recordTask, recordUnauthorizedAttempt, taskExistsForIssue, discordMessageAlreadyProcessed } from './state.js';

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

export function buildDiscordTaskId(messageId) {
  return `discord-${messageId}`;
}

// Pure decision function for one Discord message -- same shape and spirit
// as evaluateIssue. The raw message content is stored verbatim as the
// task body; no LLM call interprets or restructures it (that's deferred
// until an agent actually needs to reason about the task, per the
// explicit free-first design goal).
export function evaluateDiscordMessage({ id, content, authorDiscordId }, roles = loadRoles()) {
  if (!isAuthorizedDiscordUser(authorDiscordId, roles)) {
    return {
      accepted: false,
      reason: `Discord user "${authorDiscordId}" is not on the Dev Bot requester allowlist (config/dev-bot-roles.json).`,
    };
  }
  const requester = findRequesterByDiscordId(authorDiscordId, roles);
  const firstLine = (content || '').split('\n')[0].trim().slice(0, 120);
  return {
    accepted: true,
    task: {
      id: buildDiscordTaskId(id),
      title: firstLine || `(untitled task from Discord message ${id})`,
      body: content || '',
      discordMessageId: id,
      requestedBy: { kind: 'human', githubUsername: requester.githubUsername, displayName: requester.displayName, via: 'discord-message' },
      status: 'pending-review',
      createdAt: new Date().toISOString(),
    },
  };
}

// Full intake for one Discord message: authorize, then persist -- skipping
// (silently, no reply) if this message was already processed as either
// an accepted task or a rejected attempt, so the same scheduled poll
// re-scanning its fetch window never double-records or double-logs it.
export async function processDiscordMessage(message, { roles, store } = {}) {
  if (await discordMessageAlreadyProcessed(message.id, store)) {
    return { skipped: true, reason: 'Message already processed.' };
  }
  const evaluation = evaluateDiscordMessage(message, roles);
  if (!evaluation.accepted) {
    await recordUnauthorizedAttempt(
      { discordMessageId: message.id, attemptedBy: message.authorDiscordId, reason: evaluation.reason, at: new Date().toISOString() },
      store,
    );
    return evaluation;
  }
  await recordTask(evaluation.task, store);
  return evaluation;
}

// Processes a batch from one poll, oldest-first so tasks land in the
// order they were actually sent (listChannelMessages returns newest-first).
export async function processDiscordMessages(messages, opts = {}) {
  const results = [];
  for (const message of [...messages].reverse()) {
    results.push({ message, result: await processDiscordMessage(message, opts) });
  }
  return results;
}
