import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTvBoardByGender } from '../src/clients/discord.js';
import { onCooldown, eligibleArtists } from '../src/artist-pins/1-get-candidates.js';
import { mentionsArtist, pickWebPhoto, pickDropPhoto, findPhoto, loadDropPins } from '../src/artist-pins/2-find-photo.js';
import { postArtistPin, buildPinText } from '../src/artist-pins/3-post-pin.js';

// Shapes copied from Grok's live 808 TV board (9/27), trimmed.
const rappers = { content: '**808 TV // UNDERGROUND HEAT** — Sunday 9/27 CT\n**RAPPERS**\n**MALE**\n1. bleood — *haunted hills* dropped mid-Sep\n2. fakemink — UK UG still orbiting\n**FEMALE**\n1. Ledbyher — Norfolk/UK jerk\n2. Pixy — UK Ug, "Legacy"' };
const producers = { content: '**PRODUCERS**\n**MALE**\n1. Undercover — dark plugg engine\n2. Cppo / Toom — on the Omens run\n**FEMALE**\nnone I can lock with a last-7-day placement without guessing. not padding.\n\nFollow @808dystopia · more on 808dystopia.win' };
const unlabelled = { content: '**RAPPERS**\n1. EsDeeKid — tour mid-run\n2. TiaCorine — XXL list' };

test('board is split only by explicit MALE/FEMALE labels, with role from the section', () => {
  const { male, female } = parseTvBoardByGender([rappers, producers, unlabelled]);
  assert.deepEqual(male.map(x => x.name), ['bleood', 'fakemink', 'Undercover', 'Cppo', 'Toom']);
  assert.deepEqual(female.map(x => x.name), ['Ledbyher', 'Pixy']);
  assert.equal(male.find(x => x.name === 'Undercover').role, 'producer');
  assert.equal(female[0].role, 'rapper');
  // Old unlabelled format and prose lines contribute nobody.
  assert.ok(![...male, ...female].some(x => ['EsDeeKid', 'TiaCorine'].includes(x.name)));
});

test('a name listed under both labels is dropped rather than guessed', () => {
  const both = { content: '**RAPPERS**\n**MALE**\n1. Sam — x\n**FEMALE**\n1. sam — y\n2. Pixy — z' };
  const { male, female } = parseTvBoardByGender([both]);
  assert.deepEqual(male, []);
  assert.deepEqual(female.map(x => x.name), ['Pixy']);
});

test('recent or pending pins put an artist on cooldown; old ones do not', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  const posts = {
    a: { artist: 'Pixy', startedAt: '2026-09-24T12:00:00Z', status: 'posted' },
    b: { artist: 'Ledbyher', startedAt: '2026-09-19T12:00:00Z', status: 'posted' },
    c: { artist: 'Bby Kell', startedAt: '2026-09-27T11:00:00Z', status: 'pending' },
  };
  assert.equal(onCooldown('pixy', posts, now), true);
  assert.equal(onCooldown('Ledbyher', posts, now), false);
  const pool = ['Pixy', 'Ledbyher', 'Bby Kell', 'skaiwater'].map(name => ({ name, role: 'rapper' }));
  assert.deepEqual(eligibleArtists(pool, posts, now).map(x => x.name).sort(), ['Ledbyher', 'skaiwater']);
});

test('artist name must appear as whole words, not inside other words', () => {
  assert.equal(mentionsArtist('Pixy', 'PIXY live at Koko'), true);
  assert.equal(mentionsArtist('Pixy', 'https://dazed.com/music/pixy-legacy-interview'), true);
  assert.equal(mentionsArtist('Bby Kell', 'bbykell backstage'), true);
  assert.equal(mentionsArtist('Bby Kell', 'Bby Kell in ATL'), true);
  assert.equal(mentionsArtist('Pixy', 'Pixyland wallpapers'), false);
  assert.equal(mentionsArtist('Che', 'che live', 4), false);
});

const web = (over = {}) => ({ imageUrl: 'https://img.example/a.jpg', width: 1200, height: 1500, title: 'Pixy live in London', pageUrl: 'https://dazed.com/pixy', ...over });

