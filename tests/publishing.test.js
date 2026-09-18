import test from 'node:test';
import assert from 'node:assert/strict';
import { publishOnce, contentKey } from '../src/ops/publishing.js';
import { finishPost } from '../src/ops/followups.js';
import { outcomeStatus, runManaged } from '../src/ops/run.js';
function memory() { const state = { posts: {}, slots: {} }; return { state, read: async () => ({ value: state }), update: async (_, fn) => fn(state) }; }
test('receipt persists before follow-ups; failed log/comment cannot repost', async () => {
  const store = memory(); let publishes = 0;
  const args = { pipeline: 'carousel', platform: 'instagram', identity: 'story', store,
    publish: async () => { publishes++; return { published: true, mediaId: '123' }; } };
  const result = await publishOnce(args);
  assert.equal(store.state.posts[contentKey('story')].id, '123');
  let facebookCalls = 0;
  const report = await finishPost({ pipeline: 'carousel', result,
    comment: async () => { throw new Error('comment failed'); }, log: async () => { throw new Error('Sheets failed'); },
    facebook: async () => { facebookCalls++; return { published: true, postId: 'fb1' }; }, save: async () => {} });
  assert.equal(report.published, true); assert.equal(report.followupFailed, true); assert.equal(facebookCalls, 1);
  assert.equal(outcomeStatus(report), 'partial');
  await assert.rejects(publishOnce(args), /already claimed/); assert.equal(publishes, 1);
});
test('uncertain publish and failed receipt write both retain blocking claim', async () => {
  for (const receiptFailure of [false, true]) {
    const store = memory(); const update = store.update; let writes = 0, posts = 0;
    store.update = async (...args) => { if (++writes === 2 && receiptFailure) throw new Error('state write failed'); return update(...args); };
    const args = { pipeline: 'reel', identity: 'clip', platform: 'instagram', store, publish: async () => {
      posts++; if (!receiptFailure) throw new Error('ambiguous timeout'); return { published: true, mediaId: '456' };
    } };
    await assert.rejects(publishOnce(args));
    assert.equal(store.state.posts[contentKey('clip')].status, 'pending');
    await assert.rejects(publishOnce(args), /already claimed/); assert.equal(posts, 1);
  }
});
test('no confirmed ID cannot be considered success', async () => {
  const store = memory(); await assert.rejects(publishOnce({ pipeline: 'pin', platform: 'pinterest', identity: 'album', store,
    publish: async () => ({ published: true }) }), /post ID/);
});
test('Facebook failure does not remove Instagram success; disabled is not failed', async () => {
  for (const status of ['failed', 'disabled']) {
    const report = await finishPost({ pipeline: 'reel', result: { published: true, mediaId: '12', key: 'x' },
      comment: async () => {}, log: async () => ({ status: 'posted' }), facebook: async () => ({ published: false, status }), save: async () => {} });
    assert.equal(report.outcomes.instagram.status, 'posted'); assert.equal(report.followupFailed, status === 'failed');
  }
});
test('managed slot is not executed twice, even across manual code reruns', async () => {
  const prior = { ...process.env }; const store = memory(); let calls = 0;
  try {
    process.env.OPS_STATE_ENABLED = '1'; process.env.GITHUB_REF = 'refs/heads/main'; delete process.env.OPS_SLOT;
    const options = { store, now: new Date('2026-09-18T14:17:00Z'), event: 'schedule' };
    await runManaged('carousel', async () => { calls++; return { status: 'posted' }; }, options);
    await runManaged('carousel', async () => { calls++; return { status: 'posted' }; }, options);
    assert.equal(calls, 1);
  } finally { process.env = prior; }
});
