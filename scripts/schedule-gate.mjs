import fs from 'node:fs';
import { scheduleDecision } from '../src/ops/schedule.js';
const decision = scheduleDecision(process.argv[2]);
console.log(JSON.stringify(decision));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `due=${decision.due}\nslot=${decision.slot}\n`);
