// Public operational metadata only. Never write tokens, raw source text,
// captions, cookies, or exception bodies to this branch.
const BRANCH = 'automation-state';
const empty = () => ({ version: 1, slots: {}, posts: {} });
export function createStateStore({ token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '808dystonia/808dystopia-core', fetchImpl = fetch } = {}) {
  async function api(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
      method, headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) { const e = new Error(`State API ${method} failed (${response.status})`); e.status = response.status; throw e; }
    return data;
  }
  async function ensureBranch() {
    try { await api(`git/ref/heads/${BRANCH}`); return; } catch (e) { if (e.status !== 404) throw e; }
    const main = await api('git/ref/heads/main');
    try { await api('git/refs', 'POST', { ref: `refs/heads/${BRANCH}`, sha: main.object.sha }); }
    catch (e) { if (e.status !== 422) throw e; await api(`git/ref/heads/${BRANCH}`); }
  }
  async function read(name) {
    if (!/^[a-z-]+$/.test(name)) throw new Error('Invalid state name');
    try {
      const file = await api(`contents/ops-state/${name}.json?ref=${BRANCH}`);
      if (!file.content) throw new Error('State file missing content; refusing to reset it');
      return { value: JSON.parse(Buffer.from(file.content, 'base64').toString()), sha: file.sha };
    } catch (e) { if (e.status === 404) return { value: empty() }; throw e; }
  }
  async function update(name, mutate) {
    if (!token) throw new Error('GITHUB_TOKEN required for durable publishing state');
    await ensureBranch();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { value, sha } = await read(name);
      const result = mutate(value);
      const content = Buffer.from(JSON.stringify(value)).toString('base64');
      try {
        await api(`contents/ops-state/${name}.json`, 'PUT', { branch: BRANCH, message: `Update ${name} operational state`, content, ...(sha ? { sha } : {}) });
        return result;
      } catch (e) { if (![409, 422].includes(e.status) || attempt === 4) throw e; }
    }
  }
  return { read, update };
}
// Resolve environment lazily, after dotenv initialization in local scripts.
export const stateStore = {
  read: name => createStateStore().read(name),
  update: (name, mutate) => createStateStore().update(name, mutate),
};
