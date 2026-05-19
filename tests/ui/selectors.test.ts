/** @jest-environment node */
import type { CursorSnapshot } from '../../src/cursor/types';
import { agentPanelModel, isComposerMismatch } from '../../src/ui/state/selectors';
import { initialUiState } from '../../src/ui/state/store';
import idle from '../ui-fixtures/snapshot-idle.json';

const base = initialUiState(false);

describe('selectors', () => {
  it('isComposerMismatch when switch failed', () => {
    const snap = {
      ...(idle as CursorSnapshot),
      switch: { ok: false, reason: 'no-element' },
    };
    const s = {
      ...base,
      activeComposerId: '11111111-1111-1111-1111-111111111111',
      snapshot: snap,
      chatMeta: { composerId: 'x', name: 'Other chat' },
    };
    expect(isComposerMismatch(s)).toBe(true);
  });

  it('isComposerMismatch when chat name not in window title', () => {
    const snap = idle as CursorSnapshot;
    const s = {
      ...base,
      activeComposerId: '11111111-1111-1111-1111-111111111111',
      snapshot: snap,
      chatMeta: { composerId: 'x', name: 'UniqueChatTitleXYZ' },
      agent: { ...snap.agent, cdpWindowTitle: 'cr - cr - Cursor' },
    };
    expect(isComposerMismatch(s)).toBe(true);
  });

  it('agentPanelModel includes switch line', () => {
    const snap = {
      ...(idle as CursorSnapshot),
      switch: { ok: true, reason: 'fixture-skip' },
    };
    const s = { ...base, snapshot: snap, agent: snap.agent };
    const m = agentPanelModel(s);
    expect(m.switchLine).toContain('switch');
    expect(m.cdpDetails).toContain('cr - cr');
  });
});
