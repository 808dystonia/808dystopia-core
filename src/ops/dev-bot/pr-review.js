// Phase 3: posts a plain comment on a PR on behalf of a Discord
// approve/reject command. Originally posted a formal GitHub review
// (APPROVE / REQUEST_CHANGES), but GitHub rejects both event types with
// "Can not approve/request changes on your own pull request" whenever
// the reviewing token's identity matches the PR author -- which, in
// this repo, is every PR Dev Bot ever deals with (Claude/Codex sessions
// open PRs under this same repo's own credentials). A plain issue
// comment has no such self-authorship restriction, is still fully
// visible on the PR, and never merges anything -- a human still clicks
// Merge on GitHub, same as every phase before this one.
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

  // PRs are issues under the hood, so the issue-comments endpoint works
  // on a PR number directly -- no separate PR-comments endpoint needed.
  async function comment(prNumber, body) {
    if (!token) throw new Error('GITHUB_TOKEN required to post a Dev Bot PR comment');
    await api(`issues/${prNumber}/comments`, 'POST', { body });
  }

  async function approve(prNumber) {
    await comment(prNumber, '✅ Approved via 808 Dev Bot (Discord). A human still merges this manually -- Dev Bot has no merge authority.');
  }

  async function requestChanges(prNumber, reasonText) {
    const body = reasonText
      ? `🚫 Changes requested via 808 Dev Bot (Discord):\n\n${reasonText}`
      : '🚫 Changes requested via 808 Dev Bot (Discord). No reason was given -- ask the requester for detail.';
    await comment(prNumber, body);
  }

  return { approve, requestChanges };
}
