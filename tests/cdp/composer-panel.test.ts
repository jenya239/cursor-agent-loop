import {
  emptyComposerPanelProbe,
  parseComposerPanelProbe,
  panelToBarProbe,
} from '../../src/cdp/composer-panel';

describe('parseComposerPanelProbe', () => {
  it('parses workbench idle panel', () => {
    const p = parseComposerPanelProbe({
      ok: true,
      shell: 'workbench-v2',
      composerId: 'abc',
      agentRole: 'default',
      runState: 'idle',
      slowCount: 0,
      input: {
        kind: 'editable',
        placeholder: 'Plan, Build',
        draftLen: 12,
        empty: false,
        focused: true,
        hasToken: false,
      },
      model: { label: 'Composer 2.5 Fast', pickerOpen: false },
      mode: { id: 'agent', label: 'Agent' },
      context: { pills: [], usagePct: 88, usageVisible: true },
      controls: {
        mode: { id: 'agent', visible: true, enabled: true, label: 'Agent' },
        model: { visible: true, enabled: true, label: 'Composer 2.5 Fast' },
        submit: { visible: true, enabled: true, label: 'Send', sendMode: 'agent' },
        stop: { visible: false, enabled: false, label: 'Stop' },
        plus: { visible: false, enabled: false, label: 'Attach' },
      },
    });
    expect(p?.ok).toBe(true);
    expect(p?.input.kind).toBe('editable');
    expect(p?.controls.submit.sendMode).toBe('agent');
    expect(p?.context.usagePct).toBe(88);
  });

  it('parses agents readonly with context pill', () => {
    const p = parseComposerPanelProbe({
      ok: true,
      shell: 'agents-v3',
      composerId: 'x',
      agentRole: 'supervisor',
      runState: 'busy',
      slowCount: 0,
      input: {
        kind: 'readonly',
        placeholder: '',
        draftLen: 100,
        empty: false,
        focused: false,
        hasToken: false,
      },
      model: { label: 'claude-opus', pickerOpen: false },
      mode: null,
      context: {
        pills: [{ label: '1 Terminal', kind: 'terminal', aria: 'Open terminals (1)' }],
        usagePct: null,
        usageVisible: false,
      },
      controls: {
        mode: { id: 'unknown', visible: false, enabled: false, label: '' },
        model: { visible: false, enabled: false, label: '' },
        submit: { visible: false, enabled: false, label: 'Send', sendMode: 'agent' },
        stop: { visible: true, enabled: true, label: 'Stop' },
        plus: { visible: false, enabled: false, label: 'Attach' },
      },
    });
    expect(p?.shell).toBe('agents-v3');
    expect(p?.context.pills[0]?.kind).toBe('terminal');
    expect(p?.controls.stop.visible).toBe(true);
  });

  it('returns failed probe shape', () => {
    const p = parseComposerPanelProbe({ ok: false, reason: 'no-bar', shell: 'none' });
    expect(p?.ok).toBe(false);
    expect(p?.reason).toBe('no-bar');
  });

  it('panelToBarProbe maps run state', () => {
    const bar = panelToBarProbe({
      ...emptyComposerPanelProbe(),
      ok: true,
      composerId: 'id',
      model: { label: 'gpt-5', pickerOpen: false },
      agentRole: 'supervisor',
      runState: 'slow',
      slowCount: 2,
      input: { kind: 'editable', placeholder: '', draftLen: 5, empty: false, focused: false, hasToken: true },
      controls: emptyComposerPanelProbe().controls,
    });
    expect(bar.busy).toBe(true);
    expect(bar.draftHasToken).toBe(true);
    expect(bar.agentRole).toBe('supervisor');
  });
});
