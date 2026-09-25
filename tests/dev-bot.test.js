import test from 'node:test';
import assert from 'node:assert/strict';
import { findRequester, isAuthorizedRequester } from '../src/ops/dev-bot/roles.js';
import { evaluateIssue, processIssue, buildTaskId, TASK_LABEL } from '../src/ops/dev-bot/task-intake.js';

const roles = [
  { githubUsername: 'yvan-real-login', displayName: 'Yvan' },
];

// Minimal in-memory stand-in for src/ops/state.js's stateStore -- exactly
// the shape { read(name), update(name, mutate) } that the dev-bot state
// module calls, so these tests never touch the network or GitHub.
function fakeStore(initial = { version: 1, tasks: {}, unauthorizedAttempts: [] }) {
  const value = structuredClone(initial);
  return {
    async read() { return { value }; },
    async update(_name, mutate) { return mutate(value); },
    _value: value,
  };
}

test('authorized requester is recognized case-insensitively; unknown user is not', () => {
  assert.equal(isAuthorizedRequester('Yvan-Real-Login', roles), true);
  assert.equal(isAuthorizedRequester('someone-else', roles), false);
  assert.equal(isAuthorizedRequester(undefined, roles), false);
  assert.equal(findRequester('yvan-real-login', roles)?.displayName, 'Yvan');
});

test('evaluateIssue accepts an authorized requester and builds a well-formed task', () => {
  const result = evaluateIssue({ number: 42, title: '  Make reels better  ', body: 'details', authorLogin: 'yvan-real-login' }, roles);
  assert.equal(result.accepted, true);
  assert.equal(result.task.id, buildTaskId(42));
  assert.equal(result.task.title, 'Make reels better');
  assert.equal(result.task.status, 'pending-review');
  assert.deepEqual(result.task.requestedBy, { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' });
});

test('evaluateIssue rejects an unauthorized requester with a clear reason', () => {
  const result = evaluateIssue({ number: 7, title: 'x', body: 'y', authorLogin: 'rando' }, roles);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /rando/);
  assert.match(result.reason, /dev-bot-roles\.json/);
});

test('evaluateIssue falls back to a placeholder title when the issue title is blank', () => {
  const result = evaluateIssue({ number: 9, title: '   ', body: '', authorLogin: 'yvan-real-login' }, roles);
  assert.equal(result.accepted, true);
  assert.match(result.task.title, /#9/);
});

test('processIssue persists an accepted task and never enters unauthorized attempts into the queue', async () => {
  const store = fakeStore();
  const result = await processIssue(
    { number: 1, title: 'Improve trending detection', body: 'raw text', authorLogin: 'yvan-real-login' },
    { roles, store },
  );
  assert.equal(result.accepted, true);
  assert.ok(store._value.tasks['issue-1']);
  assert.equal(store._value.tasks['issue-1'].status, 'pending-review');
  assert.equal(store._value.unauthorizedAttempts.length, 0);
});

test('processIssue records but does not queue an unauthorized attempt', async () => {
  const store = fakeStore();
  const result = await processIssue({ number: 2, title: 't', body: 'b', authorLogin: 'rando' }, { roles, store });
  assert.equal(result.accepted, false);
  assert.deepEqual(store._value.tasks, {});
  assert.equal(store._value.unauthorizedAttempts.length, 1);
  assert.equal(store._value.unauthorizedAttempts[0].attemptedBy, 'rando');
});

test('processIssue is idempotent for a re-labeled or retried issue', async () => {
  const store = fakeStore();
  await processIssue({ number: 3, title: 'first pass', body: '', authorLogin: 'yvan-real-login' }, { roles, store });
  const second = await processIssue({ number: 3, title: 'first pass', body: '', authorLogin: 'yvan-real-login' }, { roles, store });
  assert.equal(second.skipped, true);
  assert.equal(Object.keys(store._value.tasks).length, 1);
});

test('the task label used by the workflow matches the constant tests rely on', () => {
  assert.equal(TASK_LABEL, 'dev-bot:task');
});
