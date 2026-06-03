import { cdpBaseUrl, checkCdpAvailable } from '../src/cdp/client';
import { maxUsagePct, probeWindowUsage } from '../src/cursor/probe-usage';

export { isExpensiveModel, maxUsagePct, probeWindowUsage, type WindowUsage } from '../src/cursor/probe-usage';

async function main() {
  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    console.error('CDP unavailable');
    process.exit(1);
  }
  const windows = await probeWindowUsage();
  const max = maxUsagePct(windows);
  console.log(JSON.stringify({ at: Date.now(), maxUsagePct: max, windows }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
