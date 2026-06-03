import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getAgentState,
  syncAgentState,
  verifyTurn,
  type AgentPhase,
} from '../src/cursor/agent-state';
import type { AgentTarget } from '../src/cursor/agent-targets';
import type { ChatLine } from '../src/cursor/loop-guard';

const STATE = path.join(os.tmpdir(), `cr-agent-state-${process.pid}.json`);

const target: AgentTarget = {
  id: 'mlc',
  composerId: 'c-test',
  agentDir: '/tmp/mlc',
  windowHint: 'mlc',
  fastOnly: true,
};

beforeEach(() => {
  process.env.CR_AGENT_STATE = STATE;
  try {
    fs.unlinkSync(STATE);
  } catch {
    /* fresh */
  }
});

afterAll(() => {
  delete process.env.CR_AGENT_STATE;
  try {
    fs.unlinkSync(STATE);
  } catch {
    /* ok */
  }
});

function msg(role: 'user' | 'assistant', text: string): ChatLine {
  return { role, text };
}

describe('verifyTurn', () => {
  it('pending when last is user prompt', () => {
    const r = verifyTurn([
      msg('user', 'ROLE=Driver\nSTEP=3\nAGENT_TOKEN=x\nDo work'),
    ]);
    expect(r.turnVerify).toBe('pending');
    expect(r.promptKey).toBe('Driver:3');
  });

  it('ok when assistant looks finished', () => {
    const r = verifyTurn([
      msg('user', 'ROLE=Driver\nSTEP=3\nAGENT_TOKEN=x'),
      msg('assistant', 'Done. STEP=4 enqueued. 757 pass.'),
    ]);
    expect(r.turnVerify).toBe('ok');
  });

  it('incomplete on short assistant', () => {
    const r = verifyTurn([
      msg('user', 'ROLE=Driver\nSTEP=3\nAGENT_TOKEN=x'),
      msg('assistant', 'ok'),
    ]);
    expect(r.turnVerify).toBe('incomplete');
  });
});

describe('syncAgentState', () => {
  it('logs phase transitions', () => {
    syncAgentState({
      target,
      messages: [msg('user', 'ROLE=Driver\nSTEP=1\nAGENT_TOKEN=x')],
      busy: true,
      reconnecting: false,
    });
    let st = getAgentState('mlc');
    expect(st.agents[0].phase).toBe('turn_pending');

    syncAgentState({
      target,
      messages: [
        msg('user', 'ROLE=Driver\nSTEP=1\nAGENT_TOKEN=x'),
        msg('assistant', 'Finished STEP=1. 100 pass.'),
      ],
      busy: false,
    });
    st = getAgentState('mlc');
    expect(st.agents[0].phase).toBe('turn_done');
    expect(st.log.length).toBeGreaterThanOrEqual(2);
    expect(st.log.some((l) => l.to === 'turn_done')).toBe(true);
  });

  it('stuck_reconnecting when reconnecting and busy', () => {
    const e = syncAgentState({
      target,
      messages: [],
      busy: true,
      reconnecting: true,
    });
    expect(e.phase).toBe('stuck_reconnecting' as AgentPhase);
    expect(e.issue).toMatch(/reconnect/i);
  });
});
