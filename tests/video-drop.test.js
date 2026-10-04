import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isVideoDrop, songTitle, pickVideo, clipWindow, buildVideoClipSlide, CLIP_SECONDS } from '../src/pipeline/video-drop.js';
import { carouselClipFilters } from '../src/clients/ffmpeg.js';

test('video drops are spotted from the story or headline', () => {
  assert.equal(isVideoDrop({ candidate: { text: 'Young M.A revisits her roots in the deeply personal Therapy video' }, classified: {} }), true);
  assert.equal(isVideoDrop({ candidate: { text: 'x' }, classified: { headlineLine2: 'DROPS LATENCY VIDEO' } }), true);
  assert.equal(isVideoDrop({ candidate: { text: 'Pixy drops a new EP' }, classified: { headlineLine2: 'DROPS LEGACY' } }), false);
});

test('the word "video" is stripped from the song title', () => {
  assert.equal(songTitle('Therapy Video'), 'Therapy');
  assert.equal(songTitle('"Latency" Official Music Video'), 'Latency');
  assert.equal(songTitle('Latency'), 'Latency');
});

const now = Date.parse('2026-10-03T12:00:00Z');
const video = (over) => ({ privacyStatus: 'public', uploadStatus: 'processed', liveBroadcastContent: 'none', durationSeconds: 200, publishedAt: '2026-10-01T00:00:00Z', title: '', channelTitle: '', ...over });

test('only the new video by that artist with that song is picked', () => {
  const old = video({ videoId: 'old', title: 'Young M.A - Therapy (Official Video)', publishedAt: '2023-01-01T00:00:00Z' });
  const other = video({ videoId: 'other', title: 'Therapy - Some Other Artist' });
  const reaction = video({ videoId: 'short', title: 'Young M.A Therapy', durationSeconds: 30 });
  const right = video({ videoId: 'new', title: 'Therapy (Official Music Video)', channelTitle: 'Young M.A' });
  assert.equal(pickVideo([old, other, reaction, right], 'Young M.A', 'Therapy', now).videoId, 'new');
  assert.equal(pickVideo([old, other], 'Young M.A', 'Therapy', now), null);
});

test('the clip is 20s from about 30% in, always inside the video', () => {
  assert.deepEqual(clipWindow(200), { startSeconds: 60, endSeconds: 60 + CLIP_SECONDS });
  const short = clipWindow(50);
  assert.ok(short.startSeconds >= 5 && short.endSeconds <= 50);
});

test('the clip slide is drawn with NOW PLAYING and the song by artist', async () => {
  let opts;
  const out = await buildVideoClipSlide(
    { candidate: { text: 'Ras Kass drops Latency video' }, classified: { artist: 'Ras Kass', title: 'Latency' } },
    {
      find: async () => ({ url: 'https://youtu.be/x', durationSeconds: 240, title: 'Ras Kass - Latency', channelTitle: 'Ras Kass' }),
      download: async () => '/tmp/raw.mp4',
      format: async (input, wm, output, o) => { opts = o; },
    },
  );
  assert.ok(out.clipPath.endsWith('video-clip.mp4'));
  assert.equal(fs.readFileSync(opts.kickerFile, 'utf8'), 'NOW PLAYING');
  assert.deepEqual(opts.titleLineFiles.map((f) => fs.readFileSync(f, 'utf8')), ['"LATENCY" BY RAS KASS']);
  assert.equal(opts.maxSeconds, CLIP_SECONDS);
  assert.equal(carouselClipFilters(opts).length, 2);
});

test('non-video stories, no match, or a failed download all mean no clip slide', async () => {
  const story = { candidate: { text: 'Ras Kass drops Latency video' }, classified: { artist: 'Ras Kass', title: 'Latency' } };
  assert.equal(await buildVideoClipSlide({ candidate: { text: 'new EP' }, classified: { artist: 'A', title: 'B' } }, { find: async () => { throw new Error('should not search'); } }), null);
  assert.equal(await buildVideoClipSlide(story, { find: async () => null }), null);
  assert.equal(await buildVideoClipSlide(story, {
    find: async () => ({ url: 'u', durationSeconds: 200 }),
    download: async () => { throw new Error('Sign in to confirm you are not a bot'); },
  }), null);
});
