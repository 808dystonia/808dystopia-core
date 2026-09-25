// Phase 2: creates an isolated agent branch (agents/dev-bot/<slug>) and
// commits one task-brief file to it, so a human can point a Claude Code
// or Codex session at a specific branch to start work on a Dev Bot task.
// No AI call and no autonomous code-writing happen here -- this only
// scaffolds the ground; see docs/dev-bot.md.

function slugify(title) {
  const slug = (title || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'task';
}

export function buildBranchName(task) {
  const suffix = task.id.replace(/[^a-z0-9]/gi, '').slice(-8);
  return `agents/dev-bot/${slugify(task.title)}-${suffix}`;
}

export function buildTaskBrief(task) {
  const criteria = Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length
    ? task.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')
    : '_None recorded yet. Ask the requester to add acceptance criteria to this task before treating it as done -- CI passing alone is not "done" per docs/dev-bot.md._';

  return `# Dev Bot task \`${task.id}\`

**Title**: ${task.title}
**Requested by**: ${task.requestedBy?.displayName || 'unknown'} (via ${task.requestedBy?.via || 'unknown'})
**Status**: \`${task.status}\`

## Description

${task.body || '_(no description provided)_'}

## Acceptance criteria

${criteria}

---
This branch and brief were created by 808 Dev Bot (Phase 2). No agent was
invoked automatically -- point a Claude Code or Codex session at this
branch to begin work. Open a PR from here when ready; Dev Bot's daily
status summary will start tracking its CI state. A human still reviews
and merges -- nothing here merges on its own.
`;
}

export function createBranchCreator({
  token = process.env.GITHUB_TOKEN,
  repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '808dystonia/808dystopia-core',
  fetchImpl = fetch,
} = {}) {
  async function api(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const e = new Error(`Dev Bot branch API ${method} ${path} failed (${response.status})`);
      e.status = response.status;
      throw e;
    }
    return data;
  }

  async function branchExists(branch) {
    try {
      await api(`git/ref/heads/${branch}`);
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  }

  // Idempotent: if the branch already exists (a retried run, a re-added
  // label), this returns { created: false } instead of failing or
  // duplicating the brief commit.
  async function createBranchWithBrief(task) {
    if (!token) throw new Error('GITHUB_TOKEN required to create a Dev Bot agent branch');
    const branch = buildBranchName(task);
    if (await branchExists(branch)) return { branch, created: false };

    const main = await api('git/ref/heads/main');
    try {
      await api('git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: main.object.sha });
    } catch (e) {
      if (e.status !== 422) throw e; // race: another run created the ref first
    }

    const content = Buffer.from(buildTaskBrief(task)).toString('base64');
    await api(`contents/.dev-bot/tasks/${task.id}.md`, 'PUT', {
      branch,
      message: `Dev Bot: scaffold task ${task.id}`,
      content,
    });

    return { branch, created: true };
  }

  return { createBranchWithBrief, branchExists };
}
