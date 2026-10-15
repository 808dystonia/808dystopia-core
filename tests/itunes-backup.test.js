import test from 'node:test';
import assert from 'node:assert/strict';
import { getItunesAlbumInfo, getItunesArtistReleases, cleanReleaseName, bigArtwork } from '../src/clients/itunes.js';
import { getAlbumInfo, getArtistReleases, hasPlaceholderTracks } from '../src/clients/music.js';

// Shapes from the live API (10/04): two exact "NoCap" artists, one real.
function fakeItunes(url) {
  const u = new URL(url);
  const body = (results) => ({ ok: true, json: async () => ({ results }) });
  if (u.pathname === '/search') return body([{ artistId: 1, artistName: 'NoCap' }, { artistId: 2, artistName: 'NoCap' }, { artistId: 3, artistName: 'No Cap' }]);
  const id = u.searchParams.get('id');
  if (u.searchParams.get('entity') === 'album') {
    if (id === '1') return body([{ wrapperType: 'artist' },
      { wrapperType: 'collection', collectionId: 10, collectionName: 'Heaven on Mars', releaseDate: '2026-10-02T07:00:00Z', artworkUrl100: 'https://x/a.jpg/100x100bb.jpg', collectionViewUrl: 'https://music.apple.com/hom' },
      { wrapperType: 'collection', collectionId: 11, collectionName: 'Never Leave - Single', releaseDate: '2026-04-30T07:00:00Z', artworkUrl100: 'https://x/b.jpg/100x100bb.jpg' },
      { wrapperType: 'collection', collectionId: 12, collectionName: 'Still Having Problems (feat. NoCap) - Single', releaseDate: '2026-05-01T07:00:00Z', artworkUrl100: 'https://x/c.jpg/100x100bb.jpg' }]);
    return body([{ wrapperType: 'collection', collectionId: 20, collectionName: 'Roleta Russa - Single', releaseDate: '2023-05-08', artworkUrl100: 'https://x/d.jpg/100x100bb.jpg' }]);
  }
  if (id === '10') return body([{ wrapperType: 'collection' },
    { wrapperType: 'track', trackName: 'GPS', discNumber: 1, trackNumber: 2 },
    { wrapperType: 'track', trackName: 'Astronaut Tears', discNumber: 1, trackNumber: 1 }]);
  return body([]);
}

test('iTunes album info finds the right same-named artist, in track order, with big art', async () => {
  const info = await getItunesAlbumInfo('NoCap', 'Heaven on Mars', async (url) => fakeItunes(url));
  assert.deepEqual(info, { tracklist: ['Astronaut Tears', 'GPS'], albumArtUrl: 'https://x/a.jpg/1000x1000bb.jpg' });
  assert.deepEqual(await getItunesAlbumInfo('NoCap', 'Not An Album', async (url) => fakeItunes(url)), { tracklist: null, albumArtUrl: null });
});

test('iTunes catalog uses the real artist, newest first, without features or "- Single"', async () => {
  const releases = await getItunesArtistReleases('NoCap', async (url) => fakeItunes(url));
  assert.deepEqual(releases.map((r) => r.name), ['Heaven on Mars', 'Never Leave']);
  assert.equal(releases[0].spotifyUrl, 'https://music.apple.com/hom');
  assert.equal(cleanReleaseName('X - EP'), 'X');
  assert.equal(bigArtwork('https://x/y.jpg/100x100bb.jpg'), 'https://x/y.jpg/1000x1000bb.jpg');
});

test('a pre-release "Track N" placeholder list is not a confirmed tracklist', async () => {
  // Live 10/13: Apple served Young Nudy's unreleased "Just Doin Me" this way.
  const placeholders = ['Track 1', 'Track 2', 'Track 3', 'Who Dat Is', 'Track 5', 'Track 6'];
  assert.equal(hasPlaceholderTracks(placeholders), true);
  assert.equal(hasPlaceholderTracks(['GPS', 'Astronaut Tears', 'Track Star']), false);
  const itunes = async () => ({ tracklist: placeholders, albumArtUrl: 'apple-art' });
  // The list is dropped but the cover art stays, so the story falls back to the news slide.
  assert.deepEqual(await getAlbumInfo('Young Nudy', 'Just Doin Me', { spotify: async () => ({ tracklist: null, albumArtUrl: null }), itunes }), { tracklist: null, albumArtUrl: 'apple-art' });
  // A placeholder list from Spotify falls through to iTunes's real one.
  const real = async () => ({ tracklist: ['A', 'B', 'C', 'D', 'E'], albumArtUrl: 'apple-art' });
  assert.deepEqual(await getAlbumInfo('x', 'y', { spotify: async () => ({ tracklist: ['Track 1', 'Track 2'], albumArtUrl: 'spotify-art' }), itunes: real }), { tracklist: ['A', 'B', 'C', 'D', 'E'], albumArtUrl: 'apple-art' });
});

test('Spotify first; iTunes when Spotify refuses or has nothing', async () => {
  const itunes = async () => ({ tracklist: ['A', 'B', 'C', 'D', 'E'], albumArtUrl: 'apple-art' });
  const refused = async () => { throw new Error('spotify 403: Active premium subscription required for the owner of the app.'); };
  assert.deepEqual(await getAlbumInfo('NoCap', 'Heaven on Mars', { spotify: refused, itunes }), { tracklist: ['A', 'B', 'C', 'D', 'E'], albumArtUrl: 'apple-art' });
  const spotifyHit = async () => ({ tracklist: ['S'], albumArtUrl: 'spotify-art' });
  assert.deepEqual(await getAlbumInfo('x', 'y', { spotify: spotifyHit, itunes }), { tracklist: ['S'], albumArtUrl: 'spotify-art' });
  assert.deepEqual(await getArtistReleases('x', { spotify: refused, itunes: async () => [{ name: 'R' }] }), [{ name: 'R' }]);
  assert.deepEqual(await getArtistReleases('x', { spotify: async () => [{ name: 'S' }], itunes: async () => { throw new Error('no'); } }), [{ name: 'S' }]);
});
