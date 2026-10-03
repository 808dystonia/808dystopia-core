import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wrapOverlay, headlineFilters } from '../src/clients/ffmpeg.js';
import { processClip } from '../src/reels/4-process-clip.js';

test('headline wraps to short lines, max 3', () => {
  assert.deepEqual(wrapOverlay('CONDUCTOR WILLIAMS ON PRODUCING FOR WESTSIDE GUNN'), ['CONDUCTOR WILLIAMS', 'ON PRODUCING FOR', 'WESTSIDE GUNN']);
  assert.deepEqual(wrapOverlay('Tezzus came a long way from his shows just 1 year ago and now sells out arenas'),
    ['Tezzus came a long', 'way from his shows', 'just 1 year ago…']);
  assert.deepEqual(wrapOverlay(''), []);
});

test('headline lines are centred, bottom-aligned above the clip, read from files with no % expansion', () => {
  const two = headlineFilters(['/tmp/a.txt', '/tmp/b.txt'], '/fonts/C.ttf');
  const one = headlineFilters(['/tmp/a.txt'], '/fonts/C.ttf');
  assert.match(two[0], /textfile='\/tmp\/a\.txt'/);
  assert.match(two[0], /expansion=none/);
  assert.match(two[0], /x=\(w-text_w\)\/2/);
  const y = (f) => Number(f.match(/:y=(\d+)/)[1]);
  // The last line ends in the same place however many lines there are.
  assert.equal(y(two[1]), y(one[0]));
  assert.ok(y(two[0]) < y(two[1]));
});

const video = { url: 'u', highlight: { startSeconds: 0, endSeconds: 20 } };
const download = async () => '/tmp/raw.mp4';

test('the hook becomes an uppercase, emoji-free headline with the brand fonts', async () => {
  const calls = [];
  const out = await processClip(video, 'Pixy shut it down 🔥', {
    download,
    format: async (input, wm, output, opts = {}) => {
      calls.push({ lines: (opts.headlineLineFiles || []).map((f) => fs.readFileSync(f, 'utf8')), opts });
    },
  });
  assert.deepEqual(calls[0].lines, ['PIXY SHUT IT DOWN']);
  assert.match(calls[0].opts.headlineFontPath, /Capture_it\.ttf$/);
  assert.match(calls[0].opts.handleFontPath, /Michroma\.ttf$/);
  assert.equal(out.overlay, 'PIXY SHUT IT DOWN');
});

test('a failed text render falls back to clip and logo only instead of losing the Reel', async () => {
  const calls = [];
  const out = await processClip(video, 'Pixy shut it down', {
    download,
    format: async (input, wm, output, opts) => {
      calls.push(opts ? 'with text' : 'plain');
      if (opts) throw new Error('drawtext: font not found');
    },
  });
  assert.deepEqual(calls, ['with text', 'plain']);
  assert.equal(out.overlay, '');
  assert.ok(out.clipPath.endsWith('final.mp4'));
});
