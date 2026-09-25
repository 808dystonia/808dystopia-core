import test from 'node:test';
import assert from 'node:assert/strict';
import { findRequester, isAuthorizedRequester, findRequesterByDiscordId, isAuthorizedDiscordUser } from '../src/ops/dev-bot/roles.js';
import { evaluateIssue, processIssue, buildTaskId, TASK_LABEL, evaluateDiscordMessage, processDiscordMessage, processDiscordMessages, buildDiscordTaskId } from '../src/ops/dev-bot/task-intake.js';

const roles = [
  { githubUsername: 'yvan-real-login', displayName: 'Yvan', discordUserId: '111111111111111111' },
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

test('Discord user lookup is an exact string match; unknown IDs are not authorized', () => {
  assert.equal(isAuthorizedDiscordUser('111111111111111111', roles), true);
  assert.equal(isAuthorizedDiscordUser('999999999999999999', roles), false);
  assert.equal(isAuthorizedDiscordUser(undefined, roles), false);
  assert.equal(findRequesterByDiscordId('111111111111111111', roles)?.displayName, 'Yvan');
});

test('evaluateDiscordMessage accepts an authorized message and stores content verbatim', () => {
  const result = evaluateDiscordMessage(
    { id: 'm1', content: 'Could we make the news bot better at catching underground artists?', authorDiscordId: '111111111111111111' },
    roles,
  );
  assert.equal(result.accepted, true);
  assert.equal(result.task.id, buildDiscordTaskId('m1'));
  assert.equal(result.task.body, 'Could we make the news bot better at catching underground artists?');
  assert.equal(result.task.title, 'Could we make the news bot better at catching underground artists?');
  assert.equal(result.task.status, 'pending-review');
  assert.deepEqual(result.task.requestedBy, { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'discord-message' });
});

test('evaluateDiscordMessage rejects an unauthorized Discord user', () => {
  const result = evaluateDiscordMessage({ id: 'm2', content: 'anything', authorDiscordId: '999999999999999999' }, roles);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /999999999999999999/);
});

test('evaluateDiscordMessage falls back to a placeholder title for blank content', () => {
  const result = evaluateDiscordMessage({ id: 'm3', content: '', authorDiscordId: '111111111111111111' }, roles);
  assert.equal(result.accepted, true);
  assert.match(result.task.title, /m3/);
});

test('processDiscordMessage persists an accepted task and keeps unauthorized attempts out of the queue', async () => {
  const store = fakeStore();
  const accepted = await processDiscordMessage({ id: 'm4', content: 'a real idea', authorDiscordId: '111111111111111111' }, { roles, store });
  assert.equal(accepted.accepted, true);
  assert.ok(store._value.tasks['discord-m4']);

  const rejected = await processDiscordMessage({ id: 'm5', content: 'not authorized', authorDiscordId: '999999999999999999' }, { roles, store });
  assert.equal(rejected.accepted, false);
  assert.equal(store._value.tasks['discord-m5'], undefined);
  assert.equal(store._value.unauthorizedAttempts.length, 1);
});

test('re-polling the same message is a silent no-op for both accepted and rejected outcomes', async () => {
  const store = fakeStore();
  await processDiscordMessage({ id: 'm6', content: 'idea', authorDiscordId: '111111111111111111' }, { roles, store });
  const secondAccepted = await processDiscordMessage({ id: 'm6', content: 'idea', authorDiscordId: '111111111111111111' }, { roles, store });
  assert.equal(secondAccepted.skipped, true);
  assert.equal(Object.keys(store._value.tasks).length, 1);

  await processDiscordMessage({ id: 'm7', content: 'nope', authorDiscordId: '999999999999999999' }, { roles, store });
  const secondRejected = await processDiscordMessage({ id: 'm7', content: 'nope', authorDiscordId: '999999999999999999' }, { roles, store });
  assert.equal(secondRejected.skipped, true);
  assert.equal(store._value.unauthorizedAttempts.length, 1); // not re-logged on re-poll
});

test('processDiscordMessages processes a batch oldest-first', async () => {
  const store = fakeStore();
  // listChannelMessages returns newest-first; pass that same ordering in.
  const newestFirst = [
    { id: 'new', content: 'second idea', authorDiscordId: '111111111111111111' },
    { id: 'old', content: 'first idea', authorDiscordId: '111111111111111111' },
  ];
  const results = await processDiscordMessages(newestFirst, { roles, store });
  assert.deepEqual(results.map((r) => r.message.id), ['old', 'new']);
  assert.equal(store._value.tasks['discord-old'].title, 'first idea');
  assert.equal(store._value.tasks['discord-new'].title, 'second idea');
});
