// Phase 2: turns a "start" request -- a dev-bot:start label added to an
// already-tracked task's issue -- into an isolated agent branch for an
// EXISTING task. This never creates a new task (that's still Phase 0's
// job); it only moves a task that's already `pending-review` forward.
// Still no AI call: this only scaffolds the ground for a human to
// manually point Claude Code or Codex at.
import { isAuthorizedRequester, loadRoles } from './roles.js';
import { getTask, updateTask, recordUnauthorizedAttempt } from './state.js';

export const START_LABEL = 'dev-bot:start';

// Authorization is checked against the actor performing the start action,
// not the task's original requester -- same fail-closed allowlist as
// intake, kept as its own check since a future roles change (e.g. a
// second person who can request but not start) shouldn't require
// redesigning this.
export async function startTask(taskId, actor, { store, roles = loadRoles(), branchCreator } = {}) {
  const githubUsername = actor?.githubUsername;
  if (!isAuthorizedRequester(githubUsername, roles)) {
    const reason = `GitHub user "${githubUsername}" is not on the Dev Bot requester allowlist (config/dev-bot-roles.json).`;
    await recordUnauthorizedAttempt(
      { taskId, action: 'start', attemptedBy: githubUsername, reason, at: new Date().toISOString() },
      store,
    );
    return { started: false, reason };
  }

  const task = await getTask(taskId, store);
  if (!task) {
    return { started: false, reason: `No task found for id "${taskId}".` };
  }
  if (task.status !== 'pending-review') {
    return { started: false, reason: `Task "${taskId}" is already "${task.status}", not "pending-review".`, task };
  }

  const { branch, created } = await branchCreator.createBranchWithBrief(task);
  const updatedTask = await updateTask(taskId, { status: 'branch-ready', branch }, store);
  return { started: true, branch, created, task: updatedTask };
}
