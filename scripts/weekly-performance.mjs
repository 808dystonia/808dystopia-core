import 'dotenv/config';
import fs from 'node:fs';
import { config } from '../src/config.js';
import { runProxy } from '../src/clients/composio.js';
import { stateStore } from '../src/ops/state.js';
import { summarizePerformance, readInstagramMetrics, readPinterestMetrics } from '../src/ops/analytics.js';
const now = new Date();
const posts = [];
const deadline = Date.now() + 20 * 60000;
let collectionComplete = true;
collection: for (const pipeline of ['carousel', 'reel', 'pin', 'trending-tuesday']) {
  const { value } = await stateStore.read(pipeline);
  for (const post of Object.values(value.posts)) {
    const age = now - new Date(post.publishedAt);
    // A consistent collection window: exclude the first 24 hours and
    // collect a 7-day cohort. Do not manufacture history without IDs.
    if (post.status !== 'posted' || age < 86400000 || age >= 8 * 86400000) continue;
    if (Date.now() >= deadline) { collectionComplete = false; break collection; }
    const item = { ...post, pipeline, ageHours: age / 3600000, metrics: {}, unavailable: [] };
    if (post.platform === 'instagram') {
      // One metric per read: unsupported metrics must not erase the rest.
      for (const metric of ['reach', 'saved', 'likes', 'comments', 'shares']) {
        if (Date.now() >= deadline) { collectionComplete = false; item.unavailable.push(metric); continue; }
        try {
          const response = await runProxy({ connectedAccountId: config.instagram.connectedAccountId, endpoint: `/${encodeURIComponent(post.id)}/insights?metric=${metric}`, method: 'GET' });
          Object.assign(item.metrics, readInstagramMetrics(response));
          if (!(metric in item.metrics)) item.unavailable.push(metric);
        } catch { item.unavailable.push(metric); }
      }
    } else {
      try {
        const query = new URLSearchParams({ start_date: post.publishedAt.slice(0,10), end_date: now.toISOString().slice(0,10), metric_types: 'IMPRESSION,SAVE,OUTBOUND_CLICK,PIN_CLICK' });
        const response = await runProxy({ connectedAccountId: config.pinterest.connectedAccountId, endpoint: `https://api.pinterest.com/v5/pins/${encodeURIComponent(post.id)}/analytics?${query}`, method: 'GET' });
        item.metrics = readPinterestMetrics(response);
        for (const metric of ['IMPRESSION','SAVE','OUTBOUND_CLICK','PIN_CLICK']) if (!(metric in item.metrics)) item.unavailable.push(metric);
      } catch { item.unavailable.push('pin_analytics'); }
    }
    posts.push(item);
  }
}
const report = { collectionComplete, collectedAt: now.toISOString(), cohort: 'Posts aged 1–8 days; cumulative metrics at collection time', posts, ...summarizePerformance(posts) };
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/weekly-performance.json', JSON.stringify(report, null, 2));
const lines = ['# Weekly performance', '', report.cohort, '', report.note, '', `${posts.length} posts; ${posts.filter(x => Object.keys(x.metrics).length).length} with measurable metrics.`, '', ...report.recommendations.map(x => `- ${x}`)];
for (const [dimension, groups] of Object.entries(report.groups)) {
  lines.push('', `## By ${dimension}`, '', '| Platform | Group | Posts | Measured averages (sample count) |', '|---|---|---:|---|');
  for (const group of groups) lines.push(`| ${group.platform} | ${group.label.replaceAll('|','/').replaceAll('\n',' ')} | ${group.posts} | ${Object.entries(group.metrics).map(([name,stat]) => `${name}: ${stat.average.toFixed(1)} (n=${stat.samples})`).join('; ') || 'Unavailable'} |`);
}
const markdown = lines.join('\n');
fs.writeFileSync('reports/weekly-performance.md', markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
// Persist only summary aggregates, never API credentials or raw responses.
await stateStore.update('performance', state => { state.latest = { collectedAt: report.collectedAt, groups: report.groups, recommendations: report.recommendations }; });
if (!collectionComplete || posts.some(x => x.unavailable.length)) { console.error('Some analytics unavailable; see report coverage.'); process.exitCode = 1; }
