// Phase 2: read-only lookups of a branch's open PR and its CI state, plus
// syncTaskPrStatus() which folds that into the task list -- no AI, no
// writes beyond the task record's own branch/PR/CI fields. Used by the
// daily status job so the Discord summary reflects real PR/CI state
// instead of a task looking stuck at "branch-ready" forever.
import { listTasks, updateTask } from './state.js';

export function createPrStatusReader({
  token = process.env.GITHUB_TOKEN,
  repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '808dystonia/808dystopia-core',
  fetchImpl = fetch,
} = {}) {
  async function api(path) {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const e = new Error(`Dev Bot PR status API GET ${path} failed (${response.status})`);
      e.status = response.status;
      throw e;
    }
    return data;
  }

  async function findPrForBranch(branch) {
    const owner = repo.split('/')[0];
    const results = await api(`pulls?head=${owner}:${encodeURIComponent(branch)}&state=all&per_page=1&sort=created&direction=desc`);
    return Array.isArray(results) && results.length ? results[0] : null;
  }

  // Aggregates GitHub Actions check runs on a commit into one label --
  // 'pending' while any run hasn't finished, 'failing' if any finished
  // run failed/errored/was cancelled, otherwise 'passing'. No check runs
  // at all (e.g. CI hasn't started) reports 'pending' rather than
  // guessing success.
  async function getCiState(sha) {
    const data = await api(`commits/${sha}/check-runs`);
    const runs = data.check_runs || [];
    if (runs.length === 0) return 'pending';
    if (runs.some((r) => r.status !== 'completed')) return 'pending';
    const bad = new Set(['failure', 'timed_out', 'cancelled', 'action_required']);
    if (runs.some((r) => bad.has(r.conclusion))) return 'failing';
    return 'passing';
  }

  return { findPrForBranch, getCiState };
}

// Only tasks parked at branch-ready/in-review with a branch on file are
// worth a lookup; anything else either has no branch yet or is already
// past this (e.g. rejected/done in a later phase).
const TRACKABLE_STATUSES = new Set(['branch-ready', 'in-review']);

export async function syncTaskPrStatus(prStatusReader, store) {
  const tasks = await listTasks(store);
  const updated = [];
  for (const task of tasks) {
    if (!task.branch || !TRACKABLE_STATUSES.has(task.status)) continue;
    const pr = await prStatusReader.findPrForBranch(task.branch);
    if (!pr) continue;
    const ciState = await prStatusReader.getCiState(pr.head.sha);
    const patch = {
      prNumber: pr.number,
      prUrl: pr.html_url,
      ciState,
      status: pr.state === 'open' ? 'in-review' : task.status,
    };
    updated.push(await updateTask(task.id, patch, store));
  }
  return updated;
}
