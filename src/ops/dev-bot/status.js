// Phase 1: a read-only summary of Dev Bot task progress, posted to
// #admin-general. Purely observational -- reads ops-state/dev-bot.json,
// writes nothing, no buttons, no merge/deploy authority. See docs/dev-bot.md.
import { listTasks } from './state.js';

const MAX_LISTED = 10;

function ageLabel(createdAt, now) {
  const ms = now.getTime() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function viaLabel(requestedBy) {
  return requestedBy?.via === 'discord-message' ? 'Discord' : 'GitHub issue';
}

// Phase 2: tasks past intake carry a branch, and once a PR opens from it,
// a PR number and CI state (see src/ops/dev-bot/pr-status.js). Falls back
// to nothing extra for tasks still sitting at plain intake.
function progressLabel(task) {
  if (task.prNumber) {
    return ` — PR #${task.prNumber}, CI: ${task.ciState || 'pending'}`;
  }
  if (task.branch) {
    return ` — branch \`${task.branch}\` ready`;
  }
  return '';
}

export function formatStatusSummary(tasks, now = new Date()) {
  if (tasks.length === 0) {
    return '📋 808 Dev Bot status: no tasks tracked yet.';
  }

  const byStatus = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  }
  const countsLine = Object.entries(byStatus)
    .map(([status, count]) => `${count} \`${status}\``)
    .join(', ');

  const sorted = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const lines = sorted
    .slice(0, MAX_LISTED)
    .map((task) => `• \`${task.id}\` — "${task.title}" (${viaLabel(task.requestedBy)}, ${ageLabel(task.createdAt, now)})${progressLabel(task)}`);
  const remainder = sorted.length - MAX_LISTED;
  const more = remainder > 0 ? `\n…and ${remainder} more.` : '';

  return `📋 808 Dev Bot status: ${tasks.length} task(s) tracked — ${countsLine}.\n\n${lines.join('\n')}${more}\n\nThis is Phase 1 -- a read-only summary. No agent has started work on any of these yet.`;
}

export async function getStatusSummary(store) {
  const tasks = await listTasks(store);
  return formatStatusSummary(tasks);
}
