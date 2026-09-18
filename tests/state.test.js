import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateStore } from '../src/ops/state.js';
import { publishOnce } from '../src/ops/publishing.js';
test('GitHub SHA compare-and-swap permits only one concurrent publisher', async () => {
  let file = null, revision = 0, posts = 0;
  const fetchImpl = async (url, options) => {
    const ok = data => new Response(JSON.stringify(data), { status: 200 });
    if (url.includes('git/ref/heads/')) return ok({ object: { sha: 'main' } });
    if (options.method === 'GET') return file ? ok({ sha: String(revision), content: file }) : new Response('{}', { status: 404 });
    const body = JSON.parse(options.body);
    if (body.sha !== (revision ? String(revision) : undefined)) return new Response('{}', { status: 409 });
    file = body.content; revision++; return ok({});
  };
  const store = createStateStore({ token: 'test', fetchImpl });
  const publish = () => publishOnce({ pipeline: 'reel', platform: 'instagram', identity: 'one-video', store,
    publish: async () => { posts++; return { published: true, mediaId: '123' }; } });
  const results = await Promise.allSettled([publish(), publish()]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(posts, 1);
  assert.equal(Object.values((await store.read('reel')).value.posts)[0].id, '123');
});
test('state permission errors fail closed; no empty-state fallback except 404', async () => {
  const store = createStateStore({ token: 'test', fetchImpl: async () => new Response('{}', { status: 403 }) });
  await assert.rejects(store.read('reel'), /403/);
  let called = false;
  await assert.rejects(publishOnce({ pipeline: 'reel', platform: 'instagram', identity: 'x', store,
    publish: async () => { called = true; } }));
  assert.equal(called, false);
});
