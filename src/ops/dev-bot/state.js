// Durable Dev Bot task state, stored as ops-state/dev-bot.json on the
// automation-state branch via the existing shared state store (see
// src/ops/state.js) -- same durability/concurrency guarantees the
// publishing pipelines already rely on, no new storage system.
//
// Every function accepts an optional `store` argument (defaults to the
// real shared store) purely so tests can inject an in-memory fake and
// never touch the network -- production call sites never pass it.
import { stateStore as defaultStore } from '../state.js';

const NAME = 'dev-bot';

function ensureShape(value) {
  if (!value.tasks) value.tasks = {};
  if (!value.unauthorizedAttempts) value.unauthorizedAttempts = [];
  return value;
}

export async function readDevBotState(store = defaultStore) {
  const { value } = await store.read(NAME);
  return ensureShape(value);
}

export async function recordTask(task, store = defaultStore) {
  return store.update(NAME, (value) => {
    ensureShape(value);
    value.tasks[task.id] = task;
    return task;
  });
}

// Bounded so a burst of unauthorized attempts (spam or misconfiguration)
// can't grow this file without limit.
const MAX_UNAUTHORIZED_ATTEMPTS = 200;

export async function recordUnauthorizedAttempt(attempt, store = defaultStore) {
  return store.update(NAME, (value) => {
    ensureShape(value);
    value.unauthorizedAttempts.push(attempt);
    if (value.unauthorizedAttempts.length > MAX_UNAUTHORIZED_ATTEMPTS) {
      value.unauthorizedAttempts.splice(0, value.unauthorizedAttempts.length - MAX_UNAUTHORIZED_ATTEMPTS);
    }
    return attempt;
  });
}

export async function listTasks(store = defaultStore) {
  const state = await readDevBotState(store);
  return Object.values(state.tasks);
}

export async function getTask(taskId, store = defaultStore) {
  const state = await readDevBotState(store);
  return state.tasks[taskId] || null;
}

// Phase 2: merges a patch into an existing task record (e.g. branch/PR/CI
// fields as a task moves past intake) -- never used to create a task,
// only to update one recordTask() already persisted.
export async function updateTask(taskId, patch, store = defaultStore) {
  return store.update(NAME, (value) => {
    ensureShape(value);
    if (!value.tasks[taskId]) throw new Error(`No task found for id "${taskId}"`);
    value.tasks[taskId] = { ...value.tasks[taskId], ...patch };
    return value.tasks[taskId];
  });
}

export async function taskExistsForIssue(issueNumber, store = defaultStore) {
  const state = await readDevBotState(store);
  return Object.values(state.tasks).some((t) => t.issueNumber === issueNumber);
}
