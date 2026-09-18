import { chicagoParts } from './schedule.js';
export function summarizePerformance(posts) {
  const groups = {};
  for (const dimension of ['artist', 'format', 'topic', 'hour']) {
    const buckets = {};
    for (const post of posts) {
      const label = dimension === 'hour' ? String(chicagoParts(new Date(post.publishedAt)).hour) : post[dimension] || 'unknown';
      const key = `${post.platform}:${label}`;
      const bucket = buckets[key] ||= { platform: post.platform, label, posts: 0, metrics: {} };
      bucket.posts++;
      for (const [metric, value] of Object.entries(post.metrics || {})) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const stat = bucket.metrics[metric] ||= { total: 0, samples: 0 };
        stat.total += value; stat.samples++;
      }
    }
    groups[dimension] = Object.values(buckets).map(bucket => ({ ...bucket,
      metrics: Object.fromEntries(Object.entries(bucket.metrics).map(([name, stat]) => [name, { ...stat, average: stat.total / stat.samples }])),
    }));
  }
  const recommendations = [];
  for (const [dimension, buckets] of Object.entries(groups)) {
    for (const platform of ['instagram', 'pinterest']) {
      const metric = platform === 'instagram' ? 'saved' : 'SAVE';
      const eligible = buckets.filter(x => x.platform === platform && x.metrics[metric]?.samples >= 3).sort((a,b) => b.metrics[metric].average - a.metrics[metric].average);
      if (eligible.length < 2 || eligible[0].metrics[metric].average <= eligible[1].metrics[metric].average) continue;
      recommendations.push(`${platform}: test more ${dimension}=${eligible[0].label}; average ${metric} ${eligible[0].metrics[metric].average.toFixed(1)} across ${eligible[0].metrics[metric].samples} measured posts. Directional only: post ages and audiences differ.`);
    }
  }
  return { groups, recommendations, note: 'Observed performance, not a causal experiment. Missing metrics are unknown, not zero. Compare within platform; post ages vary. At least 3 measured posts in each of 2 groups are required for a suggestion.' };
}
export function readInstagramMetrics(data) {
  return Object.fromEntries((data?.data || []).flatMap(x => {
    const value = x.total_value?.value ?? x.values?.at(-1)?.value;
    return typeof value === 'number' ? [[x.name, value]] : [];
  }));
}
export function readPinterestMetrics(data) {
  const metrics = data?.all?.summary_metrics || data?.analytics?.all?.summary_metrics || {};
  return Object.fromEntries(Object.entries(metrics).filter(([,value]) => typeof value === 'number'));
}
