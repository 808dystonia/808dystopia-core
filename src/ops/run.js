import fs from 'node:fs';
import { PIPELINES, scheduleDecision } from './schedule.js';
import { stateStore } from './state.js';
export function outcomeStatus(report) {
  if (/off.*dry run/i.test(report.note || '')) return 'dry_run';
  if (report.status === 'failed' || report.status === 'failed-and-retried') return 'failed';
  if (report.status === 'partial' || report.followupFailed || report.site?.synced === false) return 'partial';
  if (report.status === 'posted' || report.published || report.synced) return 'posted';
  return 'no_content';
}
export async function runManaged(name, run, { store = stateStore, now = new Date(), event = process.env.GITHUB_EVENT_NAME } = {}) {
  const decision = scheduleDecision(name, now, event);
  if (!decision.due) return { status: 'outside_window' };
  if (event === 'schedule' && process.env.OPS_SLOT && decision.slot !== process.env.OPS_SLOT) return { status: 'expired_window' };
  const managed = process.env.OPS_STATE_ENABLED === '1';
  if (managed && process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Managed publishing only runs on main');
  const slot = event === 'schedule' ? decision.slot : `manual-${process.env.GITHUB_RUN_ID || now.getTime()}`;
  process.env.OPS_SLOT = slot;
  if (managed) {
    let existing;
    await store.update(name, state => {
      existing = state.slots[slot];
      if (!existing) state.slots[slot] = { status: 'running', startedAt: now.toISOString(), runId: process.env.GITHUB_RUN_ID || 'local' };
    });
    if (existing) return { status: 'already_claimed', operationalStatus: existing.status === 'running' ? 'partial' : existing.status, slot };
  }
  let report;
  try { report = await run(); }
  catch (error) {
    if (managed) await store.update(name, state => { state.slots[slot].status = 'failed'; state.slots[slot].finishedAt = new Date().toISOString(); });
    throw error;
  }
  const status = outcomeStatus(report);
  if (managed) await store.update(name, state => {
    state.slots[slot] = { ...state.slots[slot], status, finishedAt: new Date().toISOString() };
    // Keep 90 days of slots. Permanent content claims are never pruned.
    for (const [key, value] of Object.entries(state.slots)) if (Date.parse(value.startedAt) < now.getTime() - 90 * 86400000) delete state.slots[key];
  });
  return { ...report, operationalStatus: status, slot };
}
export async function main(name) {
  try {
    const report = await runManaged(name, async () => {
      const spec = PIPELINES[name];
      const mod = await import(spec.module);
      return mod[spec.entry]();
    });
    console.log(JSON.stringify(report, null, 2));
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/run.json', JSON.stringify(report, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${name}\n\nOutcome: **${report.operationalStatus || report.status}**\n`);
    if (['failed', 'partial', 'no_content'].includes(report.operationalStatus)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/failure.json', JSON.stringify({ pipeline: name, status: 'failed', runId: process.env.GITHUB_RUN_ID || null }));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${name}\n\nOutcome: **failed**. Inspect the run log and receipt artifact before retrying.\n`);
    process.exitCode = 1;
  }
}
