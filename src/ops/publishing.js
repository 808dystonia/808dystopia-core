import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { stateStore } from './state.js';
export const contentKey = value => createHash('sha256').update(String(value).trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
export async function claimedPosts(pipeline, store = stateStore) { return (await store.read(pipeline)).value.posts; }
export async function publishOnce({ pipeline, identity, platform, metadata = {}, publish, store = stateStore }) {
  if (typeof identity !== 'string' || !identity.trim()) throw new Error('Stable content identity required');
  const key = contentKey(identity);
  const startedAt = new Date().toISOString();
  await store.update(pipeline, state => {
    if (state.posts[key]) throw new Error('Content already claimed; inspect operational state before retrying');
    state.posts[key] = { ...metadata, platform, startedAt, status: 'pending', runId: process.env.GITHUB_RUN_ID || 'local', slot: process.env.OPS_SLOT || null };
  });
  // A timeout or crash here is uncertain: retain pending forever until a
  // human reconciles it. Never automatically release the claim or retry.
  const result = await publish();
  const id = result.mediaId || result.pinId;
  if (!result.published || !id) throw new Error('Publish response did not confirm a post ID; claim retained for reconciliation');
  const publishedAt = new Date().toISOString();
  // Preserve the returned ID in the workflow artifact even if the remote
  // receipt write fails. The pre-publish claim still blocks duplicates.
  fs.mkdirSync('reports', { recursive: true });
  fs.appendFileSync('reports/receipts.jsonl', JSON.stringify({ pipeline, key, id: String(id), publishedAt }) + '\n');
  await store.update(pipeline, state => {
    state.posts[key] = { ...state.posts[key], status: 'posted', id: String(id), publishedAt };
  });
  return { ...result, key };
}
export async function recordFollowups(pipeline, key, outcomes, store = stateStore) {
  await store.update(pipeline, state => {
    if (!state.posts[key]?.id) throw new Error('Cannot record follow-ups without confirmed post');
    state.posts[key].outcomes = outcomes;
  });
}
export async function bestEffort(action) {
  try { return { ok: true, value: await action() }; }
  catch { return { ok: false }; } // Error bodies can contain credentials; state only stores outcome.
}
