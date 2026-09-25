import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStatusSummary, formatTaskExplanation } from '../src/ops/dev-bot/status.js';

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

test('formatStatusSummary shows a branch-ready task as such once Phase 2 has scaffolded it', () => {
  const summary = formatStatusSummary([task({ status: 'branch-ready', branch: 'agents/dev-bot/foo-abc123' })]);
  assert.match(summary, /branch `agents\/dev-bot\/foo-abc123` ready/);
});

test('formatStatusSummary shows PR number and CI state once a PR opens for a tracked branch', () => {
  const summary = formatStatusSummary([task({ status: 'in-review', branch: 'agents/dev-bot/foo-abc123', prNumber: 84, ciState: 'passing' })]);
  assert.match(summary, /PR #84, CI: passing/);
});

test('formatStatusSummary defaults an unreported CI state to pending once a PR is on file', () => {
  const summary = formatStatusSummary([task({ status: 'in-review', branch: 'agents/dev-bot/foo-abc123', prNumber: 84 })]);
  assert.match(summary, /PR #84, CI: pending/);
});

test('formatStatusSummary shows the review state once Yvan approves or requests changes via Discord', () => {
  const approved = formatStatusSummary([task({ status: 'in-review', prNumber: 84, ciState: 'passing', reviewState: 'approved' })]);
  assert.match(approved, /PR #84, CI: passing, review: approved/);

  const rejected = formatStatusSummary([task({ status: 'in-review', prNumber: 84, reviewState: 'changes-requested' })]);
  assert.match(rejected, /review: changes-requested/);
});

test('formatTaskExplanation is templated facts only -- no AI-generated summary', () => {
  const t = task({
    status: 'in-review',
    branch: 'agents/dev-bot/foo-abc123',
    prNumber: 84,
    prUrl: 'https://github.com/x/y/pull/84',
    ciState: 'passing',
    reviewState: 'approved',
    body: 'Make trending detection more accurate for underground artists.',
    acceptanceCriteria: ['Tests pass', 'No false positives on the sample set'],
  });
  const explanation = formatTaskExplanation(t);
  assert.match(explanation, /Task `issue-1`: "Improve trending detection"/);
  assert.match(explanation, /Requested by: Yvan \(GitHub issue\)/);
  assert.match(explanation, /Branch: `agents\/dev-bot\/foo-abc123`/);
  assert.match(explanation, /PR: #84 \(https:\/\/github\.com\/x\/y\/pull\/84\), CI: passing/);
  assert.match(explanation, /Review: `approved`/);
  assert.match(explanation, /Tests pass; No false positives on the sample set/);
  assert.match(explanation, /Make trending detection more accurate/);
  assert.match(explanation, /templated facts only, no AI-generated explanation/);
});

test('formatTaskExplanation handles a bare task with no branch, PR, or criteria yet', () => {
  const explanation = formatTaskExplanation(task());
  assert.doesNotMatch(explanation, /Branch:/);
  assert.doesNotMatch(explanation, /PR:/);
  assert.match(explanation, /Acceptance criteria: none recorded/);
});
