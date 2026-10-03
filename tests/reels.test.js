import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWindow } from '../src/reels/3-select-highlight.js';

test('near-miss highlight windows are stretched or trimmed instead of rejected', () => {
  // Gemini's live 10/01 answers: 11-12s clips, previously rejected outright.
  assert.deepEqual(normalizeWindow(20.1, 32, 600), { startSeconds: 20.1, endSeconds: 35.1 });
  assert.deepEqual(normalizeWindow(41.6, 53.2, 600), { startSeconds: 41.6, endSeconds: 56.6 });
  // Too long is trimmed to 90s; in-range is untouched.
  assert.deepEqual(normalizeWindow(10, 200, 600), { startSeconds: 10, endSeconds: 100 });
  assert.deepEqual(normalizeWindow(10, 40, 600), { startSeconds: 10, endSeconds: 40 });
});

test('windows stay inside the transcribed span and video', () => {
  // Short clip near the end slides back so it still lasts 15s.
  assert.deepEqual(normalizeWindow(470, 475, 480), { startSeconds: 465, endSeconds: 480 });
  // End past the limit is cut to the limit.
  assert.deepEqual(normalizeWindow(400, 520, 480), { startSeconds: 400, endSeconds: 480 });
});

test('unusable answers are still rejected', () => {
  assert.equal(normalizeWindow(NaN, 30, 600), null);
  assert.equal(normalizeWindow(-5, 30, 600), null);
  assert.equal(normalizeWindow(700, 720, 600), null);
  assert.equal(normalizeWindow(0, 10, 12), null);
});
