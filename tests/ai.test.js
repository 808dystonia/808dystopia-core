import test from 'node:test';
import assert from 'node:assert/strict';
import { createJsonGenerator } from '../src/clients/ai.js';
import { fetchJson } from '../src/clients/http.js';
const response = data => ({ ok: true, status: 200, json: async () => data });
test('OpenAI uses Responses structured schema, no storage, and handles reasoning before text', async () => {
  let body;
  const generate = createJsonGenerator({ provider: 'openai', apiKey: 'test', model: 'configured-model', fetchImpl: async (_, options) => {
    body = JSON.parse(options.body);
    return response({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"recommendations":["Test one change"]}' }] }] });
  } });
  assert.deepEqual(await generate('Evidence', 'recommendations'), { recommendations: ['Test one change'] });
  assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.model, 'configured-model');
});
test('AI rejects malformed fields, incomplete outputs, and refuses implicit provider fallback', async () => {
  const invalid = createJsonGenerator({ provider: 'deepseek', apiKey: 'test', fetchImpl: async () => response({ choices: [{ finish_reason: 'stop', message: { content: '{"recommendations":"wrong"}' } }] }) });
  await assert.rejects(invalid('Evidence', 'recommendations'), /array/);
  const incomplete = createJsonGenerator({ provider: 'openai', apiKey: 'test', model: 'test', fetchImpl: async () => response({ status: 'incomplete' }) });
  await assert.rejects(incomplete('Evidence', 'recommendations'), /incomplete/);
  await assert.rejects(createJsonGenerator({ provider: 'openai', apiKey: '' })('Evidence','recommendations'), /configured/);
});
test('AI call budget stops candidate loops', async () => {
  const generate = createJsonGenerator({ provider: 'deepseek', apiKey: 'test', maxCalls: 1, fetchImpl: async () => response({ choices: [{ finish_reason: 'stop', message: { content: '{"recommendations":[]}' } }] }) });
  await generate('Evidence', 'recommendations'); await assert.rejects(generate('Evidence', 'recommendations'), /budget/);
});
test('safe calls retry transient errors; publishing mutations never auto-retry', async () => {
  for (const retrySafe of [false, true]) {
    let calls = 0;
    const request = fetchJson('https://example.test', {}, { retrySafe, sleep: async () => {}, fetchImpl: async () => ++calls === 1 ? { ok: false, status: 503 } : response({ ok: true }) });
    if (retrySafe) { await request; assert.equal(calls, 2); } else { await assert.rejects(request); assert.equal(calls, 1); }
  }
});
