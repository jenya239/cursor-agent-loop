import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeSupervisor, guardBlockedAlerts } from '../../src/supervisor/analyze';
import { AGENT_TARGETS } from '../../src/cursor/agent-targets';

describe('supervisor', () => {
  it('flags step_stuck and send_fail_loop', () => {
    const logPath = path.join(os.tmpdir(), `cr-sup-test-${Date.now()}.log`);
    const now = Date.now();
    const lines = [
      ...Array(5).fill(null).map((_, i) => ({
        at: new Date(now - i * 60000).toISOString(),
        msg: 'sent',
        target: 'cr',
        role: 'Driver',
        step: '4',
      })),
      ...Array(6).fill(null).map((_, i) => ({
        at: new Date(now - i * 30000).toISOString(),
        msg: 'send failed',
        target: 'cr',
        err: 'switch failed: no-window',
      })),
    ];
    fs.writeFileSync(logPath, lines.map((l) => JSON.stringify(l)).join('\n'));
    const r = analyzeSupervisor({ logPath, targets: [AGENT_TARGETS[1]], windowMs: 3600000 });
    fs.unlinkSync(logPath);
    expect(r.ok).toBe(false);
    expect(r.alerts.some((a) => a.code === 'step_stuck')).toBe(true);
    expect(r.alerts.some((a) => a.code === 'send_fail_loop')).toBe(true);
    expect(guardBlockedAlerts(r, 'cr').length).toBeGreaterThan(0);
  });

  it('no_window critical at 6', () => {
    const logPath = path.join(os.tmpdir(), `cr-sup-nw-${Date.now()}.log`);
    const now = Date.now();
    const lines = Array(6).fill(null).map((_, i) => ({
      at: new Date(now - i * 60000).toISOString(),
      msg: 'no window open',
      target: 'mlc',
    }));
    fs.writeFileSync(logPath, lines.map((l) => JSON.stringify(l)).join('\n'));
    const r = analyzeSupervisor({ logPath, targets: [AGENT_TARGETS[0]], windowMs: 3600000 });
    fs.unlinkSync(logPath);
    const crit = r.alerts.find((a) => a.code === 'no_window' && a.severity === 'critical');
    expect(crit?.target).toBe('mlc');
    expect(guardBlockedAlerts(r, 'mlc').some((a) => a.code === 'no_window')).toBe(true);
  });

  it('guardBlockedAlerts scoped per target', () => {
    const report = {
      at: '',
      ok: false,
      alerts: [
        { id: '1', severity: 'critical' as const, target: 'cr', code: 'step_stuck', message: 'x' },
        { id: '2', severity: 'critical' as const, target: 'mlc', code: 'no_window', message: 'y' },
        { id: '3', severity: 'critical' as const, code: 'guard_error', message: 'z' },
      ],
    };
    expect(guardBlockedAlerts(report, 'mlc').map((a) => a.id)).toEqual(['2', '3']);
    expect(guardBlockedAlerts(report, 'cr').map((a) => a.id)).toEqual(['1', '3']);
  });
});
