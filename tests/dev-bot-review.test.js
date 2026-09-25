import test from 'node:test';
import assert from 'node:assert/strict';
import { approveTask, rejectTask, explainTask } from '../src/ops/dev-bot/review.js';

const roles = [
  { githubUsername: 'yvan-real-login', displayName: 'Yvan', discordUserId: '111111111111111111' },
];

function fakeStore(initial = { version: 1, tasks: {}, unauthorizedAttempts: [] }) {
  const value = structuredClone(initial);
  return {
    async read() { return { value }; },
    async update(_name, mutate) { return mutate(value); },
    _value: value,
  };
}

function seededStore(task) {
  return fakeStore({ version: 1, tasks: { [task.id]: task }, unauthorizedAttempts: [] });
}

function taskWithPr(overrides) {
  return {
    id: 'issue-1',
    title: 'Improve trending detection',
    status: 'in-review',
    branch: 'agents/dev-bot/improve-trending-abc123',
    prNumber: 84,
    ciState: 'passing',
    createdAt: new Date().toISOString(),
    requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' },
    ...overrides,
  };
}

function fakePrReviewer() {
  const calls = [];
  return {
    calls,
    async approve(prNumber) { calls.push(['approve', prNumber]); },
    async requestChanges(prNumber, reason) { calls.push(['requestChanges', prNumber, reason]); },
  };
}

test('approveTask rejects an unauthorized actor silently and never calls the reviewer', async () => {
  const store = seededStore(taskWithPr());
  const prReviewer = fakePrReviewer();
  const result = await approveTask('issue-1', '999999999999999999', { store, roles, prReviewer });
  assert.equal(result.applied, false);
  assert.equal(result.silent, true);
  assert.equal(prReviewer.calls.length, 0);
  assert.equal(store._value.unauthorizedAttempts.length, 1);
  assert.equal(store._value.unauthorizedAttempts[0].action, 'approve');
});

test('approveTask reports (loudly) a missing task', async () => {
  const store = fakeStore();
  const prReviewer = fakePrReviewer();
  const result = await approveTask('issue-999', '111111111111111111', { store, roles, prReviewer });
  assert.equal(result.applied, false);
  assert.equal(result.silent, false);
  assert.match(result.reason, /No task found/);
});

test('approveTask reports (loudly) a task with no PR yet', async () => {
  const store = seededStore(taskWithPr({ prNumber: undefined, status: 'branch-ready' }));
  const prReviewer = fakePrReviewer();
  const result = await approveTask('issue-1', '111111111111111111', { store, roles, prReviewer });
  assert.equal(result.applied, false);
  assert.equal(result.silent, false);
  assert.match(result.reason, /no open PR/);
  assert.equal(prReviewer.calls.length, 0);
});

test('approveTask posts a real PR review and records the review state', async () => {
  const store = seededStore(taskWithPr());
  const prReviewer = fakePrReviewer();
  const result = await approveTask('issue-1', '111111111111111111', { store, roles, prReviewer });
  assert.equal(result.applied, true);
  assert.deepEqual(prReviewer.calls, [['approve', 84]]);
  assert.equal(store._value.tasks['issue-1'].reviewState, 'approved');
  assert.ok(store._value.tasks['issue-1'].reviewedAt);
});

test('rejectTask posts a request-changes review carrying the given reason', async () => {
  const store = seededStore(taskWithPr());
  const prReviewer = fakePrReviewer();
  const result = await rejectTask('issue-1', '111111111111111111', 'Needs more tests', { store, roles, prReviewer });
  assert.equal(result.applied, true);
  assert.deepEqual(prReviewer.calls, [['requestChanges', 84, 'Needs more tests']]);
  assert.equal(store._value.tasks['issue-1'].reviewState, 'changes-requested');
  assert.equal(store._value.tasks['issue-1'].reviewNote, 'Needs more tests');
});

test('rejectTask is silent for an unauthorized actor', async () => {
  const store = seededStore(taskWithPr());
  const prReviewer = fakePrReviewer();
  const result = await rejectTask('issue-1', '999999999999999999', 'nope', { store, roles, prReviewer });
  assert.equal(result.silent, true);
  assert.equal(prReviewer.calls.length, 0);
});

test('explainTask returns the task for an authorized actor without mutating state', async () => {
  const original = taskWithPr();
  const store = seededStore(original);
  const result = await explainTask('issue-1', '111111111111111111', { store, roles });
  assert.equal(result.applied, true);
  assert.equal(result.task.id, 'issue-1');
  assert.deepEqual(store._value.tasks['issue-1'], original);
});

test('explainTask is silent for an unauthorized actor but loud for a missing task', async () => {
  const store = seededStore(taskWithPr());
  const unauthorized = await explainTask('issue-1', '999999999999999999', { store, roles });
  assert.equal(unauthorized.silent, true);

  const missing = await explainTask('issue-404', '111111111111111111', { store, roles });
  assert.equal(missing.silent, false);
  assert.match(missing.reason, /No task found/);
});
