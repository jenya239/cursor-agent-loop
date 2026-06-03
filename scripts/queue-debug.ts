/**
 * Debug cr server send queue + drain preconditions.
 * Usage: CDP_PORT=9226 CR_AGENT_COMPOSER_ID=... tsx scripts/queue-debug.ts [flush]
 */
import { createCrMcpRuntime } from '../src/mcp/bootstrap';
import { probeComposerAgentWindow } from '../src/cdp/composer-agent-probe';
import { liveCdp } from '../src/cdp/live-cdp';
import { listTargets, connectCdp } from '../src/cdp/client';
import { FOCUS_CLEAR_INPUT_JS } from '../src/cdp/composer-input';

const CID =
  process.env.CR_AGENT_COMPOSER_ID?.trim() || 'f8e0a645-1610-4a1e-b19f-63f502235a2e';

async function composerInput(windowHint: string) {
  const mlc = (await listTargets()).find((t) => (t.title || '').includes(windowHint));
  if (!mlc) return { error: 'mlc window not found' };
  const { send, close } = await connectCdp(mlc.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    const r = (await send('Runtime.evaluate', {
      expression: FOCUS_CLEAR_INPUT_JS,
      returnByValue: true,
    })) as { result?: { value?: unknown } };
    return { window: mlc.title, ...(r.result?.value as object) };
  } finally {
    close();
  }
}

async function main(): Promise<void> {
  const flush = process.argv.includes('flush');
  console.log('=== cr queue debug ===');
  console.log('CR_AGENT_COMPOSER_ID:', CID);
  console.log('CDP_PORT:', process.env.CDP_PORT || '9226');

  const rt = await createCrMcpRuntime();
  try {
    const cdp = await rt.deps.cdpStatus();
    console.log('cdp:', cdp);

    const probe = await probeComposerAgentWindow(liveCdp, 'mlc');
    console.log('mlc probe:', probe);

    const input = await composerInput('mlc');
    console.log('composer input:', input);

    const q0 = rt.deps.listSendQueue();
    console.log('queue before:', q0.length, q0.map((i) => ({ id: i.id.slice(0, 8), composerId: i.composerId?.slice(0, 8) })));

    if (!q0.length) {
      const reg = await rt.deps.registerAgentToken({ composerId: CID });
      await rt.deps.enqueueSend(`[queue-debug] ping ${new Date().toISOString()}`, {
        token: reg.token,
        composerId: CID,
      });
      console.log('enqueued test with token', reg.token);
    }

    console.log('queue after enqueue:', rt.deps.listSendQueue().length);

    if (flush) {
      const d = await rt.deps.drainSendQueue();
      console.log('drain:', d);
      console.log('queue after drain:', rt.deps.listSendQueue().length);
      for (let i = 0; i < 5 && rt.deps.listSendQueue().length; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const d2 = await rt.deps.drainSendQueue();
        console.log(`drain retry ${i + 1}:`, d2);
      }
    } else {
      console.log('hint: pass "flush" arg to attempt drain');
      console.log('hint: MCP drain runs every 2s inside cr-cursor MCP process (no separate daemon)');
      console.log('hint: HTTP queue at :3847 is separate � needs npm run dev:server');
    }
  } finally {
    rt.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
