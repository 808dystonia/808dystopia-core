// Phase 3: Yvan can approve/reject a task's open PR, or ask for a
// templated explanation, via plain-text Discord commands in
// #admin-general ("approve: <task-id>", "reject: <task-id> [reason]",
// "explain: <task-id>") -- not native Discord buttons. This repo's
// Discord access is Composio's connected-account integration for
// reading/posting messages, not a Discord Application whose Developer
// Portal we control, so there's no Interactions Endpoint to register
// buttons against. Approve/reject never merge anything -- that's still
// exclusively a human clicking Merge on GitHub (Phase 4, not yet built).
// "Explain" is deliberately templated facts pulled from the task record,
// no LLM call.
import { isAuthorizedDiscordUser, loadRoles } from './roles.js';
import { getTask, updateTask, recordUnauthorizedAttempt } from './state.js';

// Unauthorized attempts stay silent in Discord (same tone as intake's own
// unauthorized handling -- #admin-general is shared, no public call-outs)
// but a genuine "no such task"/"no PR yet" mistake is worth telling Yvan
// about, so callers can tell the two apart via this flag.
async function authorize(discordUserId, action, taskId, roles, store) {
  if (isAuthorizedDiscordUser(discordUserId, roles)) return null;
  const reason = `Discord user "${discordUserId}" is not on the Dev Bot requester allowlist (config/dev-bot-roles.json).`;
  await recordUnauthorizedAttempt({ taskId, action, attemptedBy: discordUserId, reason, at: new Date().toISOString() }, store);
  return reason;
}

export async function approveTask(taskId, discordUserId, { store, roles = loadRoles(), prReviewer } = {}) {
  const unauthorizedReason = await authorize(discordUserId, 'approve', taskId, roles, store);
  if (unauthorizedReason) return { applied: false, silent: true, reason: unauthorizedReason };

  const task = await getTask(taskId, store);
  if (!task) return { applied: false, silent: false, reason: `No task found for id "${taskId}".` };
  if (!task.prNumber) {
    return { applied: false, silent: false, reason: `Task "${taskId}" has no open PR on file yet -- nothing to approve.` };
  }

  await prReviewer.approve(task.prNumber);
  const updated = await updateTask(taskId, { reviewState: 'approved', reviewedAt: new Date().toISOString(), reviewNote: null }, store);
  return { applied: true, task: updated };
}

export async function rejectTask(taskId, discordUserId, reasonText, { store, roles = loadRoles(), prReviewer } = {}) {
  const unauthorizedReason = await authorize(discordUserId, 'reject', taskId, roles, store);
  if (unauthorizedReason) return { applied: false, silent: true, reason: unauthorizedReason };

  const task = await getTask(taskId, store);
  if (!task) return { applied: false, silent: false, reason: `No task found for id "${taskId}".` };
  if (!task.prNumber) {
    return { applied: false, silent: false, reason: `Task "${taskId}" has no open PR on file yet -- nothing to reject.` };
  }

  await prReviewer.requestChanges(task.prNumber, reasonText || null);
  const updated = await updateTask(
    taskId,
    { reviewState: 'changes-requested', reviewedAt: new Date().toISOString(), reviewNote: reasonText || null },
    store,
  );
  return { applied: true, task: updated };
}

// Read-only, but still gated by the same allowlist -- #admin-general is
// shared, and task detail (requester, description, PR link) isn't
// something to hand out to whoever happens to type the right command.
export async function explainTask(taskId, discordUserId, { store, roles = loadRoles() } = {}) {
  const unauthorizedReason = await authorize(discordUserId, 'explain', taskId, roles, store);
  if (unauthorizedReason) return { applied: false, silent: true, reason: unauthorizedReason };

  const task = await getTask(taskId, store);
  if (!task) return { applied: false, silent: false, reason: `No task found for id "${taskId}".` };
  return { applied: true, task };
}
