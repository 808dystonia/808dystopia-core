import test from 'node:test';
import assert from 'node:assert/strict';
import { staleMedia } from '../scripts/prune-media.mjs';

test('only timestamped media older than 7 days is pruned', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const names = [
    `slide1-${now - 8 * day}.png`,
    `reel-${now - 30 * day}.mp4`,
    `slide2-${now - 6 * day}.png`,
    `reel-${now}.mp4`,
    'README.md',
    'logo.png',
  ];
  assert.deepEqual(staleMedia(names, now), [names[0], names[1]]);
});
