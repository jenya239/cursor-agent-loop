#!/usr/bin/env npx tsx
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeSupervisor } from '../src/supervisor/analyze';
import { resolveTargets } from '../src/cursor/agent-targets';

const OUT =
  process.env.CR_SUPERVISOR_STATE ||
  path.join(os.homedir(), '.cursor', 'cr-supervisor.json');
const LOG = process.env.CR_OVERNIGHT_LOG || path.join(os.homedir(), '.cursor', 'cr-overnight.log');

const report = analyzeSupervisor({ logPath: LOG, targets: resolveTargets() });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

for (const a of report.alerts) {
  const line = JSON.stringify({ at: report.at, msg: 'supervisor alert', ...a });
  fs.appendFileSync(LOG, line + '\n');
  if (a.severity === 'critical') process.stderr.write(line + '\n');
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
