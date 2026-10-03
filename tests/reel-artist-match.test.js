import test from 'node:test';
import assert from 'node:assert/strict';
import { isArtistMusicVideo, isSearchableName, isOwnChannel, classifyVideo, findVideo } from '../src/reels/2-find-video.js';
import { config } from '../src/config.js';
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

test('tutorials, type beats and reactions are classified as about the artist', () => {
  // Live 10/03: posted as if it were bleood, with a collab invite.
  assert.deepEqual(classifyVideo('How To Make GYGJFACB Type Beats For BLEOOD! (FREE DRUMKIT)', 'beat breakdown'), { contentType: 'type beat tutorial', relation: 'about' });
  assert.deepEqual(classifyVideo('Reacting to bleood for the first time', 'interview'), { contentType: 'reaction', relation: 'about' });
  assert.deepEqual(classifyVideo('bleood interview: haunted hills', 'interview'), { contentType: 'interview', relation: 'featuring' });
  assert.deepEqual(classifyVideo('bleood - haunted hills (live in London)', 'freestyle'), { contentType: 'performance', relation: 'featuring' });
  // On the artist's own channel even a tutorial is by them.
  assert.deepEqual(classifyVideo('my drumkit tutorial', null, true), { contentType: 'type beat tutorial', relation: 'by' });
  assert.deepEqual(classifyVideo('bleood - new song', null, true), { contentType: 'music video', relation: 'by' });
});

test('own channel means named like the artist, never a Topic channel or a lookalike', () => {
  for (const name of ['bleood', 'bleoodMusic', 'bleood VEVO', 'Official bleood', 'BLEOOD']) assert.equal(isOwnChannel(name, 'bleood'), true, name);
  for (const name of ['bleood - Topic', 'bleood fan edits', 'Beats By Ricky', 'bleoodlover']) assert.equal(isOwnChannel(name, 'bleood'), false, name);
});

function mockYouTube(t, { channels, uploads, details, searchResults = [] }) {
  config.youtube.apiKey = 'test';
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url));
    const u = new URL(url);
    const body = (data) => new Response(JSON.stringify(data), { status: 200 });
    if (u.pathname.endsWith('/search') && u.searchParams.get('type') === 'channel') {
      return body({ items: channels.map((title, i) => ({ id: { channelId: `UC${i}abc` }, snippet: { channelTitle: title } })) });
    }
    if (u.pathname.endsWith('/playlistItems')) return body({ items: uploads.map((videoId) => ({ contentDetails: { videoId } })) });
    if (u.pathname.endsWith('/search')) return body({ items: searchResults.map((videoId) => ({ id: { videoId }, snippet: { title: '', channelTitle: '' } })) });
    if (u.pathname.endsWith('/videos')) {
      const ids = u.searchParams.get('id').split(',');
      return body({ items: ids.map((id) => details[id]).filter(Boolean).map((d) => ({
        id: d.id, contentDetails: { duration: d.duration || 'PT3M' },
        snippet: { title: d.title, channelTitle: d.channel, categoryId: '10', liveBroadcastContent: 'none', tags: [] },
        status: { uploadStatus: 'processed', privacyStatus: 'public', embeddable: true },
      })) });
    }
    return new Response('{}', { status: 404 });
  });
  return urls;
}

test('findVideo prefers the artist\'s own uploads, skipping used ones', async (t) => {
  const urls = mockYouTube(t, {
    channels: ['bleood fan edits', 'bleood'],
    uploads: ['v1', 'v2', 'v3'],
    details: {
      v1: { id: 'v1', title: 'bleood - old hit', channel: 'bleood' },
      v2: { id: 'v2', title: 'bleood - short teaser', channel: 'bleood', duration: 'PT20S' },
      v3: { id: 'v3', title: 'bleood - haunted hills (live)', channel: 'bleood' },
    },
  });
  const found = await findVideo('bleood', (id) => id === 'v1');
  assert.equal(found.videoId, 'v3');
  assert.equal(found.contentType, 'performance');
  assert.equal(found.relation, 'by');
  assert.ok(urls.some((u) => u.includes('playlistId=UU1abc')));
});

test('with no own channel it falls back to search and labels what it finds', async (t) => {
  mockYouTube(t, {
    channels: ['Beats By Ricky'],
    uploads: [],
    searchResults: ['tut', 'int'],
    details: {
      tut: { id: 'tut', title: 'How To Make Type Beats For BLEOOD!', channel: 'Beats By Ricky' },
      int: { id: 'int', title: 'bleood interview: haunted hills and the UK scene', channel: 'No Jumper' },
    },
  });
  // The interview beats the higher-ranked tutorial...
  const found = await findVideo('bleood');
  assert.equal(found.videoId, 'int');
  assert.equal(found.relation, 'featuring');
  // ...and the tutorial is used, labelled, once the interview is posted.
  const fallback = await findVideo('bleood', (id) => id === 'int');
  assert.equal(fallback.videoId, 'tut');
  assert.equal(fallback.contentType, 'type beat tutorial');
  assert.equal(fallback.relation, 'about');
});

test('an about-the-artist caption says what it is, credits the creator, and sends no collab', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const { caption, collaborator, hashtags } = await buildReelCaption({
    artist: 'bleood', contentType: 'type beat tutorial', relation: 'about', channelTitle: 'Beats By Ricky',
    highlight: { quote: 'start with a detuned 808 and keep the hats sparse' },
  });
  const lines = caption.split('\n\n');
  assert.match(lines[0], /^🎛 Type beat tutorial: a producer breaks down how to make beats in the style of bleood\.$/);
  assert.equal(lines[1], '“start with a detuned 808 and keep the hats sparse” — Beats By Ricky');
  assert.equal(lines[2], "🎥 via Beats By Ricky (YouTube) · not bleood's own upload");
  assert.equal(collaborator, null);
  assert.match(hashtags, /#typebeat/);
});
