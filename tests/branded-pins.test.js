import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createPin } from '../src/clients/pinterest.js';
import { buildPinHtml, brandedImageOrUrl } from '../src/pins/render-pin.js';
import { buildAlbumPinText } from '../src/pin-post/2-post-pin.js';

config.composio.apiKey = 'test-key';

test('album pin text is keyword-rich and within Pinterest limits', () => {
  const text = buildAlbumPinText('slayr', { name: 'Fabula Nova', releaseDate: '2026-09-12' });
  assert.equal(text.title, 'Fabula Nova by slayr — Album Cover Art');
  assert.match(text.description, /^"Fabula Nova" by slayr \(2026\)\. Album cover art from the underground hip-hop scene/);
  assert.match(text.description, /underground rap/);
  assert.equal(text.altText, 'Album cover for "Fabula Nova" by slayr');
  assert.ok(text.description.length <= 800);
});

test('a branded pin uploads base64 JPEG; a plain pin still uses the URL; text is capped', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    sent.push(JSON.parse(init.body).arguments);
    return new Response(JSON.stringify({ data: { id: 'pin1' } }), { status: 200 });
  });
  await createPin({ boardId: '1', title: 'x'.repeat(150), description: 'd', altText: 'a', imageBase64: 'QUJD', imageUrl: 'https://ignored' });
  assert.deepEqual(sent[0].media_source, { source_type: 'image_base64', content_type: 'image/jpeg', data: 'QUJD' });
  assert.equal(sent[0].title.length, 100);
  assert.equal(sent[0].alt_text, 'a');
  await createPin({ boardId: '1', imageUrl: 'https://img/a.jpg' });
  assert.deepEqual(sent[1].media_source, { source_type: 'image_url', url: 'https://img/a.jpg' });
});

test('a render failure falls back to the raw image instead of losing the pin', async () => {
  const design = { imageUrl: 'https://img/a.jpg', kicker: 'ALBUM COVER', title: 'T', subtitle: 'BY A' };
  assert.deepEqual(await brandedImageOrUrl(design, async () => 'QUJD'), { imageBase64: 'QUJD', branded: true });
  assert.deepEqual(await brandedImageOrUrl(design, async () => { throw new Error('no chromium'); }), { imageUrl: 'https://img/a.jpg', branded: false });
});

test('pin template escapes text and shrinks long titles', () => {
  const html = buildPinHtml({ photoUrl: 'file:///tmp/p', kicker: 'HER UNDERGROUND', title: '<b>Pixy</b>', subtitle: 'UNDERGROUND RAPPER' });
  assert.match(html, /&lt;b&gt;Pixy&lt;\/b&gt;/);
  assert.match(html, /font-size: 112px/);
  assert.match(buildPinHtml({ photoUrl: '', kicker: '', title: 'Fabula Nova Deluxe', subtitle: '' }), /font-size: 88px/);
  assert.match(buildPinHtml({ photoUrl: '', kicker: '', title: 'A'.repeat(40), subtitle: '' }), /font-size: 50px/);
  assert.ok(!/\{\{/.test(html));
});
