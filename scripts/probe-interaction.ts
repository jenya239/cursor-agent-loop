import { cdpBaseUrl, checkCdpAvailable, connectCdp, listTargets } from '../src/cdp/client';
import { liveCdp } from '../src/cdp/live-cdp';
import { captureSnapshot } from '../src/cursor/interaction/snapshot';

async function main() {
  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    console.error('CDP unavailable');
    process.exit(1);
  }
  const pages = await listTargets(base);
  for (const page of pages.filter((p) => p.type === 'page').slice(0, 3)) {
    const snap = await captureSnapshot(liveCdp, page.title);
    console.log(JSON.stringify({ window: page.title.slice(0, 40), snap }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
