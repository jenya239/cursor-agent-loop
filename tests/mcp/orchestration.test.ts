import fs from 'fs';
import os from 'os';
import path from 'path';
import { mcpAgentNext, mcpOvernightState, mcpSupervisor } from '../../src/mcp/orchestration';

describe('mcp orchestration', () => {
  it('mcpAgentNext for mlc', () => {
    const r = mcpAgentNext({ target: 'mlc' }) as { target: string; next: { role: string } };
    expect(r.target).toBe('mlc');
    expect(r.next.role).toBeTruthy();
  });

  it('mcpAgentNext builds prompt with token', () => {
    const r = mcpAgentNext({
      target: 'cr',
      token: 'cr-agent-test',
      includePrompt: true,
    }) as { prompt: string };
    expect(r.prompt).toContain('AGENT_TOKEN=cr-agent-test');
    expect(r.prompt).toContain('ROLE=');
  });

  it('mcpSupervisor reads log', () => {
    const logPath = path.join(os.tmpdir(), `cr-mcp-sup-${Date.now()}.log`);
    fs.writeFileSync(
      logPath,
      JSON.stringify({
        at: new Date().toISOString(),
        msg: 'sent',
        target: 'cr',
        role: 'Driver',
        step: '1',
      }) + '\n'
    );
    process.env.CR_OVERNIGHT_LOG = logPath;
    const r = mcpSupervisor({ target: 'cr', refresh: true });
    fs.unlinkSync(logPath);
    delete process.env.CR_OVERNIGHT_LOG;
    expect(r.report.alerts).toBeDefined();
  });

  it('mcpOvernightState returns paths', () => {
    const r = mcpOvernightState({ tail: 5 });
    expect(r.statePath).toContain('cr-overnight-state.json');
    expect(Array.isArray(r.logTail)).toBe(true);
  });
});
