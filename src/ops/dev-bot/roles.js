// Configurable requester allowlist for Dev Bot task intake. Add or remove
// people by editing config/dev-bot-roles.json -- never hardcode usernames
// in this file. An entry's presence is the only thing that grants
// permission to open an accepted dev-bot:task issue; it grants nothing
// else (no merge/deploy authority is configurable here or anywhere in
// Phase 0).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', '..', 'config', 'dev-bot-roles.json');

export function loadRoles(path = DEFAULT_PATH) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(raw.requesters)) {
    throw new Error('config/dev-bot-roles.json: "requesters" must be an array');
  }
  return raw.requesters.map((entry) => {
    if (!entry.githubUsername || typeof entry.githubUsername !== 'string') {
      throw new Error('config/dev-bot-roles.json: every requester needs a githubUsername string');
    }
    return { githubUsername: entry.githubUsername.toLowerCase(), displayName: entry.displayName || entry.githubUsername };
  });
}

export function findRequester(githubUsername, roles = loadRoles()) {
  if (!githubUsername) return null;
  return roles.find((r) => r.githubUsername === githubUsername.toLowerCase()) || null;
}

export function isAuthorizedRequester(githubUsername, roles = loadRoles()) {
  return findRequester(githubUsername, roles) !== null;
}
