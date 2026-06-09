/**
 * @jest-environment jsdom
 */
import { agentPanelModel } from '../../src/ui/state/selectors';
import { initialUiState } from '../../src/ui/state/store';
import { applyAgentPanel } from '../../src/ui/views/render-agent-panel';
import type { CursorSnapshot } from '../../src/cursor/types';
import idle from '../ui-fixtures/snapshot-idle.json';

describe('render-agent-panel', () => {
  it('renders idle label', () => {
    const s = initialUiState(false);
    const snap = idle as CursorSnapshot;
    const state = {
      ...s,
      snapshot: snap,
      agent: snap.agent,
    };
    const el = document.createElement('div');
    applyAgentPanel(el, agentPanelModel(state));
    expect(el.textContent).toContain('IDLE');
    expect(el.dataset.phase).toBe('idle');
  });
});
