import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTvRapperNames } from '../src/clients/discord.js';
import { rankByFollowers, formatCount } from '../src/trending/1-get-rankings.js';

test('rapper names come from RAPPERS sections only, labelled or not, newest first', () => {
  const labelled = { content: '**808 TV // UNDERGROUND HEAT**\n**RAPPERS**\n**MALE**\n1. bleood — rage clips\n2. Che / Nettspend — KickAss\n**FEMALE**\n1. Pixy — "Legacy"\n**PRODUCERS**\n**MALE**\n1. Undercover — dark plugg' };
  const older = { content: '**RAPPERS**\n1. EsDeeKid — tour\n2. pixy — dup\n\n**PRODUCERS**\n1. Wraith9 — Rebel sound' };
  assert.deepEqual(parseTvRapperNames([labelled, older]), ['bleood', 'Che', 'Nettspend', 'Pixy', 'EsDeeKid']);
});

test('chart ranks by real follower counts, drops misses, keeps top 10', () => {
  const profiles = [{ name: 'A', followers: 1200 }, { name: 'B', followers: null }, { name: 'C', followers: 2_450_000 }, { name: 'D', followers: 0 },
    ...Array.from({ length: 12 }, (_, i) => ({ name: `x${i}`, followers: 100 + i }))];
  const chart = rankByFollowers(profiles);
  assert.equal(chart.length, 10);
  assert.deepEqual(chart.slice(0, 2).map(e => [e.name, e.streamsLabel]), [['C', '2.5M'], ['A', '1.2K']]);
  assert.ok(!chart.some(e => ['B', 'D'].includes(e.name)));
});

test('follower counts are labelled compactly', () => {
  assert.equal(formatCount(950), '950');
  assert.equal(formatCount(84_300), '84.3K');
  assert.equal(formatCount(412_000), '412K');
  assert.equal(formatCount(1_000_000), '1M');
  assert.equal(formatCount(12_400_000), '12M');
});
