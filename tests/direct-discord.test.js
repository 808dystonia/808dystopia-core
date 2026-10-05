import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { listChannelMessages, postMessage } from '../src/clients/discord.js';

test('direct Discord preserves source messages and sorts newest first', async (t) => {
  const previous = config.discord.botToken;
  config.discord.botToken = 'test-token';
  t.after(() => { config.discord.botToken = previous; });
  const messages = [
    { id: '1', timestamp: '2026-10-05T12:00:00Z', author: { id: 'grok' }, embeds: [{ description: 'story' }] },
    { id: '2', timestamp: '2026-10-05T13:00:00Z', content: 'watchlist' },
  ];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(String(url), 'https://discord.com/api/v10/channels/123/messages?limit=25');
    assert.equal(init.headers.Authorization, 'Bot test-token');
    return { ok: true, json: async () => messages };
  });
  assert.deepEqual(await listChannelMessages('123'), [messages[1], messages[0]]);
});

test('unconfigured direct bot retains Composio routing', async (t) => {
  const previous = { token: config.discord.botToken, key: config.composio.apiKey };
  config.discord.botToken = '';
  config.composio.apiKey = 'test-composio';
  t.after(() => { config.discord.botToken = previous.token; config.composio.apiKey = previous.key; });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.match(String(url), /tools\/execute\/DISCORDBOT_LIST_MESSAGES$/);
    assert.deepEqual(JSON.parse(init.body).arguments, { channel_id: '123', limit: 25 });
    return { ok: true, json: async () => ({ data: { details: [] } }) };
  });
  assert.deepEqual(await listChannelMessages('123'), []);
});

test('direct writes send once, disable unsolicited mentions, and preserve result shape', async (t) => {
  const previous = config.discord.botToken;
  config.discord.botToken = 'test-token';
  t.after(() => { config.discord.botToken = previous; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { content: '@everyone digest', allowed_mentions: { parse: [] } });
    return { ok: true, json: async () => ({ id: '456' }) };
  });
  assert.deepEqual(await postMessage('123', { content: '@everyone digest' }), { details: { id: '456' } });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('Discord failures never retry, switch providers, or expose the token', async (t) => {
  const previous = config.discord.botToken;
  config.discord.botToken = 'secret-test-token';
  t.after(() => { config.discord.botToken = previous; });
  for (const response of [
    { ok: false, status: 403, json: async () => ({ code: 50001, message: 'secret-test-token' }) },
    { ok: false, status: 429, json: async () => ({ retry_after: 2 }) },
    { ok: true, json: async () => ({ unexpected: true }) },
    new Error('secret-test-token'),
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    await assert.rejects(postMessage('123', { content: 'digest' }), (error) => {
      assert.match(error.message, /no retry attempted/);
      assert.equal(error.message.includes('secret-test-token'), false);
      return true;
    });
    assert.equal(mock.mock.callCount(), 1);
    mock.mock.restore();
  }
});

test('invalid message responses and limits fail visibly', async (t) => {
  const previous = config.discord.botToken;
  config.discord.botToken = 'test-token';
  t.after(() => { config.discord.botToken = previous; });
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ details: [] }) }));
  await assert.rejects(listChannelMessages('123'), /Invalid Discord GET response/);
  for (const limit of [0, 101, 1.5]) await assert.rejects(listChannelMessages('123', limit), /limit/);
  await assert.rejects(listChannelMessages('bad/id'), /Invalid Discord channel/);
  assert.equal(mock.mock.callCount(), 1);
});
