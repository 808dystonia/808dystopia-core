import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFeature, buildTracklistHtml } from '../src/pipeline/5-render-slides.js';

test('feature credits are split off in every Spotify spelling', () => {
  assert.deepEqual(splitFeature('Broken Toilet - feat. Flogo'), { title: 'Broken Toilet', feat: 'Flogo' });
  assert.deepEqual(splitFeature('Nova (with Kankan)'), { title: 'Nova', feat: 'Kankan' });
  assert.deepEqual(splitFeature('Glass Hearts [feat. Pixy]'), { title: 'Glass Hearts', feat: 'Pixy' });
  assert.deepEqual(splitFeature('PATCHED IT UP (FEAT. LIL YACHTY)'), { title: 'PATCHED IT UP', feat: 'LIL YACHTY' });
  assert.deepEqual(splitFeature('Red Dot Reaper – ft. Mike Dece & Rif Raf'), { title: 'Red Dot Reaper', feat: 'Mike Dece & Rif Raf' });
  // Words that only look like credits stay in the title.
  assert.deepEqual(splitFeature('Withdrawal'), { title: 'Withdrawal', feat: '' });
  assert.deepEqual(splitFeature('Ride With Me'), { title: 'Ride With Me', feat: '' });
});

const html = (tracklist) => buildTracklistHtml({ classified: { tracklist, title: 'Grip Thumb 2' } });
const tracks = (n) => Array.from({ length: n }, (_, i) => `Track ${i + 1}`);

test('one column up to 12 tracks, two above, numbering continuous', () => {
  assert.equal((html(tracks(12)).match(/class="tracklist-col"/g) || []).length, 1);
  const two = html(tracks(23));
  assert.equal((two.match(/class="tracklist-col"/g) || []).length, 2);
  assert.match(two, /<span class="num">13<\/span><span class="name">Track 13</);
  assert.match(two, /TRACKLIST<span class="dot">&bull;<\/span>23 SONGS/);
});

test('sizes are left to the in-page fit, and features render as small "ft." credits', () => {
  const out = html(['Broken Toilet - feat. Flogo', 'Halos']);
  assert.ok(!/style="font-size/.test(out.split('<div class="tracklist">')[1]));
  assert.match(out, /window\.__layoutDone = false/);
  assert.match(out, /<span class="name">Broken Toilet<\/span><span class="feat">ft\. Flogo<\/span>/);
  assert.ok(!out.includes('{{'));
});

test('very long lists end with a "+N MORE" row', () => {
  const out = html(tracks(40));
  assert.match(out, /\+ 5 MORE/);
  assert.match(out, /<span class="num">35<\/span>/);
  assert.ok(!/<span class="num">36<\/span>/.test(out));
});

test('releases with fewer than 5 tracks get the info slide, with a DROPS headline', async () => {
  const { buildSlide2, MIN_TRACKLIST_SLIDE } = await import('../src/pipeline/5-render-slides.js');
  const nocap = { type: 'album_drop', artist: 'NoCap', title: 'Heaven on Mars', tracklist: ['241', 'Glitchin'], headlineLine1: 'NoCap', headlineLine2: '' };
  const slide = buildSlide2({ candidate: { text: 'NoCap finally put Heaven on Mars out. Video for 241 / Glitchin is up.' }, classified: nocap, photoUrl: 'file:///p.jpg' });
  assert.equal(slide.kind, 'context');
  assert.match(slide.html, /NoCap DROPS <span class="accent">&quot;Heaven on Mars&quot;<\/span>|NoCap DROPS <span class="accent">"Heaven on Mars"<\/span>/);
  const full = { ...nocap, tracklist: Array.from({ length: MIN_TRACKLIST_SLIDE }, (_, i) => `Song ${i}`) };
  assert.equal(buildSlide2({ candidate: { text: 'x' }, classified: full }).kind, 'tracklist');
});

test('the tracklist title sizes itself to its band', () => {
  const out = buildTracklistHtml({ classified: { tracklist: ['a', 'b', 'c', 'd', 'e'], title: 'Heaven on Mars' } });
  assert.match(out, /title\.scrollHeight > title\.clientHeight/);
  assert.match(out, /createRange/);
});
