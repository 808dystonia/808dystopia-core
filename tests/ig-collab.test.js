import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import {
  collaboratorHandle, createReadyContainer, createCollabReelContainer, createReelContainer,
} from '../src/clients/instagram.js';

config.composio.apiKey = 'test-key';
config.instagram.userId = '1784';

// Routes Composio calls: the Graph proxy (collab containers), the wrapped
// container tool (plain containers), and status polling (always FINISHED).
function mockComposio(t, { proxy }) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (url.endsWith('/proxy')) return proxy(body, reply);
    if (url.endsWith('/INSTAGRAM_GET_POST_STATUS')) return reply({ data: { status_code: 'FINISHED' } });
    if (url.endsWith('/INSTAGRAM_CREATE_MEDIA_CONTAINER')) return reply({ data: { id: 'plain-1' } });
    throw new Error(`unexpected ${url}`);
  });
  return calls;
}

const reelArgs = (collaborator) => ({
  label: 'reel', collaborator,
  withCollaborator: (collaborators) => createCollabReelContainer('https://x/clip.mp4', 'cap', collaborators),
  plain: () => createReelContainer('https://x/clip.mp4', 'cap'),
});

test('only plain IG usernames become collaborators, never our own account', () => {
  assert.equal(collaboratorHandle('@ledbyher'), 'ledbyher');
  assert.equal(collaboratorHandle('slayr.official'), 'slayr.official');
  assert.equal(collaboratorHandle('https://instagram.com/x'), null);
  assert.equal(collaboratorHandle('two words'), null);
  assert.equal(collaboratorHandle('808Dystopia'), null);
  assert.equal(collaboratorHandle(null), null);
});

test('a Reel with a handle is created through the Graph proxy with collaborators', async (t) => {
  const calls = mockComposio(t, { proxy: (_, reply) => reply({ data: { id: 'collab-1' } }) });
  const result = await createReadyContainer(reelArgs('@ledbyher'));
  assert.deepEqual(result, { containerId: 'collab-1', collaborator: 'ledbyher' });
  const proxyCall = calls.find((c) => c.url.endsWith('/proxy'));
  assert.equal(proxyCall.body.endpoint, '/1784/media');
  assert.deepEqual(proxyCall.body.body, { media_type: 'REELS', video_url: 'https://x/clip.mp4', caption: 'cap', collaborators: ['ledbyher'] });
  assert.ok(!calls.some((c) => c.url.endsWith('/INSTAGRAM_CREATE_MEDIA_CONTAINER')));
});

test('a rejected collaborator falls back to the plain container', async (t) => {
  const calls = mockComposio(t, {
    proxy: (_, reply) => reply({ successful: false, error: { message: 'collaborator account is private' } }, 400),
  });
  const result = await createReadyContainer(reelArgs('privateartist'));
  assert.deepEqual(result, { containerId: 'plain-1', collaborator: null });
  assert.equal(calls.filter((c) => c.url.endsWith('/INSTAGRAM_CREATE_MEDIA_CONTAINER')).length, 1);
});

test('a proxy reply without an id also falls back; no handle skips the proxy', async (t) => {
  const calls = mockComposio(t, { proxy: (_, reply) => reply({ data: { error: { message: 'Invalid parameter' } } }) });
  assert.equal((await createReadyContainer(reelArgs('someartist'))).containerId, 'plain-1');
  const before = calls.filter((c) => c.url.endsWith('/proxy')).length;
  assert.equal((await createReadyContainer(reelArgs(null))).containerId, 'plain-1');
  assert.equal(calls.filter((c) => c.url.endsWith('/proxy')).length, before);
});
