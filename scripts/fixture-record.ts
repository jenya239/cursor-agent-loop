import fs from 'fs';
import path from 'path';
import { liveCdp } from '../src/cdp/live-cdp';
import { COMPOSER_AGENT_PROBE_ID } from '../src/cdp/probes/composer-agent.v1';
import type { CdpTarget } from '../src/cdp/client';
const FIXTURES = path.join(__dirname, '../src/cdp/fixtures');

function sanitize(t: CdpTarget): CdpTarget {
  return { ...t, webSocketDebuggerUrl: `ws://fixture/${t.id}` };
}

function write(name: string, data: unknown, dir: string) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  console.log('wrote', p);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const outDir = apply ? FIXTURES : path.join(FIXTURES, 'recorded');
  const cdp = liveCdp;
  if (!(await cdp.isAvailable())) {
    console.error('CDP unavailable (CDP_PORT / CDP_URL)');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const targets = (await cdp.listTargets()).map(sanitize);
  const probes = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
  write('targets.json', targets, outDir);
  write('composer-probes.json', probes, outDir);
  if (apply) {
    write('targets.default.json', targets, outDir);
    const cr = probes.find((p) => /cr - cr - Cursor/i.test(p.title)) ?? probes[0];
    if (cr) {
      const v = { busy: cr.busy, reason: cr.reason };
      write('composer-idle.json', cr.busy ? { busy: false, reason: 'idle' } : v, outDir);
      write('composer-busy.json', cr.busy ? v : { busy: true, reason: 'stop-icon' }, outDir);
    }
    console.log('applied fixtures (busy template uses current cr window state)');
  } else {
    console.log('recorded only; pass --apply to update src/cdp/fixtures/*.default');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
