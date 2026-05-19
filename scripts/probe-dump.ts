import {
  cdpBaseUrl,
  checkCdpAvailable,
  composerPageOrder,
  connectCdp,
  listTargets,
} from '../src/cdp/client';
import { COMPOSER_SWITCH_DUMP_JS } from '../src/cdp/probes/composer-switch-dump.v1';

async function main() {
  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    console.error('CDP unavailable');
    process.exit(1);
  }
  const targets = await listTargets(base);
  const pages = composerPageOrder(targets);
  for (const page of pages) {
    try {
      const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
      try {
        await send('Runtime.enable');
        const r = (await send('Runtime.evaluate', {
          expression: COMPOSER_SWITCH_DUMP_JS,
          returnByValue: true,
        })) as { result?: { value?: unknown } };
        console.log(JSON.stringify({ window: page.title, dump: r.result?.value }, null, 2));
      } finally {
        close();
      }
    } catch (e) {
      console.error(page.title, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
