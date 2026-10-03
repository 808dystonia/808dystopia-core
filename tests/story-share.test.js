import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { shareToStory } from '../src/ops/story-share.js';
import { finishPost } from '../src/ops/followups.js';

config.composio.apiKey = 'test-key';
config.instagram.userId = '1784';

function mockInstagram(t, { createFails = false } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (url.endsWith('/INSTAGRAM_CREATE_MEDIA_CONTAINER')) {
      return createFails ? reply({ successful: false, error: { message: 'bad media' } }, 400) : reply({ data: { id: 'story-container' } });
    }
    if (url.endsWith('/INSTAGRAM_GET_POST_STATUS')) return reply({ data: { status_code: 'FINISHED' } });
    if (url.endsWith('/INSTAGRAM_CREATE_POST')) return reply({ data: { id: 'story-media' } });
    throw new Error(`unexpected ${url}`);
  });
  return calls;
}

test('story share is off unless its gate is set', async (t) => {
  const calls = mockInstagram(t);
  config.storySharePublish = false;
  assert.equal((await shareToStory({ imageUrl: 'https://x/slide1.png' })).status, 'disabled');
  assert.equal(calls.length, 0);
});

test('carousel slide and short Reel clip are posted as STORIES; long clips are skipped', async (t) => {
  const calls = mockInstagram(t);
  config.storySharePublish = true;

  assert.deepEqual(await shareToStory({ imageUrl: 'https://x/slide1.png' }), { status: 'posted', id: 'story-media' });
  assert.deepEqual(calls[0].body.arguments, { ig_user_id: '1784', image_url: 'https://x/slide1.png', media_type: 'STORIES' });

  assert.equal((await shareToStory({ videoUrl: 'https://x/reel.mp4', durationSeconds: 45 })).status, 'posted');
  assert.equal(calls.filter((c) => c.body.arguments?.video_url === 'https://x/reel.mp4').length, 1);

  const before = calls.length;
  assert.equal((await shareToStory({ videoUrl: 'https://x/reel.mp4', durationSeconds: 75 })).status, 'skipped');
  assert.equal(calls.length, before);
});

test('a Story failure is reported, never thrown', async (t) => {
  mockInstagram(t, { createFails: true });
  config.storySharePublish = true;
  const result = await shareToStory({ imageUrl: 'https://x/slide1.png' });
  assert.equal(result.status, 'failed');
});

test('story outcome is recorded; only a failure marks follow-ups failed', async () => {
  const base = { pipeline: 'carousel', result: { published: true, mediaId: '12', key: 'k' },
    comment: async () => {}, log: async () => ({}), facebook: async () => ({ published: true, postId: 'fb' }), save: async () => {} };
  for (const [status, failed] of [['posted', false], ['skipped', false], ['disabled', false], ['failed', true]]) {
    const report = await finishPost({ ...base, story: async () => ({ status, ...(status === 'posted' ? { id: 's1' } : {}) }) });
    assert.equal(report.outcomes.story.status, status);
    assert.equal(report.followupFailed, failed);
  }
  // A thrown story step still leaves the IG post recorded as posted.
  const thrown = await finishPost({ ...base, story: async () => { throw new Error('boom'); } });
  assert.equal(thrown.outcomes.instagram.status, 'posted');
  assert.equal(thrown.outcomes.story.status, 'failed');
  // Pipelines without a story step don't get one.
  assert.equal((await finishPost(base)).outcomes.story, undefined);
});
