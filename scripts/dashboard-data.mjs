// Legacy Sheet history plus confirmed per-platform outcomes from automation-state.
import 'dotenv/config';
import { readLogRows, readReelLogRows, readPinLogRows } from '../src/clients/googleSheets.js';
import { stateStore } from '../src/ops/state.js';
import { buildDashboard } from '../src/ops/dashboard.js';
const [carousel, reel, pin] = await Promise.all([readLogRows(), readReelLogRows(), readPinLogRows()]);
const states = Object.fromEntries(await Promise.all(['carousel', 'reel', 'pin'].map(async name => [name, (await stateStore.read(name)).value])));
console.log(JSON.stringify(buildDashboard({ carousel, reel, pin }, states), null, 2));
