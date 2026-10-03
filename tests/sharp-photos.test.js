import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { imageSize } from '../src/util/imageSize.js';
import { getPhoto, upscaleNeeded, MAX_UPSCALE } from '../src/pipeline/3-get-photo.js';

function png(w, h) {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write('IHDR', 12);
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w, h) {
  // SOI, an APP0 segment, then SOF0 with height/width.
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
}
function webpVp8x(w, h) {
  const b = Buffer.alloc(32);
  b.write('RIFF', 0); b.write('WEBP', 8); b.write('VP8X', 12);
  b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3);
  return b;
}

test('image sizes are read from PNG, JPEG and WebP headers', () => {
  assert.deepEqual(imageSize(png(1200, 1500)), { width: 1200, height: 1500 });
  assert.deepEqual(imageSize(jpeg(640, 480)), { width: 640, height: 480 });
  assert.deepEqual(imageSize(webpVp8x(1000, 562)), { width: 1000, height: 562 });
  assert.equal(imageSize(Buffer.from('not an image at all, no')), null);
});

test('the sharpness rule rejects small photos and accepts Spotify-size ones', () => {
  assert.ok(upscaleNeeded({ width: 265, height: 265 }) > MAX_UPSCALE); // EsDeeKid 9/21
  assert.ok(upscaleNeeded({ width: 640, height: 640 }) <= MAX_UPSCALE);
  assert.ok(upscaleNeeded({ width: 1000, height: 562 }) <= MAX_UPSCALE);
  assert.equal(upscaleNeeded({}), Infinity);
});

function mockSources(t, { geniusImage, geniusHeader, spotify }) {
  config.genius.accessToken = 'g';
  config.spotify.clientId = 'id';
  config.spotify.clientSecret = 'secret';
  t.mock.method(globalThis, 'fetch', async (url) => {
    const body = (data) => new Response(JSON.stringify(data), { status: 200 });
    const u = String(url);
    if (u.includes('api.genius.com/search')) {
      return body({ response: { hits: [{ result: { primary_artist: { name: 'EsDeeKid', image_url: geniusImage, header_image_url: geniusHeader } } }] } });
    }
    if (u.includes('accounts.spotify.com')) return body({ access_token: 't', expires_in: 3600 });
    if (u.includes('api.spotify.com/v1/search')) {
      return body({ artists: { items: spotify ? [{ name: 'EsDeeKid', images: [spotify], external_urls: {} }] : [] } });
    }
    throw new Error(`unexpected ${u}`);
  });
}

test('a tiny Genius photo is skipped for the sharper Spotify one', async (t) => {
  mockSources(t, {
    geniusImage: 'https://images.genius.com/d04c.265x265x1.jpg',
    geniusHeader: 'https://images.genius.com/33cf.1000x562x1.webp',
    spotify: { url: 'https://i.scdn.co/image/esdee', width: 640, height: 640 },
  });
  assert.deepEqual(await getPhoto('EsDeeKid'), { ok: true, url: 'https://i.scdn.co/image/esdee', source: 'spotify' });
});

test('with no Spotify photo the large Genius header is used; nothing sharp means no photo', async (t) => {
  mockSources(t, { geniusImage: 'https://images.genius.com/a.265x265x1.jpg', geniusHeader: 'https://images.genius.com/b.1000x562x1.webp', spotify: null });
  assert.deepEqual(await getPhoto('EsDeeKid'), { ok: true, url: 'https://images.genius.com/b.1000x562x1.webp', source: 'genius-header' });
});

test('nothing sharp enough anywhere means the story is skipped, not posted blurry', async (t) => {
  mockSources(t, { geniusImage: 'https://images.genius.com/a.265x265x1.jpg', geniusHeader: null, spotify: { url: 'https://i.scdn.co/s', width: 160, height: 160 } });
  config.pinterest.connectedAccountId = '';
  config.composio.apiKey = '';
  assert.deepEqual(await getPhoto('EsDeeKid'), { ok: false });
});
