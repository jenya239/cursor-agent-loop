import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  advanceIfStepDone,
  INSTRUCTIONS_REV,
  pickNextAgentStep,
  trackStepStatus,
} from '../../src/cursor/agent_next';
import {
  checkEnqueueLoop,
  countRecentSameKey,
  fixInstructionsRev,
  lastUserPromptKey,
  parseAgentPrompt,
  readInstructionsRev,
  readOrchState,
  recordEnqueue,
  syncOrchFromChat,
} from '../../src/cursor/loop-guard';

const FIX = path.join(__dirname, '../fixtures/agent-next');

describe('loop-guard', () => {
  const orchPath = path.join(os.tmpdir(), `cr-orch-test-${Date.now()}.json`);

  beforeEach(() => {
    process.env.CR_ORCH_STATE = orchPath;
    fs.writeFileSync(orchPath, JSON.stringify({ byComposer: {} }));
  });

  afterEach(() => {
    delete process.env.CR_ORCH_STATE;
    try {
      fs.unlinkSync(orchPath);
    } catch {
      /* ok */
    }
  });

  it('fixInstructionsRev patches stale rev from agent CONTINUITY', () => {
    const dir = path.join(os.tmpdir(), `rev-${Date.now()}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, 'CONTINUITY.md'),
      '**INSTRUCTIONS_REV:** `2026-05-29-test-rev`\n'
    );
    const out = fixInstructionsRev('INSTRUCTIONS_REV=old\nROLE=Driver', dir);
    expect(out).toContain('INSTRUCTIONS_REV=2026-05-29-test-rev');
    expect(readInstructionsRev(dir)).toBe('2026-05-29-test-rev');
    fs.rmSync(dir, { recursive: true });
  });

  it('blocks duplicate enqueue', () => {
    const cid = 'test-composer';
    const text = 'INSTRUCTIONS_REV=x\nROLE=Driver\nSTEP=3\n@docs/agent/TRACK_X.md\nwork';
    recordEnqueue(cid, text);
    const d = checkEnqueueLoop({ composerId: cid, text });
    expect(d.allow).toBe(false);
    expect(d.reason).toContain('duplicate');
  });

  it('advanceIfStepDone skips done step', () => {
    const dir = path.join(os.tmpdir(), `agent-adv-${Date.now()}`);
    fs.mkdirSync(dir);
    const base = 'TRACK_DONE.md';
    fs.writeFileSync(
      path.join(dir, base),
      '## Status: active\n| 1 | a | done |\n| 2 | b | pending |\n**STEP=2**\n'
    );
    const next = advanceIfStepDone(dir, {
      role: 'Driver',
      step: '1',
      trackFile: base,
      focus: 'stability',
      reason: '',
      refs: [],
    });
    expect(next.step).toBe('2');
    fs.rmSync(dir, { recursive: true });
  });

  it('trackStepStatus reads done', () => {
    const p = path.join(FIX, 'TRACK_TEST.md');
    expect(trackStepStatus(p, '1')).toBe('done');
    expect(trackStepStatus(p, '2')).toBe('pending');
  });

  it('trackStepStatus treats gate-pending partial as pending', () => {
    const p = path.join(os.tmpdir(), `track-partial-${Date.now()}.md`);
    fs.writeFileSync(p, '| 6 | gate | done (partial — bootstrap gate pending) |\n');
    expect(trackStepStatus(p, '6')).toBe('pending');
    fs.unlinkSync(p);
  });

  it('pickNext skips done driver step', () => {
    const dir = path.join(os.tmpdir(), `agent-fix-${Date.now()}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, 'TRACK_LOOP.md'),
      '## Status: **active**\n| 1 | a | done |\n| 2 | b | pending |\n**STEP=2**\n'
    );
    fs.writeFileSync(path.join(dir, 'SESSION.md'), '| driver_turns_since_plan | 1 |\n');
    const next = pickNextAgentStep(dir);
    expect(next.step).toBe('2');
    fs.rmSync(dir, { recursive: true });
  });

  it('readOrchState persists', () => {
    recordEnqueue('c1', 'ROLE=Driver\nSTEP=1\nx');
    expect(readOrchState().byComposer.c1?.lastKey).toBe('Driver:1');
  });

  it('parseAgentPrompt', () => {
    const m = parseAgentPrompt('INSTRUCTIONS_REV=a\nROLE=Driver\nSTEP=3\n@docs/agent/TRACK_DIAGNOSTICS2.md');
    expect(m.role).toBe('Driver');
    expect(m.step).toBe('3');
    expect(m.trackFile).toBe('TRACK_DIAGNOSTICS2.md');
  });

  it('blocks same step waiting in chat (last msg user)', () => {
    const text = 'ROLE=Driver\nSTEP=3\n@docs/agent/TRACK_X.md\nwork';
    const history = [{ role: 'user', text }];
    const d = checkEnqueueLoop({ composerId: 'c', text, historyMessages: history });
    expect(d.allow).toBe(false);
    expect(d.reason).toContain('waiting in chat');
  });

  it('blocks same step after assistant answered', () => {
    const text = 'ROLE=Driver\nSTEP=3\n@docs/agent/TRACK_X.md\nfinish';
    const history = [
      { role: 'user', text: 'ROLE=Driver\nSTEP=3\n@docs/agent/TRACK_X.md\nprev' },
      { role: 'assistant', text: 'done work' },
    ];
    const d = checkEnqueueLoop({ composerId: 'c', text, historyMessages: history });
    expect(d.allow).toBe(false);
    expect(d.reason).toContain('already ran');
  });

  it('syncOrchFromChat resets repeat after assistant', () => {
    recordEnqueue('c', 'ROLE=Driver\nSTEP=3\nx');
    syncOrchFromChat('c', [
      { role: 'user', text: 'ROLE=Driver\nSTEP=3\nx' },
      { role: 'assistant', text: 'ok' },
    ]);
    const d = checkEnqueueLoop({
      composerId: 'c',
      text: 'ROLE=Driver\nSTEP=4\ny',
      historyMessages: [
        { role: 'user', text: 'ROLE=Driver\nSTEP=3\nx' },
        { role: 'assistant', text: 'ok' },
      ],
    });
    expect(d.allow).toBe(true);
  });

  it('blocks step already in pending queue', () => {
    const text = 'ROLE=Driver\nSTEP=4\nx';
    const d = checkEnqueueLoop({
      composerId: 'c',
      text,
      pendingTexts: ['ROLE=Driver\nSTEP=4\ny'],
    });
    expect(d.allow).toBe(false);
    expect(d.reason).toContain('queued');
  });

  it('lastUserPromptKey and countRecentSameKey', () => {
    const msgs = [
      { role: 'user', text: 'ROLE=Driver\nSTEP=1\na' },
      { role: 'assistant', text: 'x' },
      { role: 'user', text: 'ROLE=Driver\nSTEP=3\nb' },
    ];
    expect(lastUserPromptKey(msgs)).toBe('Driver:3');
    expect(countRecentSameKey(msgs, 'Driver:3')).toBe(1);
    expect(countRecentSameKey([...msgs, { role: 'user', text: 'ROLE=Driver\nSTEP=3\nc' }], 'Driver:3')).toBe(2);
    expect(countRecentSameKey([...msgs, { role: 'user', text: 'ROLE=Driver\nSTEP=3\nc' }, { role: 'user', text: 'ROLE=Driver\nSTEP=3\nd' }], 'Driver:3')).toBe(3);
  });
});
