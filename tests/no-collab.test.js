import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoCollabStory } from '../src/util/sensitiveContent.js';
import { buildCaption } from '../src/pipeline/6-build-caption.js';

test('sensitive stories, fights and legal trouble get no collab invite', () => {
  assert.equal(isNoCollabStory('LUCKI was reportedly injured Saturday in an altercation at ComplexCon'), true);
  assert.equal(isNoCollabStory('Rapper arrested after show'), true);
  assert.equal(isNoCollabStory('', 'The two have been in a beef since 2024'), true);
  assert.equal(isNoCollabStory('Pixy just dropped her new EP Legacy'), false);
});

test('the LUCKI carousel would mention but not invite the artist', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const write = async () => null;
  const injured = await buildCaption({ candidate: { text: 'LUCKI was reportedly injured in an altercation at ComplexCon.' }, classified: { type: 'other', artist: 'LUCKI', title: 'ComplexCon' } }, { write });
  assert.equal(injured.collaborator, null);
  const diss = await buildCaption({ candidate: { text: 'x' }, classified: { type: 'diss', artist: 'A', title: 'B', lyricTag: 'DISS' } }, { write });
  assert.equal(diss.collaborator, null);
});
