import test from 'node:test';
import assert from 'node:assert/strict';
import { startTask } from '../src/ops/dev-bot/start.js';

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

function fakeBranchCreator(impl = async (task) => ({ branch: `agents/dev-bot/fake-${task.id}`, created: true })) {
  const calls = [];
  return {
    calls,
    async createBranchWithBrief(task) {
      calls.push(task.id);
      return impl(task);
    },
  };
}

function seededStore(task) {
  return fakeStore({ version: 1, tasks: { [task.id]: task }, unauthorizedAttempts: [] });
}

function pendingTask(overrides) {
  return {
    id: 'issue-1',
    title: 'Improve trending detection',
    body: 'raw text',
    status: 'pending-review',
    requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('startTask rejects an unauthorized GitHub actor and logs the attempt without creating a branch', async () => {
  const store = seededStore(pendingTask());
  const branchCreator = fakeBranchCreator();
  const result = await startTask('issue-1', { githubUsername: 'rando' }, { store, roles, branchCreator });
  assert.equal(result.started, false);
  assert.match(result.reason, /rando/);
  assert.equal(branchCreator.calls.length, 0);
  assert.equal(store._value.unauthorizedAttempts.length, 1);
  assert.equal(store._value.unauthorizedAttempts[0].action, 'start');
  assert.equal(store._value.tasks['issue-1'].status, 'pending-review');
});

test('startTask rejects an unauthorized Discord actor the same way', async () => {
  const store = seededStore(pendingTask());
  const branchCreator = fakeBranchCreator();
  const result = await startTask('issue-1', { discordUserId: '999999999999999999' }, { store, roles, branchCreator });
  assert.equal(result.started, false);
  assert.match(result.reason, /999999999999999999/);
  assert.equal(branchCreator.calls.length, 0);
});

test('startTask reports a missing task without touching the branch creator', async () => {
  const store = fakeStore();
  const branchCreator = fakeBranchCreator();
  const result = await startTask('issue-999', { githubUsername: 'yvan-real-login' }, { store, roles, branchCreator });
  assert.equal(result.started, false);
  assert.match(result.reason, /No task found/);
  assert.equal(branchCreator.calls.length, 0);
});

test('startTask refuses to restart a task that already moved past pending-review', async () => {
  const store = seededStore(pendingTask({ status: 'branch-ready', branch: 'agents/dev-bot/existing' }));
  const branchCreator = fakeBranchCreator();
  const result = await startTask('issue-1', { githubUsername: 'yvan-real-login' }, { store, roles, branchCreator });
  assert.equal(result.started, false);
  assert.match(result.reason, /already "branch-ready"/);
  assert.equal(branchCreator.calls.length, 0);
});

test('startTask creates a branch for an authorized, pending-review task and updates its status', async () => {
  const store = seededStore(pendingTask());
  const branchCreator = fakeBranchCreator();
  const result = await startTask('issue-1', { githubUsername: 'yvan-real-login' }, { store, roles, branchCreator });
  assert.equal(result.started, true);
  assert.equal(result.branch, 'agents/dev-bot/fake-issue-1');
  assert.equal(branchCreator.calls.length, 1);
  assert.equal(store._value.tasks['issue-1'].status, 'branch-ready');
  assert.equal(store._value.tasks['issue-1'].branch, 'agents/dev-bot/fake-issue-1');
});

test('startTask works the same way for a Discord actor authorized by Discord ID', async () => {
  const store = seededStore(pendingTask({ id: 'discord-m1' }));
  const branchCreator = fakeBranchCreator();
  const result = await startTask('discord-m1', { discordUserId: '111111111111111111' }, { store, roles, branchCreator });
  assert.equal(result.started, true);
  assert.equal(store._value.tasks['discord-m1'].status, 'branch-ready');
});
