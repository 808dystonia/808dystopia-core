import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeDrops } from '../src/pipeline/1-select-article.js';
import { buildCaption } from '../src/pipeline/6-build-caption.js';

const now = new Date('2026-10-03T18:00:00Z');
const story = (text, hoursAgo) => ({ text, timestamp: new Date(now - hoursAgo * 3600e3).toISOString() });

test('fresh release stories go first; everything else keeps its order', () => {
  const stories = [
    story('slayr announces a London show', 1),
    story('Pixy just dropped the "Legacy" EP', 5),
    story('fakemink and EsDeeKid tease a collab', 6),
    story('bleood mixtape out now', 30),
    story('Ledbyher dropped an album last week', 100), // drop, but stale
  ];
  assert.deepEqual(prioritizeDrops(stories, now).map((s) => s.text), [
    'Pixy just dropped the "Legacy" EP',
    'bleood mixtape out now',
    'slayr announces a London show',
    'fakemink and EsDeeKid tease a collab',
    'Ledbyher dropped an album last week',
  ]);
});

test('no drops leaves the list untouched; "droplet"-style words do not count', () => {
  const stories = [story('Undercover producer interview', 2), story('Tour dates are a raindrop away', 3)];
  assert.deepEqual(prioritizeDrops(stories, now), stories);
});

test('a release Spotify cannot confirm yet is still captioned as a drop', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const classified = { type: 'other', released: true, artist: 'Pixy', title: 'legacy', context: 'Pixy released a new EP.' };
  const noAi = { write: async () => null };
  const { caption, hashtags } = await buildCaption({ candidate: { text: 'x' }, classified }, noAi);
  assert.ok(caption.startsWith('#Pixy just dropped "Legacy" 💿🔥'));
  assert.match(caption, /Have y'all checked it out yet⁉️ 🤔⬇️/);
  assert.ok(hashtags.includes('#newmusic') && hashtags.includes('#albumdrop'));

  const news = await buildCaption({ candidate: { text: 'x' }, classified: { ...classified, released: false } }, noAi);
  assert.ok(news.caption.startsWith('#Pixy released a new EP 👀'));
  assert.ok(!news.hashtags.includes('#newmusic'));
});

test('a story typed into a manual run replaces the Discord candidates', async () => {
  const { manualCandidates } = await import('../src/pipeline/1-select-article.js');
  const now = new Date('2026-10-04T04:00:00Z');
  assert.deepEqual(manualCandidates('  LUCKI was reportedly injured (AllHipHop).  ', now), [{ text: 'LUCKI was reportedly injured (AllHipHop).', timestamp: '2026-10-04T04:00:00.000Z', manual: true }]);
  assert.equal(manualCandidates('', now), null);
  assert.equal(manualCandidates(undefined, now), null);
});
