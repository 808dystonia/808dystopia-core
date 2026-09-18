import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import { PIPELINES } from '../src/ops/schedule.js';
const files = { carousel: 'daily-post', reel: 'daily-reel', pin: 'pin-post', 'news-brief': 'news-brief', 'eod-brief': 'eod-brief', 'morning-sync': 'morning-sync', 'trending-tuesday': 'trending-tuesday', 'weekly-performance': 'weekly-performance' };
test('workflows and Chicago schedules cannot drift; heavy setup is gated', () => {
  for (const [name, file] of Object.entries(files)) {
    const workflow = YAML.parse(fs.readFileSync(`.github/workflows/${file}.yml`, 'utf8'));
    assert.equal(workflow.on.schedule[0].cron, `${PIPELINES[name].minute} * * * *`);
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    const job = Object.values(workflow.jobs)[0];
    const gateIndex = job.steps.findIndex(step => step.id === 'gate');
    assert.ok(gateIndex >= 0);
    assert.equal(job.steps[gateIndex].run, `node scripts/schedule-gate.mjs ${name}`);
    for (const step of job.steps.slice(gateIndex + 1).filter(step => step.run || step.uses?.startsWith('denoland'))) {
      assert.equal(step.if, "steps.gate.outputs.due == 'true'");
    }
    if (name !== 'weekly-performance') assert.equal(job.env.OPS_STATE_ENABLED, '1');
  }
  for (const file of ['raptoonz', 'boxart']) assert.equal(fs.existsSync(`.github/workflows/${file}.yml`), false);
});
