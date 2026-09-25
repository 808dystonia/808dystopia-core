import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrReviewer } from '../src/ops/dev-bot/pr-review.js';

function fakeFetch(handlers) {
  return async (url, opts) => {
    const path = new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\//, '');
    for (const [pattern, respond] of handlers) {
      if (pattern.test(path)) return respond(JSON.parse(opts.body));
    }
    throw new Error(`Unhandled fake fetch path: ${path}`);
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('approve posts an APPROVE review with a no-merge-authority note', async () => {
  const calls = [];
  const fetchImpl = fakeFetch([[/^pulls\/84\/reviews$/, (body) => { calls.push(body); return jsonResponse(200, {}); }]]);
  const reviewer = createPrReviewer({ token: 'tok', fetchImpl });
  await reviewer.approve(84);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].event, 'APPROVE');
  assert.match(calls[0].body, /no merge authority/);
});

test('requestChanges posts a REQUEST_CHANGES review including the given reason', async () => {
  const calls = [];
  const fetchImpl = fakeFetch([[/^pulls\/84\/reviews$/, (body) => { calls.push(body); return jsonResponse(200, {}); }]]);
  const reviewer = createPrReviewer({ token: 'tok', fetchImpl });
  await reviewer.requestChanges(84, 'Needs tests for the DST edge case.');
  assert.equal(calls[0].event, 'REQUEST_CHANGES');
  assert.match(calls[0].body, /Needs tests for the DST edge case\./);
});

test('requestChanges falls back to a generic note when no reason is given', async () => {
  const calls = [];
  const fetchImpl = fakeFetch([[/^pulls\/84\/reviews$/, (body) => { calls.push(body); return jsonResponse(200, {}); }]]);
  const reviewer = createPrReviewer({ token: 'tok', fetchImpl });
  await reviewer.requestChanges(84, null);
  assert.match(calls[0].body, /No reason was given/);
});

test('approve and requestChanges refuse to run without a token', async () => {
  const reviewer = createPrReviewer({ token: null, fetchImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(() => reviewer.approve(84), /GITHUB_TOKEN required/);
  await assert.rejects(() => reviewer.requestChanges(84, 'x'), /GITHUB_TOKEN required/);
});

test('a failed GitHub response surfaces its status on the thrown error', async () => {
  const fetchImpl = fakeFetch([[/^pulls\/84\/reviews$/, () => jsonResponse(422, { message: 'Review cannot be submitted' })]]);
  const reviewer = createPrReviewer({ token: 'tok', fetchImpl });
  await assert.rejects(() => reviewer.approve(84), (err) => err.status === 422);
});
