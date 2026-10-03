import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSource, splitLead, buildContextHtml } from '../src/pipeline/5-render-slides.js';

test("Grok's trailing source tag becomes its own line", () => {
  assert.deepEqual(
    splitSource('Nine Vicious surprise-dumped two EPs after SEDITION — DET HOT SHIT + LA NY ATL, nine extra cuts off the same sessions (HipHop Magz / SC).'),
    { body: 'Nine Vicious surprise-dumped two EPs after SEDITION — DET HOT SHIT + LA NY ATL, nine extra cuts off the same sessions.', source: 'HipHop Magz / SC' },
  );
  assert.deepEqual(splitSource('Pixy drops a new EP.'), { body: 'Pixy drops a new EP.', source: '' });
  assert.deepEqual(splitSource('(only a tag)'), { body: '(only a tag)', source: '' });
});

test('the first sentence is the lead, including one ending inside a quote', () => {
  assert.deepEqual(splitLead('He dropped "Essential." The release marks a shift. More soon.'),
    { lead: 'He dropped "Essential."', rest: 'The release marks a shift. More soon.' });
  assert.deepEqual(splitLead('One sentence only.'), { lead: 'One sentence only.', rest: '' });
});

test('context slide gets the photo, accented headline, lead, rest and source; no fixed sizes', () => {
  const html = buildContextHtml({
    candidate: { text: 'Nine Vicious dropped two EPs. Nine extra cuts (HipHop Magz / SC).' },
    classified: { headlineLine1: 'Nine Vicious', headlineLine2: 'DROPS TWO EPS', headlineAccent: 'TWO EPS', context: '' },
    photoUrl: 'file:///tmp/p.jpg',
  });
  assert.match(html, /class="bg" src="file:\/\/\/tmp\/p\.jpg"/);
  assert.match(html, /Nine Vicious DROPS <span class="accent">TWO EPS<\/span>/);
  assert.match(html, /<span class="lead">Nine Vicious dropped two EPs\.<\/span><span class="rest">Nine extra cuts\.<\/span>/);
  assert.match(html, /SOURCE: HipHop Magz \/ SC/);
  assert.match(html, /window\.__layoutDone = false/);
  assert.ok(!html.includes('{{'));
});
