import test from 'node:test';
import assert from 'node:assert/strict';
import { isArtistMusicVideo, isSearchableName, findVideo } from '../src/reels/2-find-video.js';
import { buildReelCaption, cleanQuote } from '../src/reels/5-build-caption.js';

const video = (fields) => ({ title: '', channelTitle: '', tags: [], categoryId: '22', ...fields });

test('wrong-artist matches from live runs are rejected', () => {
  // "SouthWes" returned job-interview tips; "Caneva" a Canva talk.
  assert.equal(isArtistMusicVideo(video({ title: 'Top 10 Job Interview Tips', channelTitle: 'CareerVidz' }), 'SouthWes'), false);
  assert.equal(isArtistMusicVideo(video({ title: 'Canva Create keynote: the future of design', channelTitle: 'Canva' }), 'Caneva'), false);
  // Names the artist but isn't music.
  assert.equal(isArtistMusicVideo(video({ title: 'Pixy the cat learns tricks', channelTitle: 'Pet Life' }), 'Pixy'), false);
});

test('short ambiguous names are never searched', () => {
  assert.equal(isSearchableName('OK'), false);
  assert.equal(isSearchableName('Rok'), false);
  assert.equal(isSearchableName('Pixy'), true);
  assert.equal(isArtistMusicVideo(video({ title: 'OK freestyle', categoryId: '10' }), 'OK'), false);
});

test('real artist music videos pass by title, channel, tags or Music category', () => {
  assert.equal(isArtistMusicVideo(video({ title: 'SouthWes - Freestyle (Official Video)' }), 'SouthWes'), true);
  assert.equal(isArtistMusicVideo(video({ title: 'Live at The Echo', channelTitle: 'SouthWesMusic', categoryId: '10' }), 'SouthWes'), true);
  assert.equal(isArtistMusicVideo(video({ title: 'Bby Kell in the studio', tags: ['plugg'] }), 'Bby Kell'), true);
  // Substring of another word doesn't count.
  assert.equal(isArtistMusicVideo(video({ title: 'Pixyland rap cypher' }), 'Pixy'), false);
});

test('findVideo skips short names without calling YouTube', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('should not fetch'); });
  assert.equal(await findVideo('OK'), null);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('caption leads with the cleaned quote and never uses the AI reason', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const { caption } = await buildReelCaption({
    artist: 'SouthWes', contentType: 'interview', channelTitle: 'No Jumper', source: 'youtube',
    highlight: { quote: '  "I made that beat\n in my  mom\'s basement"  ', reason: 'This is a self-contained, quotable moment.' },
  });
  const lines = caption.split('\n\n');
  assert.equal(lines[0], '“I made that beat in my mom\'s basement”');
  assert.equal(lines[1], '— SouthWes, in an interview · 🎥 via No Jumper (YouTube)');
  assert.ok(!caption.includes('self-contained'));
});

test('caption without a quote falls back to the artist, and long quotes are cut', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const { caption } = await buildReelCaption({ artist: 'Pixy', contentType: 'performance', source: 'twitch', highlight: { quote: '', reason: 'x' } });
  assert.ok(caption.startsWith('🎤 Pixy\n\n— Pixy, live · 🎥 via Twitch (Twitch)'));

  const long = cleanQuote('word '.repeat(80));
  assert.ok(long.length <= 221 && long.endsWith('…') && !long.includes('  '));
});
