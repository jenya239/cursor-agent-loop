import {
  cdpBaseUrl,
  checkCdpAvailable,
  composerPageOrder,
  connectCdp,
  listTargets,
} from '../src/cdp/client';
import { COMPOSER_BAR_DUMP_JS } from '../src/cdp/composer-bar';

async function main() {
  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    console.error('CDP unavailable');
    process.exit(1);
  }
  const pages = composerPageOrder(await listTargets(base));
  for (const page of pages) {
    try {
      const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
      try {
        await send('Runtime.enable');
        const r = (await send('Runtime.evaluate', {
          expression: COMPOSER_BAR_DUMP_JS,
          returnByValue: true,
        })) as { result?: { value?: unknown } };
        console.log(JSON.stringify({ window: page.title, bar: r.result?.value }, null, 2));
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
