import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrStatusReader, syncTaskPrStatus } from '../src/ops/dev-bot/pr-status.js';

function fakeStore(initial) {
  const value = structuredClone(initial);
  return {
    async read() { return { value }; },
    async update(_name, mutate) { return mutate(value); },
    _value: value,
  };
}

function task(overrides) {
  return {
    id: 'issue-1',
    title: 'Improve trending detection',
    status: 'branch-ready',
    branch: 'agents/dev-bot/improve-trending-abc123',
    createdAt: new Date().toISOString(),
    requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' },
    ...overrides,
  };
}

function fakeReader({ pr = null, ciState = 'pending' } = {}) {
  return {
    calls: [],
    async findPrForBranch(branch) {
      this.calls.push(['findPrForBranch', branch]);
      return pr;
    },
    async getCiState(sha) {
      this.calls.push(['getCiState', sha]);
      return ciState;
    },
  };
}

test('syncTaskPrStatus skips tasks without a branch', async () => {
  const store = fakeStore({ version: 1, tasks: { 'issue-1': task({ branch: undefined, status: 'pending-review' }) }, unauthorizedAttempts: [] });
  const reader = fakeReader();
  const updated = await syncTaskPrStatus(reader, store);
  assert.deepEqual(updated, []);
  assert.equal(reader.calls.length, 0);
});

test('syncTaskPrStatus skips tasks not in a trackable status', async () => {
  const store = fakeStore({ version: 1, tasks: { 'issue-1': task({ status: 'pending-review' }) }, unauthorizedAttempts: [] });
  const reader = fakeReader();
  const updated = await syncTaskPrStatus(reader, store);
  assert.deepEqual(updated, []);
});

test('syncTaskPrStatus leaves a task alone when no PR exists yet for its branch', async () => {
  const store = fakeStore({ version: 1, tasks: { 'issue-1': task() }, unauthorizedAttempts: [] });
  const reader = fakeReader({ pr: null });
  const updated = await syncTaskPrStatus(reader, store);
  assert.deepEqual(updated, []);
  assert.equal(store._value.tasks['issue-1'].status, 'branch-ready');
});

test('syncTaskPrStatus records PR number, URL, CI state, and flips status to in-review once a PR opens', async () => {
  const store = fakeStore({ version: 1, tasks: { 'issue-1': task() }, unauthorizedAttempts: [] });
  const reader = fakeReader({ pr: { number: 84, html_url: 'https://github.com/x/y/pull/84', state: 'open', head: { sha: 'abc123' } }, ciState: 'passing' });
  const updated = await syncTaskPrStatus(reader, store);
  assert.equal(updated.length, 1);
  const t = store._value.tasks['issue-1'];
  assert.equal(t.status, 'in-review');
  assert.equal(t.prNumber, 84);
  assert.equal(t.prUrl, 'https://github.com/x/y/pull/84');
  assert.equal(t.ciState, 'passing');
  assert.deepEqual(reader.calls, [['findPrForBranch', task().branch], ['getCiState', 'abc123']]);
});

test('syncTaskPrStatus keeps updating CI state for a task already in review', async () => {
  const store = fakeStore({ version: 1, tasks: { 'issue-1': task({ status: 'in-review', prNumber: 84, ciState: 'pending' }) }, unauthorizedAttempts: [] });
  const reader = fakeReader({ pr: { number: 84, html_url: 'u', state: 'open', head: { sha: 'def456' } }, ciState: 'failing' });
  await syncTaskPrStatus(reader, store);
  assert.equal(store._value.tasks['issue-1'].ciState, 'failing');
});

function fakeFetch(handlers) {
  return async (url) => {
    const path = new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\//, '');
    for (const [pattern, respond] of handlers) {
      if (pattern.test(path)) return respond();
    }
    throw new Error(`Unhandled fake fetch path: ${path}`);
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('getCiState reports pending when check runs have not all completed', async () => {
  const fetchImpl = fakeFetch([[/^commits\/sha1\/check-runs$/, () => jsonResponse(200, { check_runs: [{ status: 'in_progress', conclusion: null }] })]]);
  const reader = createPrStatusReader({ token: 'tok', fetchImpl });
  assert.equal(await reader.getCiState('sha1'), 'pending');
});

test('getCiState reports pending when there are no check runs yet', async () => {
  const fetchImpl = fakeFetch([[/^commits\/sha1\/check-runs$/, () => jsonResponse(200, { check_runs: [] })]]);
  const reader = createPrStatusReader({ token: 'tok', fetchImpl });
  assert.equal(await reader.getCiState('sha1'), 'pending');
});

test('getCiState reports failing when any completed run failed', async () => {
  const fetchImpl = fakeFetch([[/^commits\/sha1\/check-runs$/, () => jsonResponse(200, {
    check_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }],
  })]]);
  const reader = createPrStatusReader({ token: 'tok', fetchImpl });
  assert.equal(await reader.getCiState('sha1'), 'failing');
});

test('getCiState reports passing when all completed runs succeeded', async () => {
  const fetchImpl = fakeFetch([[/^commits\/sha1\/check-runs$/, () => jsonResponse(200, {
    check_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'neutral' }],
  })]]);
  const reader = createPrStatusReader({ token: 'tok', fetchImpl });
  assert.equal(await reader.getCiState('sha1'), 'passing');
});

test('findPrForBranch returns the first matching PR or null', async () => {
  // Query strings aren't part of URL#pathname, so the fake path here is
  // just "pulls" -- see fakeFetch's own path-extraction above.
  const fetchImpl = fakeFetch([[/^pulls$/, () => jsonResponse(200, [{ number: 5 }])]]);
  const reader = createPrStatusReader({ token: 'tok', repo: '808dystonia/808dystopia-core', fetchImpl });
  assert.deepEqual(await reader.findPrForBranch('agents/dev-bot/x'), { number: 5 });

  const emptyFetch = fakeFetch([[/^pulls$/, () => jsonResponse(200, [])]]);
  const emptyReader = createPrStatusReader({ token: 'tok', fetchImpl: emptyFetch });
  assert.equal(await emptyReader.findPrForBranch('agents/dev-bot/x'), null);
});
