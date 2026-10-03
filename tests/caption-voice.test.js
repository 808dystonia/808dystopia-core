import test from 'node:test';
import assert from 'node:assert/strict';
import { writeCopy, tagArtist, assembleCaption, SIGN_OFF } from '../src/captions/voice.js';

test('AI copy is cleaned: no hashtags, mentions or links; hook/question emoji-free; context capped at 3 emojis', async () => {
  const copy = await writeCopy('facts', async () => ({
    hook: '#Pixy just dropped 🔥 @pixy https://x.co',
    context: 'Six tracks 🔥 pure jerk 😮‍💨 wow 💯 ok 🙌',
    question: 'Have y\'all run it yet? 🤔',
  }));
  assert.equal(copy.hook, 'Pixy just dropped pixy');
  assert.equal(copy.context, 'Six tracks 🔥 pure jerk 😮‍💨 wow 💯 ok');
  assert.equal(copy.question, "Have y'all run it yet?");
});

test('unusable or failed AI copy returns null so the caller falls back', async () => {
  assert.equal(await writeCopy('f', async () => { throw new Error('quota'); }), null);
  assert.equal(await writeCopy('f', async () => ({ hook: '', context: '', question: 'q' })), null);
  assert.equal(await writeCopy('f', async () => ({ hook: 'x'.repeat(200), context: '', question: 'q' })), null);
});

test('the artist becomes a hashtag once, only as a whole name', () => {
  assert.equal(tagArtist('Molly Santana teased BlackPunk', 'Molly Santana'), '#MollySantana teased BlackPunk');
  assert.equal(tagArtist('A producer broke down beats like bleood', 'bleood'), 'A producer broke down beats like #bleood');
  assert.equal(tagArtist('Pixyland is a place', 'Pixy'), 'Pixyland is a place');
});

test('caption blocks are in the news-page order with the 808 sign-off', () => {
  const caption = assembleCaption({ artist: 'NoCap', hook: 'NoCap just dropped Heaven On Mars.', hookEmoji: '💿🔥', context: 'It hit number one 📈', quote: '', question: 'Have y\'all checked it out yet?', credit: '', handleLine: '@nocap' });
  assert.equal(caption, `#NoCap just dropped Heaven On Mars 💿🔥\n\nIt hit number one 📈\n\nHave y'all checked it out yet⁉️ 🤔⬇️\n\n@nocap\n\n${SIGN_OFF}`);
});

test('the on-screen overlay is emoji-free and dropped (not the caption) when too long', async () => {
  const base = { hook: 'Pixy shut it down', context: '', question: 'Who was there?' };
  assert.equal((await writeCopy('f', async () => ({ ...base, overlay: 'Pixy shut it down 🔥' }))).overlay, 'Pixy shut it down');
  const long = await writeCopy('f', async () => ({ ...base, overlay: 'x'.repeat(80) }));
  assert.equal(long.overlay, '');
  assert.equal(long.hook, 'Pixy shut it down');
});
