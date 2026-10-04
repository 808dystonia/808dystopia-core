import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import { PIPELINES } from '../src/ops/schedule.js';
const files = { carousel: 'daily-post', reel: 'daily-reel', pin: 'pin-post', 'his-pin': 'his-pin', 'her-pin': 'her-pin', 'news-brief': 'news-brief', 'eod-brief': 'eod-brief', 'morning-sync': 'morning-sync', 'trending-tuesday': 'trending-tuesday', 'weekly-performance': 'weekly-performance' };
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
    // The Netlify dispatcher can start it, and the gate sees the trigger.
    assert.ok(workflow.on.workflow_dispatch.inputs.trigger);
    assert.equal(workflow.env.OPS_TRIGGER, '${{ inputs.trigger }}');
  }
  for (const file of ['raptoonz', 'boxart']) assert.equal(fs.existsSync(`.github/workflows/${file}.yml`), false);
});

test('the Netlify dispatcher starts every scheduled workflow, and its runs count as scheduled', async () => {
  const { WORKFLOWS, dispatchAll } = await import('../site/netlify/functions/dispatch-schedule.mjs');
  assert.deepEqual([...WORKFLOWS].sort(), Object.values(files).map((f) => `${f}.yml`).sort());
  const calls = [];
  const out = await dispatchAll('tkn', async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return { status: 204 }; });
  assert.equal(calls.length, WORKFLOWS.length);
  assert.deepEqual(calls[0].body, { ref: 'main', inputs: { trigger: 'scheduler' } });
  assert.equal(calls[0].auth, 'Bearer tkn');
  assert.ok(out.every((line) => line.endsWith('204')));

  const { currentEvent, scheduleDecision } = await import('../src/ops/schedule.js');
  assert.equal(currentEvent({ OPS_TRIGGER: 'scheduler', GITHUB_EVENT_NAME: 'workflow_dispatch' }), 'schedule');
  assert.equal(currentEvent({ OPS_TRIGGER: '', GITHUB_EVENT_NAME: 'workflow_dispatch' }), 'workflow_dispatch');
  // A scheduler run outside the carousel hours is not due; a plain manual run always is.
  const night = new Date('2026-10-04T08:30:00Z');
  assert.equal(scheduleDecision('carousel', night, 'schedule').due, false);
  assert.equal(scheduleDecision('carousel', night, 'workflow_dispatch').due, true);
});
