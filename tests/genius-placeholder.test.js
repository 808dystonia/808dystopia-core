import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { isPlaceholderAvatar } from '../src/clients/genius.js';
import { getPhoto } from '../src/pipeline/3-get-photo.js';

test('every Genius placeholder is rejected, real photos are not', () => {
  // 9/18: Riconoflow's carousel cover was default_cover_image.png (the grey Genius logo).
  for (const url of [
    'https://assets.genius.com/images/default_cover_image.png',
    'https://assets.genius.com/images/default_avatar_300.png?1727000000',
    'https://assets.genius.com/images/default_banner.png',
    'http://assets.genius.com/images/sharing_fallback.png',
    '',
    null,
  ]) assert.equal(isPlaceholderAvatar(url), true, String(url));
  assert.equal(isPlaceholderAvatar('https://images.genius.com/57a32de14e2e45bb45e5e5d80cc58168.1000x1000x1.jpg'), false);
});

test('a Genius placeholder falls through to the Spotify profile photo', async (t) => {
  config.genius.accessToken = 'g';
  config.spotify.clientId = 'id';
  config.spotify.clientSecret = 'secret';
  t.mock.method(globalThis, 'fetch', async (url) => {
    const body = (data) => new Response(JSON.stringify(data), { status: 200 });
    if (String(url).includes('api.genius.com/search')) {
      return body({ response: { hits: [{ result: { primary_artist: { name: 'Riconoflow', image_url: 'https://assets.genius.com/images/default_cover_image.png' } } }] } });
    }
    if (String(url).includes('accounts.spotify.com')) return body({ access_token: 't', expires_in: 3600 });
    if (String(url).includes('api.spotify.com/v1/search')) {
      return body({ artists: { items: [{ name: 'Riconoflow', images: [{ url: 'https://i.scdn.co/image/ricono', width: 640, height: 640 }], external_urls: { spotify: 'https://open.spotify.com/artist/x' } }] } });
    }
    throw new Error(`unexpected ${url}`);
  });
  assert.deepEqual(await getPhoto('Riconoflow'), { ok: true, url: 'https://i.scdn.co/image/ricono', source: 'spotify' });
});