test('web photo must name the artist, be large, stable, and unused; portrait preferred', () => {
  assert.equal(pickWebPhoto('Pixy', [web({ title: 'Pixie haircut ideas', pageUrl: 'https://hair.example/cuts' })], new Set()), null);
  assert.equal(pickWebPhoto('Pixy', [web({ width: 400, height: 500 })], new Set()), null);
  assert.equal(pickWebPhoto('Pixy', [web({ width: null, height: null })], new Set()), null);
  assert.equal(pickWebPhoto('Pixy', [web({ imageUrl: 'https://scontent.cdninstagram.com/x.jpg' })], new Set()), null);
  assert.equal(pickWebPhoto('Pixy', [web()], new Set(['https://img.example/a.jpg'])), null);
  const wide = web({ imageUrl: 'https://img.example/wide.jpg', width: 1600, height: 900 });
  const tall = web({ imageUrl: 'https://img.example/tall.jpg' });
  assert.equal(pickWebPhoto('Pixy', [wide, tall], new Set()).imageUrl, 'https://img.example/tall.jpg');
});

test('hand-picked drop-board photo wins, matched on the name in its text', () => {
  const pins = [
    { imageUrl: 'https://i.pinimg.com/other.jpg', text: 'Ledbyher at Boiler Room', width: 1200, height: 1600 },
    { imageUrl: 'https://i.pinimg.com/pixy.jpg', text: 'pixy', width: 1200, height: 1600, link: 'https://www.dazed.com/pixy' },
  ];
  assert.equal(pickDropPhoto('Pixy', pins, new Set()).imageUrl, 'https://i.pinimg.com/pixy.jpg');
});

test('photo sources are tried in order and failures fall through', async () => {
  const calls = [];
  const deps = {
    searchImages: async () => { calls.push('web'); throw new Error('search down'); },
    getArtistProfile: async () => { calls.push('spotify'); return { spotifyUrl: 'https://open.spotify.com/artist/1', imageUrl: 'https://i.scdn.co/p.jpg', width: 640, height: 640 }; },
    getArtistPhoto: async () => { calls.push('genius'); return 'https://images.genius.com/g.jpg'; },
  };
  const photo = await findPhoto({ name: 'Pixy', role: 'rapper' }, new Set(), [], deps);
  assert.equal(photo.source, 'spotify');
  assert.equal(photo.spotifyUrl, 'https://open.spotify.com/artist/1');
  assert.ok(!calls.includes('genius'));

  const drop = await findPhoto({ name: 'Pixy', role: 'rapper' }, new Set(), [{ imageUrl: 'https://i.pinimg.com/pixy.jpg', text: 'Pixy', link: 'https://www.dazed.com/x' }], deps);
  assert.equal(drop.source, 'photo-drop');
  assert.equal(drop.credit, 'dazed.com');

  const none = await findPhoto({ name: 'Nobody', role: 'rapper' }, new Set(['https://images.genius.com/g.jpg']), [], {
    searchImages: async () => [], getArtistProfile: async () => null, getArtistPhoto: async () => 'https://images.genius.com/g.jpg',
  });
  assert.equal(none, null);
  assert.deepEqual(await loadDropPins(async () => { throw new Error('boom'); }), []);
});

test('pin text credits the photo and links Spotify; publish gate off is a dry run', async () => {
  const photo = { imageUrl: 'https://img.example/a.jpg', source: 'web', credit: 'dazed.com', sourceUrl: 'https://dazed.com/pixy', spotifyUrl: 'https://open.spotify.com/artist/1' };
  const text = buildPinText({ name: 'Pixy', role: 'rapper' }, photo, 'female');
  assert.equal(text.title, 'Pixy — Underground Rapper | Her Underground');
  assert.match(text.description, /female rappers and producers to know/);
  assert.equal(text.altText, 'Photo of Pixy, underground rapper');
  assert.match(text.description, /Photo: dazed\.com/);
  assert.equal(text.link, 'https://open.spotify.com/artist/1');
  let pinned = 0;
  const report = await postArtistPin('female', { name: 'Pixy', role: 'rapper' }, photo, async () => { pinned++; });
  assert.match(report.note, /off.*dry run/);
  assert.equal(pinned, 0);
  assert.equal((await postArtistPin('male', null, null)).published, false);
});

test('short ambiguous names only use a hand-picked Photo Drop photo', async () => {
  let looked = 0;
  const deps = { searchImages: async () => { looked++; return []; }, getArtistProfile: async () => { looked++; return { imageUrl: 'https://i.scdn.co/x.jpg', width: 640, height: 640 }; }, getArtistPhoto: async () => { looked++; return 'g.jpg'; } };
  assert.equal(await findPhoto({ name: 'OK', role: 'producer' }, new Set(), [], deps), null);
  assert.equal(looked, 0);
  const drop = await findPhoto({ name: 'OK', role: 'producer' }, new Set(), [{ imageUrl: 'https://i.pinimg.com/ok.jpg', text: 'OK producer', link: null }], deps);
  assert.equal(drop.source, 'photo-drop');
  assert.equal(drop.spotifyUrl, null);
  assert.equal(looked, 0);
});
