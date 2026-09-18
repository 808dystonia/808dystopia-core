import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard } from '../src/ops/dashboard.js';
import { summarizePerformance, readInstagramMetrics, readPinterestMetrics } from '../src/ops/analytics.js';
test('dashboard retires RapToonz, fixes winter offsets, and never invents Facebook success', () => {
  const logs = { carousel: [{ timestamp: '2026-01-12 9:00:00', artist: 'Artist', title: 'Release', status: 'posted', note: 'Published as IG media 123' }] };
  const now = new Date('2026-01-12T20:00:00Z');
  let report = buildDashboard(logs, {}, now);
  assert.equal(report.posts[0].atIso, '2026-01-12T15:00:00.000Z');
  assert.equal(report.posts[0].platform, 'Instagram'); assert.equal(report.posts[0].facebookStatus, 'unknown');
  assert.equal(report.pipelines.raptoonz, undefined);
  report = buildDashboard(logs, { carousel: { posts: { x: { id: '123', status: 'posted', publishedAt: '2026-01-12T15:00:00Z', artist: 'Artist', outcomes: { facebook: { status: 'posted' } } } } } }, now);
  assert.equal(report.posts.length, 1); assert.equal(report.posts[0].platform, 'IG + FB'); assert.equal(report.pipelines.carousel.todayCount, 1);
});
test('metrics preserve zeros, leave unknown absent, and avoid sparse conclusions', () => {
  assert.deepEqual(readInstagramMetrics({ data: [{ name: 'reach', values: [{ value: 0 }] }, { name: 'saved' }] }), { reach: 0 });
  assert.deepEqual(readPinterestMetrics({ all: { summary_metrics: { SAVE: 0 } } }), { SAVE: 0 });
  const base = { publishedAt: '2026-09-18T14:00:00Z', platform: 'instagram', format: 'reel', topic: 'interview' };
  let rows = [{ ...base, artist: 'A', metrics: { saved: 10 } }, { ...base, artist: 'B', metrics: {} }];
  assert.deepEqual(summarizePerformance(rows).recommendations, []);
  rows = Array.from({ length: 6 }, (_, i) => ({ ...base, artist: i < 3 ? 'A' : 'B', metrics: { saved: i < 3 ? 10 : 2 } }));
  assert.equal(summarizePerformance(rows).recommendations.length, 1);
});
