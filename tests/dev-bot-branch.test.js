import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBranchName, buildTaskBrief, createBranchCreator } from '../src/ops/dev-bot/branch.js';

function task(overrides) {
  return {
    id: 'issue-42',
    title: 'Make reels better',
    body: 'Improve reel targeting logic.',
    status: 'pending-review',
    requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' },
    ...overrides,
  };
}

test('buildBranchName is deterministic, slugified, and namespaced under agents/dev-bot', () => {
  const name = buildBranchName(task());
  assert.match(name, /^agents\/dev-bot\/make-reels-better-/);
  assert.equal(name, buildBranchName(task()));
});

test('buildTaskBrief includes the task description and a placeholder for missing acceptance criteria', () => {
  const brief = buildTaskBrief(task());
  assert.match(brief, /issue-42/);
  assert.match(brief, /Improve reel targeting logic\./);
  assert.match(brief, /None recorded yet/);
  assert.match(brief, /No agent was\ninvoked automatically/);
});

test('buildTaskBrief renders provided acceptance criteria as a checklist', () => {
  const brief = buildTaskBrief(task({ acceptanceCriteria: ['Tests pass', 'No regressions'] }));
  assert.match(brief, /- \[ \] Tests pass/);
  assert.match(brief, /- \[ \] No regressions/);
});

function fakeFetch(handlers) {
  return async (url) => {
    const path = new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\//, '');
    for (const [pattern, respond] of handlers) {
      if (pattern.test(path)) return respond(path);
    }
    throw new Error(`Unhandled fake fetch path: ${path}`);
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('createBranchCreator creates a new branch off main and commits the brief when the branch does not exist', async () => {
  const calls = [];
  const fetchImpl = fakeFetch([
    [/^git\/ref\/heads\/agents\/dev-bot\//, () => { calls.push('check'); return jsonResponse(404, {}); }],
    [/^git\/ref\/heads\/main$/, () => { calls.push('main'); return jsonResponse(200, { object: { sha: 'main-sha' } }); }],
    [/^git\/refs$/, () => { calls.push('create-ref'); return jsonResponse(201, {}); }],
    [/^contents\/\.dev-bot\/tasks\//, () => { calls.push('commit'); return jsonResponse(201, {}); }],
  ]);
  const creator = createBranchCreator({ token: 'tok', fetchImpl });
  const result = await creator.createBranchWithBrief(task());
  assert.equal(result.created, true);
  assert.match(result.branch, /^agents\/dev-bot\/make-reels-better-/);
  assert.deepEqual(calls, ['check', 'main', 'create-ref', 'commit']);
});

test('createBranchCreator is idempotent when the branch already exists', async () => {
  const calls = [];
  const fetchImpl = fakeFetch([
    [/^git\/ref\/heads\/agents\/dev-bot\//, () => { calls.push('check'); return jsonResponse(200, { object: { sha: 'existing-sha' } }); }],
  ]);
  const creator = createBranchCreator({ token: 'tok', fetchImpl });
  const result = await creator.createBranchWithBrief(task());
  assert.equal(result.created, false);
  assert.deepEqual(calls, ['check']);
});

test('createBranchCreator tolerates a ref-creation race (422) from a concurrent run', async () => {
  const fetchImpl = fakeFetch([
    [/^git\/ref\/heads\/agents\/dev-bot\//, () => jsonResponse(404, {})],
    [/^git\/ref\/heads\/main$/, () => jsonResponse(200, { object: { sha: 'main-sha' } })],
    [/^git\/refs$/, () => jsonResponse(422, { message: 'Reference already exists' })],
    [/^contents\/\.dev-bot\/tasks\//, () => jsonResponse(201, {})],
  ]);
  const creator = createBranchCreator({ token: 'tok', fetchImpl });
  const result = await creator.createBranchWithBrief(task());
  assert.equal(result.created, true);
});

test('createBranchCreator refuses to run without a token', async () => {
  // Pass null (not undefined) so the constructor's default-parameter
  // fallback to process.env.GITHUB_TOKEN doesn't mask this in an
  // environment where that variable happens to be set.
  const creator = createBranchCreator({ token: null, fetchImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(() => creator.createBranchWithBrief(task()), /GITHUB_TOKEN required/);
});
