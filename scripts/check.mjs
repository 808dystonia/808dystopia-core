import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
function check(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${item.name}`;
    if (item.isDirectory()) check(path);
    else if (/\.(mjs|js)$/.test(item.name)) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  }
}
for (const directory of ['src', 'scripts', 'tests']) check(directory);
console.log('JavaScript syntax checks passed');

const { default: YAML } = await import('yaml');
for (const file of fs.readdirSync('.github/workflows')) {
  const workflow = YAML.parse(fs.readFileSync(`.github/workflows/${file}`, 'utf8'));
  if (!workflow.on || !workflow.jobs) throw new Error(`Invalid workflow: ${file}`);
}
console.log('Workflow YAML checks passed');
