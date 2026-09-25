import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStatusSummary } from '../src/ops/dev-bot/status.js';

function task(overrides) {
  return {
    id: 'issue-1',
    title: 'Improve trending detection',
    status: 'pending-review',
    createdAt: '2026-09-25T00:00:00.000Z',
    requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'github-issue' },
    ...overrides,
  };
}

test('formatStatusSummary reports zero tasks plainly', () => {
  const summary = formatStatusSummary([]);
  assert.match(summary, /no tasks tracked yet/);
});

test('formatStatusSummary counts by status and lists tasks newest-first with age and source', () => {
  const now = new Date('2026-09-25T02:00:00.000Z');
  const tasks = [
    task({ id: 'issue-1', createdAt: '2026-09-25T00:00:00.000Z' }),
    task({ id: 'discord-m1', title: 'Add a status summary', createdAt: '2026-09-25T01:30:00.000Z', requestedBy: { kind: 'human', githubUsername: 'yvan-real-login', displayName: 'Yvan', via: 'discord-message' } }),
  ];
  const summary = formatStatusSummary(tasks, now);
  assert.match(summary, /2 task\(s\) tracked/);
  assert.match(summary, /2 `pending-review`/);

  const discordLine = summary.indexOf('discord-m1');
  const issueLine = summary.indexOf('issue-1');
  assert.ok(discordLine < issueLine, 'newer task should be listed first');
  assert.match(summary, /discord-m1.*Discord, just now/);
  assert.match(summary, /issue-1.*GitHub issue, 2h ago/);
  assert.match(summary, /Phase 1/);
});

test('formatStatusSummary truncates long lists and reports a remainder count', () => {
  const now = new Date('2026-09-25T12:00:00.000Z');
  const tasks = Array.from({ length: 13 }, (_, i) =>
    task({ id: `issue-${i}`, createdAt: new Date(now.getTime() - i * 3600000).toISOString() }),
  );
  const summary = formatStatusSummary(tasks, now);
  assert.match(summary, /13 task\(s\) tracked/);
  assert.match(summary, /and 3 more\./);
});

test('formatStatusSummary mixes multiple statuses into one counts line', () => {
  const tasks = [
    task({ id: 'issue-1', status: 'pending-review' }),
    task({ id: 'issue-2', status: 'in-progress' }),
  ];
  const summary = formatStatusSummary(tasks);
  assert.match(summary, /1 `pending-review`/);
  assert.match(summary, /1 `in-progress`/);
});
