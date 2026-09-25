// Phase 3: posts a real GitHub PR review (APPROVE / REQUEST_CHANGES) on
// behalf of a Discord approve/reject command -- fully native to GitHub,
// visible on the PR itself, no new label or GitHub Application needed.
// Never merges anything: a human still clicks Merge on GitHub, same as
// every phase before this one.
export function createPrReviewer({
  token = process.env.GITHUB_TOKEN,
  repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '808dystonia/808dystopia-core',
  fetchImpl = fetch,
} = {}) {
  async function api(path, method, body) {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const e = new Error(`Dev Bot PR review API ${method} ${path} failed (${response.status})`);
      e.status = response.status;
      throw e;
    }
    return data;
  }

  async function approve(prNumber) {
    if (!token) throw new Error('GITHUB_TOKEN required to post a Dev Bot PR review');
    await api(`pulls/${prNumber}/reviews`, 'POST', {
      event: 'APPROVE',
      body: 'Approved via 808 Dev Bot (Discord). A human still merges this manually -- Dev Bot has no merge authority.',
    });
  }

  async function requestChanges(prNumber, reasonText) {
    if (!token) throw new Error('GITHUB_TOKEN required to post a Dev Bot PR review');
    const body = reasonText
      ? `Changes requested via 808 Dev Bot (Discord):\n\n${reasonText}`
      : 'Changes requested via 808 Dev Bot (Discord). No reason was given -- ask the requester for detail.';
    await api(`pulls/${prNumber}/reviews`, 'POST', { event: 'REQUEST_CHANGES', body });
  }

  return { approve, requestChanges };
}
