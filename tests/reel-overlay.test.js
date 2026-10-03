import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wrapOverlay, overlayFilters } from '../src/clients/ffmpeg.js';
import { processClip } from '../src/reels/4-process-clip.js';

test('hook text wraps to short centred lines, max 3', () => {
  assert.deepEqual(wrapOverlay('Molly Santana samples All Of The Lights + more snippets'), ['Molly Santana samples', 'All Of The Lights +', 'more snippets']);
  assert.deepEqual(wrapOverlay('Tezzus came a long way from his shows just 1 year ago and now sells out arenas worldwide'),
    ['Tezzus came a long way', 'from his shows just 1', 'year ago and now sells…']);
  assert.deepEqual(wrapOverlay(''), []);
});

test('each line gets its own white box, read from a file with no % expansion', () => {
  const [first, second] = overlayFilters(['/tmp/a.txt', '/tmp/b.txt'], '/fonts/M.ttf');
  assert.match(first, /textfile='\/tmp\/a\.txt'/);
  assert.match(first, /expansion=none/);
  assert.match(first, /box=1:boxcolor=white/);
  assert.match(first, /x=\(w-text_w\)\/2/);
  assert.notEqual(first.match(/y=(\d+)/)[1], second.match(/y=(\d+)/)[1]);
});

const video = { url: 'u', highlight: { startSeconds: 0, endSeconds: 20 } };
const download = async () => '/tmp/raw.mp4';

test('the hook is burned on, minus emojis, which the font cannot draw', async () => {
  const calls = [];
  const out = await processClip(video, 'Pixy shut it down 🔥', {
    download,
    format: async (input, wm, output, opts = {}) => {
      calls.push((opts.overlayLineFiles || []).map((f) => fs.readFileSync(f, 'utf8')));
    },
  });
  assert.deepEqual(calls, [['Pixy shut it down']]);
  assert.equal(out.overlay, 'Pixy shut it down');
});

test('a failed overlay renders the clip without text instead of losing the Reel', async () => {
  const calls = [];
  const out = await processClip(video, 'Pixy shut it down', {
    download,
    format: async (input, wm, output, opts = {}) => {
      calls.push(opts.overlayLineFiles?.length || 0);
      if (opts.overlayLineFiles?.length) throw new Error('drawtext: font not found');
    },
  });
  assert.deepEqual(calls, [1, 0]);
  assert.equal(out.overlay, '');
  assert.ok(out.clipPath.endsWith('final.mp4'));
});
