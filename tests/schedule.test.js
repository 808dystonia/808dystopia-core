import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDecision, parseTimestamp, chicagoParts } from '../src/ops/schedule.js';
import { missingSlots } from '../src/ops/health.js';
test('Chicago gates work in winter and summer and normalize midnight', () => {
  for (const utc of ['2026-01-12T15:17:00Z','2026-07-12T14:17:00Z']) assert.equal(scheduleDecision('carousel', new Date(utc), 'schedule').due, true);
  assert.equal(scheduleDecision('carousel', new Date('2026-07-12T13:17:00Z'), 'schedule').due, false);
  assert.equal(chicagoParts(new Date('2026-07-12T05:00:00Z')).hour, 0);
  assert.equal(scheduleDecision('trending-tuesday', new Date('2026-09-15T22:31:00Z'), 'schedule').due, true);
  assert.equal(scheduleDecision('trending-tuesday', new Date('2026-09-16T22:31:00Z'), 'schedule').due, false);
});
test('legacy and new timestamps resolve correct offsets including DST boundaries', () => {
  assert.equal(parseTimestamp('2026-01-12 9:00:00'), Date.parse('2026-01-12T15:00:00Z'));
  assert.equal(parseTimestamp('2026-07-12 9:00:00'), Date.parse('2026-07-12T14:00:00Z'));
  assert.equal(parseTimestamp('2026-07-12T14:00:00Z'), Date.parse('2026-07-12T14:00:00Z'));
  assert.equal(parseTimestamp('2026-03-08 1:59:00'), Date.parse('2026-03-08T07:59:00Z'));
  assert.ok(Number.isNaN(parseTimestamp('2026-03-08 2:30:00')));
  assert.equal(parseTimestamp('2026-03-08 3:00:00'), Date.parse('2026-03-08T08:00:00Z'));
  assert.equal(parseTimestamp('2026-11-01 9:00:00'), Date.parse('2026-11-01T15:00:00Z'));
});
test('health ignores pre-activation slots and grace period; flags misses after grace', () => {
  const activatedAt = '2026-09-18T14:00:00Z';
  assert.deepEqual(missingSlots({}, { activatedAt, now: new Date('2026-09-18T14:53:00Z') }), []);
  const issues = missingSlots({}, { activatedAt, now: new Date('2026-09-18T15:53:00Z') });
  assert.ok(issues.some(x => x.pipeline === 'carousel' && x.status === 'missing'));
  const state = { carousel: { slots: { '2026-09-18T09': { status: 'posted' } } } };
  assert.ok(!missingSlots(state, { activatedAt, now: new Date('2026-09-18T15:53:00Z') }).some(x => x.pipeline === 'carousel'));
});
