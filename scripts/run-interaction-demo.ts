import { cdpBaseUrl, checkCdpAvailable } from '../src/cdp/client';
import { liveCdp } from '../src/cdp/live-cdp';
import { actions, captureSnapshot, expect, runStep, waitFor } from '../src/cursor/interaction';

const WINDOW = process.argv[2] || 'mlc';

async function step(label: string, opts: Parameters<typeof runStep>[1]) {
  const r = await runStep(liveCdp, { label, windowTitle: WINDOW, ...opts });
  console.log(
    JSON.stringify({
      step: label,
      ok: r.ok,
      verdict: r.verdict,
      reason: r.reason,
      elapsedMs: r.elapsedMs,
      attempts: r.attempts,
      actionError: r.actionError,
      agent: r.after.agent,
      thread: r.after.thread,
      blockers: r.after.blockers,
    })
  );
  return r;
}

async function main() {
  if (!(await checkCdpAvailable(cdpBaseUrl()))) {
    console.error('CDP unavailable');
    process.exit(1);
  }

  const before = await captureSnapshot(liveCdp, WINDOW);
  console.log(JSON.stringify({ phase: 'snapshot', window: before.windowTitle, snap: before }, null, 2));

  await step('noop-unchanged', {
    action: actions.noop(),
    expect: expect.unchanged(),
    wait: { timeoutMs: 1200, intervalMs: 200 },
  });

  await step('dismiss-if-any', {
    action: actions.dismiss(),
    expect: expect.oneOf(expect.unchanged(), expect.sendBlocked()),
    wait: { timeoutMs: 1500, intervalMs: 200 },
  });

  await waitFor(liveCdp, {
    label: 'wait-state',
    windowTitle: WINDOW,
    expect: expect.oneOf(
      expect.unchanged(),
      expect.agentStarted(),
      expect.agentIdle(),
      expect.activeTool(),
      expect.sendBlocked()
    ),
    wait: { timeoutMs: 2000, intervalMs: 300 },
  }).then((r) =>
    console.log(JSON.stringify({ step: 'wait-state', ok: r.ok, verdict: r.verdict, reason: r.reason }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
