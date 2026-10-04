import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { todaysStories } from '../src/pipeline/1-select-article.js';
import { outcomeStatus } from '../src/ops/run.js';
import { missingSlots } from '../src/ops/health.js';

const grok = config.discord.grokAuthorId;
const embed = (lines) => ({ embeds: [{ description: lines.map((l) => `• ${l}`).join('\n') }] });

test("only today's Grok stories are candidates, release stories first", () => {
  const now = new Date('2026-10-04T17:00:00Z'); // noon Chicago
  const messages = [
    { id: '3', timestamp: '2026-10-04T16:30:00Z', author: { id: 'news-brief-bot' }, ...embed(['News Brief story']) },
    { id: '2', timestamp: '2026-10-04T13:45:00Z', author: { id: grok }, ...embed(['slayr announces a tour', 'Pixy just dropped the Legacy EP', 'LUCKI hurt at ComplexCon']) },
    { id: '1', timestamp: '2026-10-03T13:45:00Z', author: { id: grok }, ...embed(['Yesterday story']) },
  ];
  assert.deepEqual(todaysStories(messages, now).map((s) => s.text), ['Pixy just dropped the Legacy EP', 'slayr announces a tour', 'LUCKI hurt at ComplexCon']);
  // Before the drop lands: nothing.
  assert.deepEqual(todaysStories(messages.slice(2), now), []);
});

test('caught up is healthy, not a failure or a missed slot', () => {
  assert.equal(outcomeStatus({ status: 'caught_up' }), 'caught_up');
  assert.equal(outcomeStatus({}), 'no_content');
  const now = new Date('2026-10-04T23:00:00Z');
  const slots = {};
  for (const h of [9, 10, 11, 12, 13, 14, 15, 17]) slots[`2026-10-04T${String(h).padStart(2, '0')}`] = { status: h < 14 ? 'posted' : 'caught_up', startedAt: '2026-10-04T14:17:00Z' };
  const issues = missingSlots({ carousel: { slots } }, { now, activatedAt: '2026-10-04T00:00:00Z' }).filter((i) => i.pipeline === 'carousel');
  assert.deepEqual(issues, []);
});
